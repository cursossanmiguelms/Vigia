#!/usr/bin/env python3
"""Cliente Supabase del servidor local de VigIA.

Toda la información persistente se guarda en Supabase. Este módulo usa la
service role key (o la secret key) desde `.env`; esa clave nunca se envía al
navegador. Las lecturas públicas se hacen con la publishable key.

La autenticación sigue siendo simple/demo hasta que se integre Clerk. Cuando
eso ocurra, este módulo podrá pasar el JWT del usuario en `Authorization`.
"""

from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen

BASE_DIR = Path(__file__).resolve().parent
ENV_FILE = BASE_DIR / ".env"

TABLES = {
    "plans",
    "companies",
    "profiles",
    "skills",
    "company_skills",
    "access_requests",
    "sessions",
    "audit_log",
    "notifications",
    "payments",
    "cameras",
    "zones",
    "app_configs",
    "captures",
    "alert_events",
    "monitoring_metrics",
}


def load_env(path: Path = ENV_FILE) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for raw in path.read_text(encoding="utf-8-sig").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


_ENV = load_env()
SUPABASE_URL = (
    os.environ.get("SUPABASE_URL") or _ENV.get("SUPABASE_URL") or ""
).rstrip("/")
PUBLISHABLE_KEY = (
    os.environ.get("SUPABASE_PUBLISHABLE_KEY")
    or _ENV.get("SUPABASE_PUBLISHABLE_KEY")
    or ""
)
ADMIN_KEY = (
    os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    or _ENV.get("SUPABASE_SERVICE_ROLE_KEY")
    or os.environ.get("SUPABASE_SECRET_KEY")
    or _ENV.get("SUPABASE_SECRET_KEY")
    or ""
)
BUCKET = (
    os.environ.get("SUPABASE_CAPTURES_BUCKET")
    or _ENV.get("SUPABASE_CAPTURES_BUCKET")
    or "captures"
)


class SupabaseError(RuntimeError):
    """Error controlado al hablar con Supabase."""


def is_configured() -> bool:
    return bool(SUPABASE_URL and ADMIN_KEY)


def _headers(admin: bool = True) -> dict[str, str]:
    key = ADMIN_KEY if admin else PUBLISHABLE_KEY
    if not key:
        raise SupabaseError("No hay una clave de Supabase configurada.")
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "User-Agent": "VigIA/1.0",
    }


def request(
    method: str,
    path: str,
    *,
    payload: Any = None,
    params: dict[str, str] | None = None,
    admin: bool = True,
    extra_headers: dict[str, str] | None = None,
    timeout: float = 12.0,
) -> tuple[int, Any]:
    """Hace una petición REST/Storage y devuelve (status, cuerpo parseado)."""
    if not SUPABASE_URL:
        raise SupabaseError("Falta SUPABASE_URL en .env.")

    url = SUPABASE_URL + path
    if params:
        url += "?" + urlencode(params)

    data = None
    headers = _headers(admin=admin)
    if payload is not None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if extra_headers:
        headers.update(extra_headers)

    req = Request(url, data=data, headers=headers, method=method.upper())
    try:
        with urlopen(req, timeout=timeout) as response:
            raw = response.read().decode("utf-8", errors="replace")
            status = response.status
    except HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        status = exc.code
    except (URLError, TimeoutError, OSError) as exc:
        raise SupabaseError(f"No se pudo conectar con Supabase: {exc}") from exc

    if not raw:
        return status, None
    try:
        return status, json.loads(raw)
    except ValueError:
        return status, raw


def health() -> dict[str, Any]:
    if not is_configured():
        return {"ok": False, "configured": False, "error": "Supabase no está configurado."}
    try:
        status, rows = request(
            "GET",
            "/rest/v1/plans",
            params={"select": "id", "limit": "1"},
            timeout=6.0,
        )
    except SupabaseError as exc:
        return {"ok": False, "configured": True, "error": str(exc)}
    return {
        "ok": 200 <= status < 300,
        "configured": True,
        "status": status,
        "url": SUPABASE_URL,
        "tables": len(rows) if isinstance(rows, list) else 0,
    }


def fetch(table: str, params: dict[str, str] | None = None, admin: bool = True) -> Any:
    if table not in TABLES:
        raise SupabaseError(f"Tabla no permitida: {table}")
    status, rows = request("GET", f"/rest/v1/{table}", params=params, admin=admin)
    if status >= 300:
        raise SupabaseError(f"GET {table} respondio {status}: {rows}")
    return rows


