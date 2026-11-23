#!/usr/bin/env python3
"""
VigIA - visor local de camara DroidCam.

Servidor HTTP local. Sirve la interfaz, reenvia el stream MJPEG del telefono
al navegador y comparte copias de los fotogramas con el detector local de
personas. El video nunca sale del equipo.
"""

from __future__ import annotations

import ipaddress
import json
import mimetypes
import os
import re
import socket
import sys
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, unquote, urlparse
from urllib.request import Request, urlopen

import auth_store
import detector
import supabase_store

APP_NAME = "VigIA"
VERSION = "0.5.0"
BASE_DIR = Path(__file__).resolve().parent
MOCKUP_DIR = BASE_DIR / "mockup"
MOCKUP_INDEX_FILE = MOCKUP_DIR / "index.html"
LEGACY_INDEX_FILE = BASE_DIR / "static" / "index.html"
DATA_DIR = BASE_DIR / "data"
CAPTURES_DIR = DATA_DIR / "captures"

STATIC_CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
}

try:
    DEFAULT_PORT = int(os.environ.get("AUTEC_PORT", "8000"))
except ValueError:
    DEFAULT_PORT = 8000
DEFAULT_CAMERA_PORT = 4747
DEFAULT_RESOLUTION = "1280x720"
RESOLUTION_RE = re.compile(r"^\d{2,4}x\d{2,4}$")
MAX_CAPTURE_BYTES = 12 * 1024 * 1024
CAPTURE_LOCK = threading.Lock()
DISCOVER_LOCK = threading.Lock()
STREAM_LOCK = threading.Lock()
STREAM_STATE = {
    "active": 0,
    "startedAt": 0.0,
    "lastChunkAt": 0.0,
    "chunks": 0,
    "frames": 0,
    "url": "",
}
CAMERA_PATHS = (
    # DroidCam suele permitir una sola conexion. /force libera la camara
    # aunque el cliente de Windows este conectado.
    "/video/force/1280x720",
    "/video/force/640x480",
    "/video/1280x720",
    "/video/640x480",
    "/video",
    "/mjpegfeed?1280x720",
    "/mjpegfeed?640x480",
    "/mjpegfeed",
)
USER_AGENT = f"VigIA/{VERSION}"
HOST_RE = re.compile(r"^[A-Za-z0-9.\-]+$")
MAX_SNAPSHOT_BYTES = 8 * 1024 * 1024
DROIDCAM_OBS_TIMEOUT = 3.0


class CameraError(Exception):
    """Error controlado al intentar abrir el stream de la camara."""


def parse_target(host_raw: str, port_raw: str | int | None) -> tuple[str, int]:
    """Normaliza la IP/URL y el puerto introducidos por el usuario."""
    host_raw = (host_raw or "").strip()
    if not host_raw:
        raise ValueError("Escribe la IP o la URL de DroidCam.")

    port = DEFAULT_CAMERA_PORT
    if port_raw not in (None, ""):
        try:
            port = int(str(port_raw).strip())
        except (TypeError, ValueError) as exc:
            raise ValueError("El puerto debe ser un numero entero.") from exc

    if host_raw.startswith(("http://", "https://")):
        parsed = urlparse(host_raw)
        host = parsed.hostname or ""
        if parsed.port:
            port = parsed.port
    else:
        host = host_raw.strip().strip("/")
        # Permite pegar "172.20.10.2:4747/video" en el campo de IP.
        host = host.split("/", 1)[0].split("?", 1)[0]
        # Permite pegar "172.20.10.2:4747" en el campo de IP.
        if host.count(":") == 1:
            maybe_host, maybe_port = host.rsplit(":", 1)
            if maybe_port.isdigit():
                host = maybe_host
                port = int(maybe_port)

    host = host.strip("[]")
    if not host or not HOST_RE.match(host):
        raise ValueError("La IP o el nombre del host no es valido.")

    if not (1 <= port <= 65535):
        raise ValueError("El puerto debe estar entre 1 y 65535.")

    return host, port


def normalize_resolution(value: str | None) -> str:
    """Valida una resolucion tipo 1280x720 y devuelve un valor seguro."""
    text = str(value or "").strip().lower().replace("×", "x").replace(" ", "")
    if not text or not RESOLUTION_RE.match(text):
        return DEFAULT_RESOLUTION

    width_text, height_text = text.split("x", 1)
    width = int(width_text)
    height = int(height_text)
    if not (160 <= width <= 4096 and 120 <= height <= 2160):
        return DEFAULT_RESOLUTION
    return f"{width}x{height}"


JPEG_SOI = b"\xff\xd8"
JPEG_EOI = b"\xff\xd9"
MAX_STREAM_BUFFER = 12 * 1024 * 1024


def extract_jpeg_frames(buffer: bytearray) -> list[bytes]:
    """
    Extrae los JPEG completos que van llegando por el stream MJPEG.

    El buffer se conserva entre lecturas para no perder fotogramas que
    queden partidos entre dos trozos de red. Los datos se copian, nunca se
    modifican: al navegador le sigue llegando el stream original intacto.
    """
    frames: list[bytes] = []

    while True:
        start = buffer.find(JPEG_SOI)
        if start < 0:
            # Conservar el ultimo byte por si el marcador queda partido.
            if len(buffer) > 1:
                del buffer[:-1]
            return frames

        if start:
            del buffer[:start]

        end = buffer.find(JPEG_EOI, 2)
        if end < 0:
            # Si el buffer crece sin encontrar el cierre, se descarta el
            # inicio corrupto para volver a sincronizar.
            if len(buffer) > MAX_STREAM_BUFFER:
                del buffer[:2]
            return frames

        frames.append(bytes(buffer[: end + 2]))
        del buffer[: end + 2]