def insert(table: str, rows: list[dict] | dict, *, on_conflict: str | None = None) -> Any:
    if table not in TABLES:
        raise SupabaseError(f"Tabla no permitida: {table}")
    batch = rows if isinstance(rows, list) else [rows]
    if not batch:
        return []
    params = {"on_conflict": on_conflict} if on_conflict else None
    extra = {"Prefer": "resolution=merge-duplicates,return=minimal" if on_conflict else "return=minimal"}
    status, body = request(
        "POST",
        f"/rest/v1/{table}",
        payload=batch,
        params=params,
        extra_headers=extra,
    )
    if status >= 300:
        raise SupabaseError(f"POST {table} respondio {status}: {body}")
    return body


def update(table: str, filters: dict[str, str], row: dict) -> Any:
    if table not in TABLES:
        raise SupabaseError(f"Tabla no permitida: {table}")
    status, body = request(
        "PATCH",
        f"/rest/v1/{table}",
        payload=row,
        params={key: f"eq.{value}" for key, value in filters.items()},
        extra_headers={"Prefer": "return=minimal"},
    )
    if status >= 300:
        raise SupabaseError(f"PATCH {table} respondio {status}: {body}")
    return body


def delete(table: str, filters: dict[str, str]) -> Any:
    if table not in TABLES:
        raise SupabaseError(f"Tabla no permitida: {table}")
    status, body = request(
        "DELETE",
        f"/rest/v1/{table}",
        params={key: f"eq.{value}" for key, value in filters.items()},
        extra_headers={"Prefer": "return=minimal"},
    )
    if status >= 300:
        raise SupabaseError(f"DELETE {table} respondio {status}: {body}")
    return body


def insert_event(row: dict[str, Any]) -> dict[str, Any]:
    """Guarda un evento de alerta (llamado por el backend local)."""
    if not is_configured():
        return {"ok": False, "error": "Supabase no está configurado."}
    clean = {key: value for key, value in row.items() if key in {
        "company_id", "camera_id", "zone_id", "capture_id", "event", "message",
        "track_id", "severity", "metadata", "occurred_at",
    }}
    if not clean.get("event"):
        return {"ok": False, "error": "event es obligatorio."}
    if clean.get("company_id"):
        clean["company_id"] = _ensure_fk(
            "companies", str(clean["company_id"]),
            {"id": str(clean["company_id"]), "name": str(clean["company_id"]), "short": str(clean["company_id"])[:6].upper()},
        )
    if clean.get("camera_id"):
        clean["camera_id"] = _ensure_fk(
            "cameras", str(clean["camera_id"]),
            {"id": str(clean["camera_id"]), "company_id": clean.get("company_id"), "name": str(clean["camera_id"])},
        )
    clean.setdefault("occurred_at", datetime.now(timezone.utc).isoformat())
    try:
        insert("alert_events", clean)
    except SupabaseError as exc:
        return {"ok": False, "error": str(exc)}
    return {"ok": True}


def insert_metric(row: dict[str, Any]) -> dict[str, Any]:
    """Guarda un snapshot de métricas de monitoreo."""
    if not is_configured():
        return {"ok": False, "error": "Supabase no está configurado."}
    allowed = {
        "company_id", "camera_id", "persons", "visible_persons",
        "tracked_persons", "unique_persons", "fps", "inference_ms",
        "epp_compliance", "metadata", "recorded_at",
    }
    clean = {key: value for key, value in row.items() if key in allowed}
    if clean.get("company_id"):
        clean["company_id"] = _ensure_fk(
            "companies", str(clean["company_id"]),
            {"id": str(clean["company_id"]), "name": str(clean["company_id"]), "short": str(clean["company_id"])[:6].upper()},
        )
    if clean.get("camera_id"):
        clean["camera_id"] = _ensure_fk(
            "cameras", str(clean["camera_id"]),
            {"id": str(clean["camera_id"]), "company_id": clean.get("company_id"), "name": str(clean["camera_id"])},
        )
    clean.setdefault("recorded_at", datetime.now(timezone.utc).isoformat())
    try:
        insert("monitoring_metrics", clean)
    except SupabaseError as exc:
        return {"ok": False, "error": str(exc)}
    return {"ok": True}


def _ensure_fk(table: str, value: str, row: dict[str, Any]) -> str | None:
    """Crea la fila referenciada si aún no existe; si no, devuelve None."""
    if not value:
        return None
    try:
        existing = fetch(table, {"select": "id", "id": f"eq.{value}"})
        if existing:
            return value
        insert(table, row)
        return value
    except Exception:  # noqa: BLE001 - la FK nunca debe romper la captura
        return None


def save_capture(
    *,
    filename: str,
    jpeg: bytes,
    metadata: dict[str, Any],
) -> dict[str, Any]:
    """Sube una captura a Storage y registra su metadata en la base de datos.

    Nunca falla en silencio: devuelve `ok: false` con el motivo para que el
    servidor local pueda registrarlo en consola sin interrumpir la captura.
    """
    if not is_configured():
        return {"ok": False, "error": "Supabase no está configurado."}

    raw_company_id = str(metadata.get("companyId") or metadata.get("company_id") or "")
    raw_camera_id = str(metadata.get("cameraId") or metadata.get("camera_id") or "")
    now = datetime.now(timezone.utc)

    company_id = _ensure_fk(
        "companies",
        raw_company_id,
        {
            "id": raw_company_id,
            "name": str(metadata.get("companyName") or raw_company_id),
            "short": raw_company_id[:6].upper(),
            "status": "active",
        },
    ) if raw_company_id and raw_company_id != "global" else None

    camera_id = _ensure_fk(
        "cameras",
        raw_camera_id,
        {
            "id": raw_camera_id,
            "company_id": company_id,
            "name": str(metadata.get("cameraName") or raw_camera_id),
            "active": True,
        },
    )
    storage_folder = quote(raw_company_id or "global", safe="")
    storage_path = (
        f"{storage_folder}/{now:%Y}/{now:%m}/{filename}"
    )
    object_path = f"/storage/v1/object/{BUCKET}/{storage_path}"
    public_url = (
        f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{storage_path}"
    )

    upload_error = ""
    try:
        headers = _headers()
        headers.update({
            "Content-Type": "image/jpeg",
            "x-upsert": "true",
            "Cache-Control": "3600",
        })
        req = Request(SUPABASE_URL + object_path, data=jpeg, headers=headers, method="POST")
        with urlopen(req, timeout=20) as response:
            response.read()
    except (HTTPError, URLError, TimeoutError, OSError) as exc:
        detail = ""
        if isinstance(exc, HTTPError):
            detail = exc.read().decode("utf-8", errors="replace")[:300]
        upload_error = f"{exc}{(' · ' + detail) if detail else ''}"

    capture_id = str(uuid.uuid4())
    capture_row = {
        "id": capture_id,
        "company_id": company_id,
        "camera_id": camera_id,
        "filename": filename,
        "label": str(metadata.get("label") or ""),
        "mode": str(metadata.get("mode") or "camera"),
        "event": str(metadata.get("event") or ""),
        "zone": str(metadata.get("zone") or ""),
        "storage_bucket": BUCKET,
        "storage_path": storage_path if not upload_error else "",
        "public_url": public_url if not upload_error else "",
        "metadata": {
            **metadata,
            "supabaseUploadError": upload_error,
            "uploadedAt": now.isoformat(),
        },
        "captured_at": metadata.get("capturedAt") or now.isoformat(),
    }

    try:
        insert("captures", capture_row)
    except SupabaseError as exc:
        return {"ok": False, "error": str(exc), "uploadError": upload_error}

    event_name = str(metadata.get("event") or "")
    if event_name:
        insert_event({
            "company_id": capture_row["company_id"],
            "camera_id": capture_row["camera_id"],
            "capture_id": capture_id,
            "event": event_name,
            "message": str(metadata.get("label") or event_name),
            "track_id": str(metadata.get("trackId") or ""),
            "severity": "warning" if event_name not in {"entry", "person"} else "info",
            "metadata": {
                "zone": metadata.get("zone"),
                "profile": metadata.get("profile"),
                "missing": metadata.get("missing"),
                "table": metadata.get("table"),
                "fallSeconds": metadata.get("fallSeconds"),
                "simulated": metadata.get("simulated"),
            },
            "occurred_at": capture_row["captured_at"],
        })

    return {
        "ok": not upload_error,
        "id": capture_id,
        "publicUrl": public_url if not upload_error else "",
        "error": upload_error or "",
    }