def build_camera_paths(resolution: str) -> tuple[str, ...]:
    """Ordena las rutas de DroidCam segun la resolucion pedida.

    Se prefiere /video porque respeta el lente activo en el telefono.
    /video/force queda como ultimo recurso: puede liberar la camara, pero
    tambien fuerza una fuente distinta a la elegida por el usuario.
    """
    res = normalize_resolution(resolution)
    preferred = [
        f"/video/{res}",
        f"/mjpegfeed?{res}",
        "/video",
        "/mjpegfeed",
        f"/video/force/{res}",
    ]

    paths: list[str] = []
    for path in preferred + list(CAMERA_PATHS):
        if path not in paths:
            paths.append(path)
    return tuple(paths)


def sanitize_label(value: str | None) -> str:
    """Convierte una etiqueta libre en un sufijo seguro para el nombre."""
    text = re.sub(r"[^A-Za-z0-9._-]+", "_", str(value or "").strip())
    return text.strip("._-")[:40]


def sync_capture_to_supabase(filename: str, jpeg: bytes, metadata: dict) -> None:
    """Sube la captura en segundo plano; nunca bloquea la respuesta local."""
    try:
        result = supabase_store.save_capture(
            filename=filename, jpeg=jpeg, metadata=metadata
        )
        if result.get("ok"):
            print(f"[supabase] captura sincronizada: {filename}")
        else:
            print(
                f"[supabase] captura guardada solo en local ({filename}): "
                f"{result.get('error') or result.get('uploadError') or 'sin detalle'}"
            )
    except Exception as exc:  # noqa: BLE001 - la sync nunca debe romper la captura
        print(f"[supabase] error al sincronizar {filename}: {exc}")


def get_local_ipv4() -> str:
    """Obtiene la IP de la interfaz que usa la ruta por defecto."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("8.8.8.8", 80))
        return sock.getsockname()[0]
    except OSError:
        try:
            return socket.gethostbyname(socket.gethostname())
        except OSError:
            return ""
    finally:
        sock.close()


def port_open(host: str, port: int, timeout: float = 0.25) -> bool:
    """Comprueba si un puerto TCP acepta conexiones, sin enviar datos."""
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def open_camera_stream(
    host: str,
    port: int,
    timeout: float = 6.0,
    resolution: str = DEFAULT_RESOLUTION,
):
    """
    Prueba las rutas habituales de DroidCam y devuelve la primera que
    entregue un stream compatible. La respuesta queda abierta para leerla.
    """
    errors: list[str] = []
    paths = build_camera_paths(resolution)

    for path in paths:
        url = f"http://{host}:{port}{path}"
        request = Request(
            url,
            headers={
                "User-Agent": USER_AGENT,
                "Accept": "multipart/x-mixed-replace,image/jpeg,*/*",
            },
        )

        try:
            response = urlopen(request, timeout=timeout)
        except HTTPError as exc:
            errors.append(f"{path}: HTTP {exc.code}")
            exc.close()
            continue
        except (URLError, TimeoutError, OSError) as exc:
            reason = getattr(exc, "reason", exc)
            raise CameraError(
                f"No se pudo conectar con {host}:{port}. "
                "Verifica que DroidCam este abierto, que la IP sea correcta "
                "y que el telefono y la PC esten en la misma red. "
                f"Detalle: {reason}"
            ) from exc

        status = response.status
        content_type = response.headers.get("Content-Type", "")
        content_lower = content_type.lower()

        if status == 200 and (
            "multipart/x-mixed-replace" in content_lower
            or "image/jpeg" in content_lower
        ):
            return response, url, content_type

        # DroidCam devuelve una pagina HTML cuando otro cliente ya tiene la
        # camara tomada. Es el caso tipico del cliente de Windows conectado.
        if status == 200 and "text/html" in content_lower:
            try:
                body = response.read(8192).decode("utf-8", "ignore").lower()
            except (TimeoutError, OSError):
                body = ""
            response.close()
            if "droidcam is busy" in body or "busy" in body:
                raise CameraError(
                    "DroidCam esta ocupado por otra conexion. "
                    "Normalmente es el cliente de DroidCam en Windows. "
                    "Pulsa Stop/Detener en ese cliente o cierralo por completo, "
                    "y vuelve a pulsar Conectar en VigIA."
                )
            errors.append(f"{path}: respuesta 200 (pagina web de DroidCam)")
            continue

        response.close()
        errors.append(
            f"{path}: respuesta {status} ({content_type or 'sin tipo'})"
        )

    detail = " | ".join(errors)
    if any("text/html" in error.lower() for error in errors):
        raise CameraError(
            "DroidCam respondio con una pagina web, no con un stream de video. "
            f"Abre http://{host}:{port}/ en el navegador para ver la interfaz de DroidCam "
            "y confirma que la camara IP este activa. Si el cliente de Windows esta "
            "conectado, la web intento tomar la camara con /video/force. "
            f"Detalle: {detail}"
        )

    raise CameraError(
        "DroidCam respondio, pero no se encontro un stream compatible. "
        f"Rutas probadas: {', '.join(paths)}. "
        f"Detalle: {detail}"
    )


def read_remote_text(url: str, method: str = "GET", timeout: float = DROIDCAM_OBS_TIMEOUT) -> str:
    """Lee una respuesta de texto corta de la API remota de DroidCam OBS."""
    request = Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "text/plain, application/json, */*",
        },
        method=method,
    )
    with urlopen(request, timeout=timeout) as response:
        return response.read(8192).decode("utf-8", "replace")


def change_droidcam_lens(host: str, port: int, lens: str) -> dict:
    """Intenta cambiar el lente real usando la API v1 de DroidCam OBS.

    DroidCam clasico no expone esta funcion por HTTP. En ese caso se
    devuelve supported=False para que la interfaz muestre las instrucciones
    de Camera Swap en el telefono.
    """
    base = f"http://{host}:{port}/v1"
    try:
        raw = read_remote_text(f"{base}/camera/camera_list")
    except HTTPError as exc:
        code = exc.code
        exc.close()
        message = (
            "DroidCam clásico no permite cambiar de lente por HTTP. "
            "Usá Camera Swap en el teléfono o instalá DroidCam OBS."
            if code == 404
            else f"DroidCam respondió HTTP {code} al consultar los lentes."
        )
        return {
            "supported": False,
            "changed": False,
            "cameras": [],
            "active": None,
            "activeName": "",
            "message": message,
        }
    except (URLError, OSError, TimeoutError) as exc:
        return {
            "supported": False,
            "changed": False,
            "cameras": [],
            "active": None,
            "activeName": "",
            "message": f"No se pudo consultar la API de lentes de DroidCam: {exc}",
        }

    if raw.lstrip().startswith("<"):
        return {
            "supported": False,
            "changed": False,
            "cameras": [],
            "active": None,
            "activeName": "",
            "message": (
                "DroidCam clásico devolvió su interfaz web, no la API de lentes. "
                "Usá Camera Swap en el teléfono o instalá DroidCam OBS."
            ),
        }

    cameras: list[str] = []
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, list):
            cameras = [str(item).strip() for item in parsed if str(item).strip()]
        elif isinstance(parsed, dict):
            listed = parsed.get("cameras") or parsed.get("camera_list") or []
            if isinstance(listed, list):
                cameras = [str(item).strip() for item in listed if str(item).strip()]
    except (TypeError, ValueError):
        cameras = [
            line.strip()
            for line in raw.replace("\r", "\n").split("\n")
            if line.strip()
        ]

    if not cameras:
        return {
            "supported": False,
            "changed": False,
            "cameras": [],
            "active": None,
            "activeName": "",
            "message": (
                "DroidCam respondió pero no informó una lista de lentes. "
                "Verificá que sea DroidCam OBS con la cámara conectada."
            ),
        }

    patterns = {
        "back": ("back", "rear", "trasera", "environment", "world"),
        "front": ("front", "selfie", "frontal", "user"),
        "external": ("external", "usb", "externa"),
    }
    index = None
    for position, name in enumerate(cameras):
        lowered = name.lower()
        if any(token in lowered for token in patterns.get(lens, ())):
            index = position
            break

    # Algunos equipos listan dos cámaras sin nombres descriptivos. En ese
    # caso se usa el orden habitual de Android: trasera primero, frontal después.
    if index is None and len(cameras) == 2:
        if lens == "back":
            index = 0
        elif lens == "front":
            index = 1

    if index is None:
        return {
            "supported": True,
            "changed": False,
            "cameras": cameras,
            "active": None,
            "activeName": "",
            "message": "No se encontró un lente que coincida con la selección. Lentes disponibles: "
            + ", ".join(cameras),
        }

    try:
        read_remote_text(f"{base}/camera/active/{index}", method="PUT")
    except (HTTPError, URLError, OSError, TimeoutError) as exc:
        return {
            "supported": True,
            "changed": False,
            "cameras": cameras,
            "active": index,
            "activeName": cameras[index],
            "message": f"DroidCam OBS no aceptó el cambio de lente: {exc}",
        }

    return {
        "supported": True,
        "changed": True,
        "cameras": cameras,
        "active": index,
        "activeName": cameras[index],
        "message": f"Lente activo en el teléfono: {cameras[index]}",
    }


def read_first_jpeg(response, timeout: float = 8.0) -> bytes:
    """Extrae el primer fotograma JPEG completo de un stream MJPEG."""
    deadline = time.monotonic() + timeout
    buffer = bytearray()
    start = -1

    while time.monotonic() < deadline:
        try:
            chunk = getattr(response, "read1", response.read)(8192)
        except (TimeoutError, OSError):
            break

        if not chunk:
            break

        buffer.extend(chunk)

        if start < 0:
            start = buffer.find(b"\xff\xd8")

        if start >= 0:
            end = buffer.find(b"\xff\xd9", start + 2)
            if end >= 0:
                return bytes(buffer[start : end + 2])

        # Evita crecer sin limite si el stream entrega datos que no son JPEG.
        if len(buffer) > MAX_SNAPSHOT_BYTES:
            buffer = buffer[-2_000_000:]
            start = buffer.find(b"\xff\xd8")

    raise CameraError("No se pudo extraer un fotograma JPEG del stream.")


class AutecHandler(BaseHTTPRequestHandler):
    server_version = f"{APP_NAME}/{VERSION}"
    sys_version = ""

    def do_GET(self) -> None:  # noqa: N802 - nombre exigido por BaseHTTPRequestHandler
        parsed = urlparse(self.path)
        path = parsed.path
        params = parse_qs(parsed.query)

        if path in ("/", "/index.html"):
            self.serve_index()
        elif path in ("/clasico", "/clasico/", "/legacy"):
            self.serve_legacy_index()
        elif path == "/api/health":
            self.send_json(
                200,
                {
                    "ok": True,
                    "service": APP_NAME,
                    "version": VERSION,
                    "cameraPaths": list(build_camera_paths(DEFAULT_RESOLUTION)),
                    "defaultResolution": DEFAULT_RESOLUTION,
                    "capturesDir": str(CAPTURES_DIR),
                    "supabaseConfigured": supabase_store.is_configured(),
                },
            )
        elif path == "/api/supabase/health":
            self.send_json(200, supabase_store.health())
        elif path == "/api/auth/me":
            self.handle_auth_me()
        elif path.startswith("/api/db/"):
            self.handle_db_get(path[len("/api/db/") :], params)
        elif path == "/api/probe":
            self.handle_probe(params)
        elif path == "/api/stream-health":
            self.handle_stream_health()
        elif path == "/api/detections":
            self.handle_detections()
        elif path == "/api/captures":
            self.handle_captures()
        elif path == "/api/discover":
            self.handle_discover(params)
        elif path == "/stream":
            self.handle_stream(params)
        elif path == "/snapshot":
            self.handle_snapshot(params)
        elif path == "/favicon.ico":
            self.send_response(204)
            self.end_headers()
        elif path.startswith("/api/"):
            self.send_json(404, {"ok": False, "error": "Ruta no encontrada."})
        else:
            self.serve_static(path)

    def do_POST(self) -> None:  # noqa: N802 - nombre exigido por BaseHTTPRequestHandler
        parsed = urlparse(self.path)
        if parsed.path == "/api/auth/login":
            self.handle_login()
        elif parsed.path == "/api/auth/logout":
            self.handle_logout()
        elif parsed.path == "/api/capture":
            if not self.require_auth(): return
            self.handle_capture(parse_qs(parsed.query))
        elif parsed.path == "/api/camera/lens":
            self.handle_camera_lens()
        elif parsed.path == "/api/events":
            if not self.require_auth(): return
            self.handle_event()
        elif parsed.path == "/api/metrics":
            if not self.require_auth(): return
            self.handle_metric()
        elif parsed.path.startswith("/api/db/"):
            if not self.require_auth(): return
            self.handle_db_write("POST", parsed.path[len("/api/db/") :], parse_qs(parsed.query))
        else:
            self.send_json(404, {"ok": False, "error": "Ruta no encontrada."})

    def do_PATCH(self) -> None:  # noqa: N802 - nombre exigido por BaseHTTPRequestHandler
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/db/"):
            if not self.require_auth(): return
            self.handle_db_write("PATCH", parsed.path[len("/api/db/") :], parse_qs(parsed.query))
        else:
            self.send_json(404, {"ok": False, "error": "Ruta no encontrada."})

    def do_DELETE(self) -> None:  # noqa: N802 - nombre exigido por BaseHTTPRequestHandler
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/db/"):
            if not self.require_auth(): return
            self.handle_db_write("DELETE", parsed.path[len("/api/db/") :], parse_qs(parsed.query))
        else:
            self.send_json(404, {"ok": False, "error": "Ruta no encontrada."})

    def do_OPTIONS(self) -> None:  # noqa: N802 - nombre exigido por BaseHTTPRequestHandler
        self.send_response(204)
        self.end_headers()

    def end_headers(self) -> None:
        # La maqueta tambien puede servirse desde otro puerto local durante
        # el desarrollo. El video y las detecciones son datos locales.
        origin = self.headers.get("Origin", "")
        allowed_origins = {
            "http://127.0.0.1:8000", "http://localhost:8000",
            "http://127.0.0.1:8081", "http://localhost:8081",
        }
        self.send_header(
            "Access-Control-Allow-Origin",
            origin if origin in allowed_origins else "*",
        )
        self.send_header("Access-Control-Allow-Credentials", "true")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
        self.send_header(
            "Access-Control-Allow-Headers",
            "Content-Type, apikey, Authorization, Prefer, x-upsert",
        )
        super().end_headers()

    def serve_index(self) -> None:
        self.serve_file(MOCKUP_INDEX_FILE, missing="No se encontro mockup/index.html junto a server.py.")

    def serve_legacy_index(self) -> None:
        self.serve_file(LEGACY_INDEX_FILE, missing="No se encontro static/index.html junto a server.py.")

    def serve_static(self, path: str) -> None:
        rel = unquote(path).lstrip("/")
        if not rel:
            self.serve_index()
            return

        target = (MOCKUP_DIR / rel).resolve()
        try:
            target.relative_to(MOCKUP_DIR.resolve())
        except ValueError:
            self.send_json(404, {"ok": False, "error": "Ruta no encontrada."})
            return

        if target.is_dir():
            target = target / "index.html"

        if target.is_file():
            self.serve_file(target)
            return

        # Rutas de la SPA escritas sin hash: devolver la entrada y dejar que
        # el router del navegador resuelva la pantalla.
        if path.startswith(("/app", "/admin", "/login", "/solicitar-acceso")):
            self.serve_index()
            return

        self.send_json(404, {"ok": False, "error": "Ruta no encontrada."})

    def serve_file(self, file_path: Path, missing: str = "") -> None:
        try:
            content = file_path.read_bytes()
        except FileNotFoundError:
            self.send_json(
                500,
                {
                    "ok": False,
                    "error": missing or f"No se encontro {file_path.name}.",
                },
            )
            return

        content_type = STATIC_CONTENT_TYPES.get(file_path.suffix.lower())
        if not content_type:
            content_type = (
                mimetypes.guess_type(str(file_path))[0]
                or "application/octet-stream"
            )

        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(content)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        try:
            self.wfile.write(content)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def send_json(self, status: int, payload: dict, extra_headers: dict | None = None) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        request_id = self.headers.get("X-Request-Id") or uuid.uuid4().hex[:12]
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Request-Id", request_id)
        for key, value in (extra_headers or {}).items():
            self.send_header(key, value)
        self.end_headers()
        print(json.dumps({
            "ts": datetime.now(timezone.utc).isoformat(),
            "level": "error" if status >= 500 else "info",
            "requestId": request_id,
            "method": self.command,
            "path": urlparse(self.path).path,
            "status": status,
        }, ensure_ascii=False), flush=True)
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def target_from_params(self, params: dict) -> tuple[str, int]:
        host = (params.get("host") or [""])[0]
        port = (params.get("port") or [str(DEFAULT_CAMERA_PORT)])[0]
        return parse_target(host, port)

    def handle_camera_lens(self) -> None:
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length <= 0 or length > 4096:
            self.send_json(
                400,
                {
                    "ok": False,
                    "error": "La solicitud de lente esta vacia o es demasiado grande.",
                },
            )
            return

        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeDecodeError, ValueError):
            self.send_json(
                400,
                {"ok": False, "error": "La solicitud de lente no es JSON valido."},
            )
            return
        if not isinstance(payload, dict):
            self.send_json(
                400,
                {"ok": False, "error": "La solicitud de lente no es un objeto JSON."},
            )
            return

        try:
            host, port = parse_target(
                payload.get("host", ""), payload.get("port", DEFAULT_CAMERA_PORT)
            )
        except ValueError as exc:
            self.send_json(400, {"ok": False, "error": str(exc)})
            return

        lens = str(payload.get("lens") or "unknown").strip().lower()
        if lens not in ("back", "front", "external", "unknown"):
            lens = "unknown"

        result = change_droidcam_lens(host, port, lens)
        print(
            f"[lens] {host}:{port} -> {lens} "
            f"(supported={result.get('supported')}, changed={result.get('changed')})"
        )
        self.send_json(
            200,
            {
                "ok": True,
                "lens": lens,
                "host": host,
                "port": port,
                **result,
            },
        )

    def handle_probe(self, params: dict) -> None:
        try:
            host, port = self.target_from_params(params)
            resolution = normalize_resolution(
                (params.get("res") or [DEFAULT_RESOLUTION])[0]
            )
            response, url, content_type = open_camera_stream(
                host, port, timeout=3.0, resolution=resolution
            )
            response.close()
            self.send_json(
                200,
                {
                    "ok": True,
                    "url": url,
                    "contentType": content_type,
                    "host": host,
                    "port": port,
                    "resolution": resolution,
                },
            )
        except ValueError as exc:
            self.send_json(400, {"ok": False, "error": str(exc)})
        except CameraError as exc:
            self.send_json(502, {"ok": False, "error": str(exc)})
        except Exception as exc:  # noqa: BLE001 - ultimo recurso para el navegador
            self.send_json(
                500, {"ok": False, "error": f"Error inesperado: {exc}"}
            )

    def handle_stream(self, params: dict) -> None:
        try:
            host, port = self.target_from_params(params)
            resolution = normalize_resolution(
                (params.get("res") or [DEFAULT_RESOLUTION])[0]
            )
            response, url, content_type = open_camera_stream(
                host, port, resolution=resolution
            )
        except ValueError as exc:
            self.send_json(400, {"ok": False, "error": str(exc)})
            return
        except CameraError as exc:
            self.send_json(502, {"ok": False, "error": str(exc)})
            return
        except Exception as exc:  # noqa: BLE001
            self.send_json(
                500, {"ok": False, "error": f"Error inesperado: {exc}"}
            )
            return

        print(f"[stream] {url} ({content_type})")

        source_changed = False
        with STREAM_LOCK:
            previous_url = STREAM_STATE["url"]
            if previous_url and previous_url != url and STREAM_STATE["active"] > 0:
                source_changed = True
            STREAM_STATE["active"] += 1
            STREAM_STATE["startedAt"] = time.monotonic()
            STREAM_STATE["lastChunkAt"] = time.monotonic()
            STREAM_STATE["chunks"] = 0
            STREAM_STATE["frames"] = 0
            STREAM_STATE["url"] = url

        # Si se cambia de camara sin cerrar el stream anterior, se descartan
        # los tracks del detector para no mezclar identidades entre fuentes.
        if source_changed:
            detector.reset()

        try:
            self.send_response(200)
            self.send_header(
                "Content-Type",
                content_type or "multipart/x-mixed-replace; boundary=frame",
            )
            self.send_header(
                "Cache-Control", "no-store, no-cache, must-revalidate, max-age=0"
            )
            self.send_header("Pragma", "no-cache")
            self.send_header("Connection", "close")
            self.end_headers()

            frame_buffer = bytearray()
            read_chunk = getattr(response, "read1", response.read)
            while True:
                chunk = read_chunk(16384)
                if not chunk:
                    break
                self.wfile.write(chunk)
                self.wfile.flush()
                frame_buffer.extend(chunk)
                frames = extract_jpeg_frames(frame_buffer)
                for jpeg in frames:
                    detector.offer_frame(jpeg)
                with STREAM_LOCK:
                    STREAM_STATE["lastChunkAt"] = time.monotonic()
                    STREAM_STATE["chunks"] += 1
                    STREAM_STATE["frames"] += len(frames)
        except (
            BrokenPipeError,
            ConnectionResetError,
            ConnectionAbortedError,
            TimeoutError,
            OSError,
        ):
            pass
        finally:
            response.close()
            idle = False
            with STREAM_LOCK:
                STREAM_STATE["active"] = max(0, STREAM_STATE["active"] - 1)
                if STREAM_STATE["active"] == 0:
                    STREAM_STATE["lastChunkAt"] = 0.0
                    STREAM_STATE["url"] = ""
                    idle = True
            if idle:
                detector.reset()
            self.close_connection = True

    def handle_detections(self) -> None:
        self.send_json(200, detector.snapshot())

    def handle_stream_health(self) -> None:
        with STREAM_LOCK:
            active = STREAM_STATE["active"]
            last_chunk = STREAM_STATE["lastChunkAt"]
            chunks = STREAM_STATE["chunks"]
            frames = STREAM_STATE["frames"]
            url = STREAM_STATE["url"]

        age = None
        if last_chunk:
            age = round(max(0.0, time.monotonic() - last_chunk), 2)

        self.send_json(
            200,
            {
                "ok": True,
                "active": active,
                "ageSeconds": age,
                "chunks": chunks,
                "frames": frames,
                "url": url,
            },
        )

    def session_token(self) -> str:
        """Lee el token de sesión de la cookie HttpOnly."""
        try:
            cookie = SimpleCookie()
            cookie.load(self.headers.get("Cookie", ""))
            morsel = cookie.get(auth_store.SESSION_COOKIE)
            return morsel.value if morsel else ""
        except Exception:  # noqa: BLE001 - una cookie rota no debe romper el server
            return ""

    def current_session(self) -> dict | None:
        return auth_store.get_session(self.session_token())

    def require_auth(self) -> dict | None:
        """Devuelve la sesión o responde 401. El caller debe cortar si es None."""
        session = self.current_session()
        if not session:
            self.send_json(401, {"ok": False, "error": "Sesión no válida o vencida."})
            return None
        return session

    def handle_login(self) -> None:
        try:
            payload = self.read_json_body(64 * 1024)
        except ValueError as exc:
            self.send_json(400, {"ok": False, "error": str(exc)})
            return
        if not isinstance(payload, dict):
            self.send_json(400, {"ok": False, "error": "El cuerpo debe ser un objeto JSON."})
            return

        if not supabase_store.is_configured():
            self.send_json(503, {"ok": False, "error": "Supabase no está configurado."})
            return

        profile = auth_store.authenticate(payload.get("email", ""), payload.get("password", ""))
        if not profile:
            self.send_json(401, {"ok": False, "error": "Email o contraseña incorrectos."})
            return

        ip = self.headers.get("X-Forwarded-For", "").split(",")[0].strip()
        ip = ip or (self.client_address[0] if self.client_address else "")
        token = auth_store.create_session(profile, ip)
        max_age = auth_store.SESSION_HOURS * 3600
        cookie = (
            f"{auth_store.SESSION_COOKIE}={token}; HttpOnly; SameSite=Lax; "
            f"Path=/; Max-Age={max_age}{self.cookie_secure_flag()}"
        )
        self.send_json(
            200,
            {
                "ok": True,
                "profile": auth_store.public_profile(profile),
                "expiresIn": max_age,
            },
            extra_headers={"Set-Cookie": cookie},
        )

    def handle_logout(self) -> None:
        auth_store.end_session(self.session_token())
        cookie = (
            f"{auth_store.SESSION_COOKIE}=; HttpOnly; SameSite=Lax; "
            f"Path=/; Max-Age=0{self.cookie_secure_flag()}"
        )
        self.send_json(200, {"ok": True}, extra_headers={"Set-Cookie": cookie})

    def cookie_secure_flag(self) -> str:
        """La cookie viaja con Secure cuando la peticion llega por HTTPS."""
        forwarded = self.headers.get("X-Forwarded-Proto", "").split(",")[0].strip()
        origin = self.headers.get("Origin", "")
        if forwarded.lower() == "https" or origin.lower().startswith("https://"):
            return "; Secure"
        return ""

    def handle_auth_me(self) -> None:
        session = self.current_session()
        if not session:
            # Responder 200 con profile null evita ruido en la consola del
            # navegador cuando se comprueba la sesión al cargar la página.
            self.send_json(200, {"ok": True, "authenticated": False, "profile": None})
            return
        self.send_json(
            200,
            {
                "ok": True,
                "authenticated": True,
                "profile": auth_store.public_profile(session["profile"]),
                "sessionId": session["session"].get("id"),
            },
        )

    def read_json_body(self, max_bytes: int = 4 * 1024 * 1024):
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError as exc:
            raise ValueError("Content-Length inválido.") from exc
        if length <= 0:
            raise ValueError("El cuerpo JSON está vacío.")
        if length > max_bytes:
            raise ValueError("El cuerpo JSON es demasiado grande.")
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeDecodeError, ValueError) as exc:
            raise ValueError("El cuerpo no es JSON válido.") from exc
        return payload

    @staticmethod
    def db_query(params: dict) -> dict:
        """Convierte parámetros locales en parámetros de PostgREST."""
        operators = (
            "eq.", "neq.", "gt.", "gte.", "lt.", "lte.", "in.",
            "like.", "ilike.", "is.", "cs.", "cd.", "ov.",
        )
        query: dict[str, str] = {}
        for key, values in params.items():
            if not values:
                continue
            value = str(values[0])
            if key in {"select", "order", "limit", "offset", "or", "and"} or value.startswith(operators):
                query[key] = value
            else:
                query[key] = f"eq.{value}"
        query.setdefault("select", "*")
        return query

    def handle_supabase_health(self) -> None:
        self.send_json(200, supabase_store.health())

    def handle_db_get(self, table: str, params: dict) -> None:
        table = table.strip("/").split("/")[0]
        if table not in supabase_store.TABLES:
            self.send_json(404, {"ok": False, "error": f"Tabla no permitida: {table}"})
            return
        try:
            rows = supabase_store.fetch(table, self.db_query(params), admin=False)
        except supabase_store.SupabaseError as exc:
            self.send_json(502, {"ok": False, "error": str(exc)})
            return
        self.send_json(200, {"ok": True, "data": rows})

    def handle_db_write(self, method: str, table: str, params: dict) -> None:
        table = table.strip("/").split("/")[0]
        if table not in supabase_store.TABLES:
            self.send_json(404, {"ok": False, "error": f"Tabla no permitida: {table}"})
            return
        try:
            if method == "POST":
                payload = self.read_json_body()
                on_conflict = (params.get("on_conflict") or [None])[0]
                result = supabase_store.insert(table, payload, on_conflict=on_conflict)
            elif method == "PATCH":
                payload = self.read_json_body()
                filters = {key: values[0] for key, values in params.items() if values}
                if not filters:
                    raise ValueError("PATCH requiere al menos un filtro.")
                result = supabase_store.update(table, filters, payload)
            elif method == "DELETE":
                filters = {key: values[0] for key, values in params.items() if values}
                if not filters:
                    raise ValueError("DELETE requiere al menos un filtro.")
                result = supabase_store.delete(table, filters)
            else:
                self.send_json(405, {"ok": False, "error": "Método no permitido."})
                return
        except ValueError as exc:
            self.send_json(400, {"ok": False, "error": str(exc)})
            return
        except supabase_store.SupabaseError as exc:
            self.send_json(502, {"ok": False, "error": str(exc)})
            return
        self.send_json(200, {"ok": True, "data": result})

    def handle_event(self) -> None:
        try:
            payload = self.read_json_body()
        except ValueError as exc:
            self.send_json(400, {"ok": False, "error": str(exc)})
            return
        if not isinstance(payload, dict):
            self.send_json(400, {"ok": False, "error": "El evento debe ser un objeto JSON."})
            return
        result = supabase_store.insert_event(payload)
        self.send_json(200 if result.get("ok") else 502, result)

    def handle_metric(self) -> None:
        try:
            payload = self.read_json_body()
        except ValueError as exc:
            self.send_json(400, {"ok": False, "error": str(exc)})
            return
        if not isinstance(payload, dict):
            self.send_json(400, {"ok": False, "error": "La métrica debe ser un objeto JSON."})
            return
        result = supabase_store.insert_metric(payload)
        self.send_json(200 if result.get("ok") else 502, result)

    def handle_captures(self) -> None:
        try:
            CAPTURES_DIR.mkdir(parents=True, exist_ok=True)
            files = sorted(
                CAPTURES_DIR.glob("*.jpg"),
                key=lambda path: path.stat().st_mtime,
                reverse=True,
            )
            self.send_json(
                200,
                {
                    "ok": True,
                    "dir": str(CAPTURES_DIR),
                    "count": len(files),
                    "recent": [path.name for path in files[:5]],
                },
            )
        except OSError as exc:
            self.send_json(
                500,
                {
                    "ok": False,
                    "error": f"No se pudo leer la carpeta de capturas: {exc}",
                },
            )

    def handle_capture(self, params: dict) -> None:
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0

        if length <= 0:
            self.send_json(400, {"ok": False, "error": "La captura esta vacia."})
            return
        if length > MAX_CAPTURE_BYTES:
            self.send_json(
                413,
                {
                    "ok": False,
                    "error": "La captura es demasiado grande (maximo 12 MB).",
                },
            )
            return

        body = self.rfile.read(length)
        if not (
            body.startswith(b"\xff\xd8")
            and body.rstrip().endswith(b"\xff\xd9")
        ):
            self.send_json(
                400,
                {"ok": False, "error": "El archivo recibido no es un JPEG valido."},
            )
            return

        label = sanitize_label((params.get("label") or [""])[0])
        mode = sanitize_label((params.get("mode") or ["camera"])[0]) or "camera"
        host = str((params.get("host") or [""])[0])[:80]
        port = str((params.get("port") or [""])[0])[:10]
        resolution = str((params.get("resolution") or [""])[0])[:20]
        zone = str((params.get("zone") or [""])[0]).strip()[:80]
        event = sanitize_label((params.get("event") or [""])[0])[:40]
        company_id = sanitize_label((params.get("companyId") or [""])[0])[:80]
        camera_id = sanitize_label((params.get("cameraId") or [""])[0])[:80]
        profile = sanitize_label((params.get("profile") or [""])[0])[:40]
        track_id = str((params.get("trackId") or [""])[0]).strip()[:40]
        table = str((params.get("table") or [""])[0]).strip()[:80]
        try:
            fall_seconds = round(
                float((params.get("fallSeconds") or [""])[0]), 1
            )
        except (TypeError, ValueError):
            fall_seconds = None
        if fall_seconds is not None:
            fall_seconds = max(0.0, min(3600.0, fall_seconds))
        simulated = str((params.get("simulated") or ["0"])[0]).strip().lower() in {
            "1",
            "true",
            "yes",
            "si",
        }
        missing = []
        for raw in str((params.get("missing") or [""])[0]).split(","):
            item = sanitize_label(raw)
            if item and item not in missing:
                missing.append(item)
        missing = missing[:8]

        try:
            with CAPTURE_LOCK:
                CAPTURES_DIR.mkdir(parents=True, exist_ok=True)
                stamp = time.strftime("%Y%m%d_%H%M%S")
                millis = int((time.time() % 1) * 1000)
                suffix = f"_{label}" if label else ""
                filename = f"{stamp}_{millis:03d}{suffix}.jpg"
                counter = 1
                while (CAPTURES_DIR / filename).exists():
                    filename = f"{stamp}_{millis:03d}_{counter}{suffix}.jpg"
                    counter += 1

                file_path = CAPTURES_DIR / filename
                file_path.write_bytes(body)
                metadata = {
                    "filename": filename,
                    "capturedAt": datetime.now()
                    .astimezone()
                    .isoformat(timespec="seconds"),
                    "label": label,
                    "mode": mode,
                    "zone": zone,
                    "event": event,
                    "host": host,
                    "port": port,
                    "resolution": resolution,
                    "bytes": len(body),
                    "appVersion": VERSION,
                    "profile": profile,
                    "trackId": track_id,
                    "missing": missing,
                    "table": table,
                    "fallSeconds": fall_seconds,
                    "simulated": simulated,
                    "epp": event == "epp" or simulated or bool(profile) or bool(missing),
                    "companyId": company_id,
                    "cameraId": camera_id,
                }
                file_path.with_suffix(".json").write_text(
                    json.dumps(metadata, ensure_ascii=False, indent=2),
                    encoding="utf-8",
                )
                count = len(list(CAPTURES_DIR.glob("*.jpg")))

            if supabase_store.is_configured():
                threading.Thread(
                    target=sync_capture_to_supabase,
                    args=(filename, body, metadata),
                    daemon=True,
                ).start()

            print(f"[capture] {filename} ({len(body)} bytes)")
            self.send_json(
                200,
                {
                    "ok": True,
                    "filename": filename,
                    "path": str(file_path),
                    "count": count,
                    "label": label,
                },
            )
        except OSError as exc:
            self.send_json(
                500,
                {
                    "ok": False,
                    "error": f"No se pudo guardar la captura: {exc}",
                },
            )

    def handle_discover(self, params: dict) -> None:
        if not DISCOVER_LOCK.acquire(blocking=False):
            self.send_json(
                429,
                {
                    "ok": False,
                    "error": "Ya hay una busqueda de camara en curso.",
                },
            )
            return

        try:
            try:
                port = int(str((params.get("port") or [DEFAULT_CAMERA_PORT])[0]))
            except (TypeError, ValueError) as exc:
                raise ValueError("El puerto debe ser un numero entero.") from exc
            if not (1 <= port <= 65535):
                raise ValueError("El puerto debe estar entre 1 y 65535.")

            local_ip = get_local_ipv4()
            if not local_ip:
                raise ValueError("No se pudo determinar la red local de la PC.")

            address = ipaddress.ip_address(local_ip)
            if not address.is_private or address.is_loopback:
                raise ValueError(
                    "La PC no esta en una red privada; no se puede buscar "
                    "la camara automaticamente."
                )

            network = ipaddress.ip_network(f"{local_ip}/24", strict=False)
            hosts = [
                str(host) for host in network.hosts() if str(host) != local_ip
            ]

            open_hosts: list[str] = []
            with ThreadPoolExecutor(max_workers=64) as pool:
                futures = {
                    pool.submit(port_open, host, port, 0.25): host
                    for host in hosts
                }
                for future in as_completed(futures):
                    if future.result():
                        open_hosts.append(futures[future])

            candidates = []
            for host in open_hosts:
                verified = False
                try:
                    request = Request(
                        f"http://{host}:{port}/",
                        headers={"User-Agent": USER_AGENT},
                    )
                    with urlopen(request, timeout=1.0) as response:
                        body = response.read(4096).lower()
                        verified = b"droidcam" in body
                except (HTTPError, URLError, TimeoutError, OSError):
                    pass

                candidates.append(
                    {"ip": host, "port": port, "verified": verified}
                )

            candidates.sort(key=lambda item: (not item["verified"], item["ip"]))
            self.send_json(
                200,
                {
                    "ok": True,
                    "localIp": local_ip,
                    "subnet": str(network),
                    "candidates": candidates,
                },
            )
        except ValueError as exc:
            self.send_json(400, {"ok": False, "error": str(exc)})
        except Exception as exc:  # noqa: BLE001
            self.send_json(
                500,
                {"ok": False, "error": f"Error inesperado al buscar: {exc}"},
            )
        finally:
            DISCOVER_LOCK.release()

    def handle_snapshot(self, params: dict) -> None:
        try:
            host, port = self.target_from_params(params)
            resolution = normalize_resolution(
                (params.get("res") or [DEFAULT_RESOLUTION])[0]
            )
            response, _url, _content_type = open_camera_stream(
                host, port, resolution=resolution
            )
            try:
                jpeg = read_first_jpeg(response)
            finally:
                response.close()
        except ValueError as exc:
            self.send_json(400, {"ok": False, "error": str(exc)})
            return
        except CameraError as exc:
            self.send_json(502, {"ok": False, "error": str(exc)})
            return
        except Exception as exc:  # noqa: BLE001
            self.send_json(
                500, {"ok": False, "error": f"Error inesperado: {exc}"}
            )
            return

        filename = time.strftime("autec_vision_%Y%m%d_%H%M%S.jpg")
        self.send_response(200)
        self.send_header("Content-Type", "image/jpeg")
        self.send_header("Content-Length", str(len(jpeg)))
        self.send_header(
            "Content-Disposition", f'attachment; filename="{filename}"'
        )
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        try:
            self.wfile.write(jpeg)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def log_message(self, fmt: str, *args) -> None:
        # Mantiene la consola limpia; los errores importantes se imprimen
        # desde los manejadores correspondientes.
        if not self.path.startswith(
            ("/stream", "/snapshot", "/api/stream-health", "/api/detections")
        ):
            print(f"[web] {self.command} {self.path}")


class AutecHTTPServer(ThreadingHTTPServer):
    """Servidor local que no comparte el puerto con otra instancia."""

    allow_reuse_address = False
    daemon_threads = True

    def handle_error(self, request, client_address) -> None:  # noqa: ANN001
        # El navegador corta conexiones al desconectar o recargar. No es un
        # error real y no debe llenar la consola de trazas.
        exc = sys.exc_info()[1]
        if isinstance(
            exc,
            (
                ConnectionResetError,
                ConnectionAbortedError,
                BrokenPipeError,
                TimeoutError,
            ),
        ):
            return
        super().handle_error(request, client_address)


def main() -> None:
    port = DEFAULT_PORT
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            print("Uso: python server.py [puerto]")
            return

    if not MOCKUP_INDEX_FILE.exists():
        print(f"ERROR: no existe {MOCKUP_INDEX_FILE}")
        print("Ejecuta server.py desde la carpeta del proyecto.")
        return

    if not LEGACY_INDEX_FILE.exists():
        print(f"ADVERTENCIA: no existe {LEGACY_INDEX_FILE} (la vista clasica no estara disponible).")

    try:
        CAPTURES_DIR.mkdir(parents=True, exist_ok=True)
    except OSError as exc:
        print(f"ADVERTENCIA: no se pudo crear {CAPTURES_DIR}: {exc}")

    try:
        server = AutecHTTPServer(("127.0.0.1", port), AutecHandler)
    except OSError as exc:
        print(f"ERROR: no se pudo abrir el puerto {port}: {exc}")
        print("Cierra el programa que usa ese puerto o ejecuta:")
        print(f"  python server.py {port + 1}")
        return

    print("=" * 62)
    print(f" {APP_NAME} v{VERSION} - Visor + deteccion local de personas")
    print(f" Abre en tu navegador: http://localhost:{port}")
    print(" No cierres esta ventana. Ctrl+C para detener.")
    print(f" Capturas del dataset: {CAPTURES_DIR}")
    print(" Rutas de camara que se probaran:")
    for path in CAMERA_PATHS:
        print(f"   - {path}")
    print("=" * 62)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido.")
    finally:
        detector.stop()
        server.server_close()


if __name__ == "__main__":
    main()
