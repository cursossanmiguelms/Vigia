"""Detector local de personas con YOLO11n + ByteTrack.

Este modulo se usa desde server.py. No abre conexiones a la camara: recibe
copias de los frames JPEG que el servidor ya esta reenviando al navegador.

La importacion de las librerias pesadas (torch, ultralytics, opencv) se hace
dentro del hilo de inferencia. Asi el servidor arranca igual aunque el
entorno de IA no este instalado y la web sigue funcionando en modo solo
video.
"""

from __future__ import annotations

import os
import queue
import threading
import time
from collections import deque
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "models" / "yolo11n.pt"
ONNX_PATH = BASE_DIR / "models" / "yolo11n.onnx"
EPP_MODEL_PATH = Path(
    os.environ.get("AUTEC_EPP_MODEL", str(BASE_DIR / "models" / "epp_yolo11n.pt"))
)
EPP_ONNX_PATH = Path(
    os.environ.get("AUTEC_EPP_ONNX", str(BASE_DIR / "models" / "epp_yolo11n.onnx"))
)


def _env_flag(name: str, default: bool = True) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() not in ("0", "false", "no", "off")


def _env_float(name: str, default: float, minimum: float, maximum: float) -> float:
    try:
        value = float(os.environ.get(name, str(default)))
    except ValueError:
        return default
    return max(minimum, min(maximum, value))


ENABLED = _env_flag("AUTEC_DETECT", True)

PERSON_CLASS_ID = 0  # clase "person" del dataset COCO
CONFIDENCE = 0.35
IMAGE_SIZE = 416
TARGET_INTERVAL = 0.2  # ~5 inferencias por segundo
MAX_FRAME_BYTES = 4 * 1024 * 1024
STALE_SECONDS = 3.0
TRACK_TTL = 1.5  # segundos que un ID sigue contando tras dejar de verse
TRACK_BUFFER = 8  # fotogramas que ByteTrack conserva un ID perdido
REID_ENABLED = _env_flag("AUTEC_REID", True)
REID_MEMORY_SECONDS = _env_float("AUTEC_REID_SECONDS", 120.0, 5.0, 3600.0)
REID_THRESHOLD = _env_float("AUTEC_REID_THRESHOLD", 0.66, 0.30, 0.99)
REID_MARGIN = 0.05  # diferencia minima frente a la segunda persona parecida
REID_GRACE_SECONDS = 0.75  # espera antes de guardar la apariencia de un ID perdido
REID_MAX_DESCRIPTORS = 6  # ultimas muestras de ropa por persona
REID_MAX_GALLERY = 40  # personas recordadas a la vez

# Deteccion de EPP (casco y chaleco). El modelo es opcional: si no existe,
# el detector sigue funcionando con COCO y la web muestra el estado real.
EPP_ENABLED = _env_flag("AUTEC_EPP", True)
EPP_CONFIDENCE = _env_float("AUTEC_EPP_CONF", 0.25, 0.05, 0.95)
try:
    EPP_IMAGE_SIZE = int(os.environ.get("AUTEC_EPP_IMGSZ", "512"))
except ValueError:
    EPP_IMAGE_SIZE = 512
EPP_IMAGE_SIZE = max(320, min(640, EPP_IMAGE_SIZE))
try:
    EPP_EVERY = int(os.environ.get("AUTEC_EPP_EVERY", "2"))
except ValueError:
    EPP_EVERY = 2
EPP_EVERY = max(1, min(10, EPP_EVERY))
EPP_SMOOTH_WINDOW = 7
EPP_SMOOTH_THRESHOLD = 0.6
EPP_SMOOTH_ABSENCE = 3

# Deteccion de caidas: heuristica local sobre la caja de persona. No hay
# modelo de pose; se compara el ancho contra el alto durante unos segundos.
FALLS_ENABLED = _env_flag("AUTEC_FALLS", True)
FALLS_RATIO = _env_float("AUTEC_FALLS_RATIO", 1.05, 0.5, 3.0)
FALLS_GRACE_SECONDS = _env_float("AUTEC_FALLS_GRACE", 3.0, 0.5, 60.0)
FALLS_COOLDOWN_SECONDS = _env_float("AUTEC_FALLS_COOLDOWN", 120.0, 0.0, 3600.0)
FALLS_TRACK_TTL = 3.0

# Nombres aceptados en el dataset. El entrenamiento recomendado usa
# person / helmet / vest, pero se toleran variantes de otros datasets.
_EPP_CLASS_ALIASES = {
    "person": {"person", "people", "persona", "human"},
    "helmet": {"helmet", "hardhat", "hard_hat", "safety_helmet", "casco"},
    "vest": {
        "vest",
        "safety_vest",
        "reflective_vest",
        "reflective_vests",
        "hi_vis",
        "hivis",
        "chaleco",
    },
    "no_helmet": {"no_helmet", "nohelmet", "without_helmet", "sin_casco"},
    "no_vest": {"no_vest", "novest", "without_vest", "sin_chaleco"},
}


def _empty_epp_summary(**values) -> dict:
    summary = {
        "enabled": False,
        "available": False,
        "model": "",
        "reason": "model-missing",
        "persons": 0,
        "compliant": 0,
        "nonCompliant": 0,
        "unknown": 0,
        "withHelmet": 0,
        "withVest": 0,
        "withoutHelmet": 0,
        "withoutVest": 0,
        "compliance": None,
    }
    summary.update(values)
    return summary


def _empty_falls_summary(**values) -> dict:
    summary = {
        "enabled": False,
        "available": False,
        "heuristic": True,
        "model": "",
        "reason": "disabled",
        "persons": 0,
        "suspects": 0,
        "fallen": 0,
        "ratioThreshold": FALLS_RATIO,
        "graceSeconds": FALLS_GRACE_SECONDS,
        "cooldownSeconds": FALLS_COOLDOWN_SECONDS,
    }
    summary.update(values)
    return summary


def _normalize_class_name(value) -> str:
    return (
        str(value or "")
        .strip()
        .lower()
        .replace("-", "_")
        .replace(" ", "_")
    )


def resolve_epp_classes(names) -> dict:
    """Mapea los nombres del modelo EPP a las clases que usa VigIA.

    Acepta el diccionario ``model.names`` de Ultralytics o una lista. Las
    variantes mas comunes de datasets publicos (hardhat, casco, chaleco,
    safety_vest) se normalizan para no exigir un orden de clases fijo.
    """
    if isinstance(names, dict):
        entries = list(names.items())
    else:
        entries = list(enumerate(names or []))

    resolved: dict[str, int] = {}
    for raw_id, raw_name in entries:
        try:
            class_id = int(raw_id)
        except (TypeError, ValueError):
            continue
        normalized = _normalize_class_name(raw_name)
        for target, aliases in _EPP_CLASS_ALIASES.items():
            if normalized in aliases and target not in resolved:
                resolved[target] = class_id
                break
    return resolved


def _box_coords(box) -> tuple[float, float, float, float]:
    if isinstance(box, dict):
        return (
            float(box.get("x1", 0.0)),
            float(box.get("y1", 0.0)),
            float(box.get("x2", 0.0)),
            float(box.get("y2", 0.0)),
        )
    return tuple(float(value) for value in box[:4])


def _intersection_area(a, b) -> float:
    width = min(a[2], b[2]) - max(a[0], b[0])
    height = min(a[3], b[3]) - max(a[1], b[1])
    if width <= 0 or height <= 0:
        return 0.0
    return width * height


def associate_epp(person, items) -> dict:
    """Asocia cascos y chalecos a la caja de una persona.

    El casco debe tener el centro en el 45 % superior de la persona. El
    chaleco debe caer entre el 15 % y el 85 % de la altura. Se elige la
    deteccion con mayor confianza y mayor contención dentro de la persona.
    Las clases negativas (``no_helmet`` / ``no_vest``) se conservan para
    poder marcar una ausencia explicita.
    """
    px1, py1, px2, py2 = _box_coords(person)
    person_width = max(1.0, px2 - px1)
    person_height = max(1.0, py2 - py1)
    person_area = person_width * person_height
    result: dict[str, dict] = {}

    candidates: dict[str, list] = {}
    for item in items:
        label = str(item.get("label") or "")
        if label not in ("helmet", "vest", "no_helmet", "no_vest"):
            continue
        ix1, iy1, ix2, iy2 = _box_coords(item)
        center_x = (ix1 + ix2) / 2
        center_y = (iy1 + iy2) / 2
        if not (px1 <= center_x <= px2 and py1 <= center_y <= py2):
            continue

        relative_y = (center_y - py1) / person_height
        if label == "helmet" and relative_y > 0.45:
            continue
        if label == "no_helmet" and relative_y > 0.50:
            continue
        if label in ("vest", "no_vest") and not (0.15 <= relative_y <= 0.85):
            continue

        overlap = _intersection_area((px1, py1, px2, py2), (ix1, iy1, ix2, iy2))
        containment = overlap / max(1.0, (ix2 - ix1) * (iy2 - iy1))
        confidence = float(item.get("confidence") or 0.0)
        score = confidence * 0.7 + containment * 0.3
        if overlap <= 0:
            continue
        candidates.setdefault(label, []).append(
            (score, containment, confidence, item)
        )

    for label, values in candidates.items():
        values.sort(key=lambda entry: entry[0], reverse=True)
        _, _, confidence, item = values[0]
        ix1, iy1, ix2, iy2 = _box_coords(item)
        result[label] = {
            "x1": round(ix1, 1),
            "y1": round(iy1, 1),
            "x2": round(ix2, 1),
            "y2": round(iy2, 1),
            "confidence": round(confidence, 3),
            "label": label,
        }
    return result


def _epp_observation(association: dict, key: str):
    """Devuelve (estado, confianza) para casco o chaleco."""
    negative = association.get("no_" + key)
    positive = association.get(key)
    if negative is not None and (
        positive is None
        or float(negative.get("confidence") or 0.0)
        >= float(positive.get("confidence") or 0.0)
    ):
        return False, float(negative.get("confidence") or 0.0)
    if positive is not None:
        return True, float(positive.get("confidence") or 0.0)
    return None, 0.0


def _epp_payload(
    helmet,
    vest,
    helmet_confidence=0.0,
    vest_confidence=0.0,
    association=None,
) -> dict:
    missing = []
    if helmet is False:
        missing.append("helmet")
    if vest is False:
        missing.append("vest")
    if helmet is None and vest is None:
        status = "unknown"
    elif missing:
        status = "missing"
    elif helmet is True and vest is True:
        status = "ok"
    else:
        # Una sola prenda confirmada no alcanza para declarar cumplimiento:
        # cada empresa decide que EPP exige (por ejemplo, CIM solo chaleco).
        status = "partial"
    payload = {
        "helmet": helmet,
        "vest": vest,
        "helmetConfidence": round(float(helmet_confidence or 0.0), 3),
        "vestConfidence": round(float(vest_confidence or 0.0), 3),
        "missing": missing,
        "status": status,
        "simulation": False,
    }
    if association:
        boxes = {}
        for key in ("helmet", "vest", "no_helmet", "no_vest"):
            item = association.get(key)
            if item:
                boxes[key] = {
                    "x1": item["x1"],
                    "y1": item["y1"],
                    "x2": item["x2"],
                    "y2": item["y2"],
                    "confidence": item["confidence"],
                }
        if boxes:
            payload["boxes"] = boxes
    return payload


def _epp_normalize_boxes(association, person) -> dict:
    """Guarda las sub-cajas de EPP relativas a la persona.

    Asi el casco y el chaleco siguen pegados al cuerpo aunque la persona
    se mueva entre inferencias del modelo EPP.
    """
    px1, py1, px2, py2 = _box_coords(person)
    width = max(1.0, px2 - px1)
    height = max(1.0, py2 - py1)
    normalized = {}
    for key, item in (association or {}).items():
        if key not in ("helmet", "vest", "no_helmet", "no_vest"):
            continue
        x1, y1, x2, y2 = _box_coords(item)
        normalized[key] = {
            "x1": (x1 - px1) / width,
            "y1": (y1 - py1) / height,
            "x2": (x2 - px1) / width,
            "y2": (y2 - py1) / height,
            "confidence": item.get("confidence", 0.0),
        }
    return normalized


def _epp_restore_boxes(normalized, person) -> dict:
    """Vuelve a coordenadas absolutas las sub-cajas de EPP guardadas."""
    px1, py1, px2, py2 = _box_coords(person)
    width = max(1.0, px2 - px1)
    height = max(1.0, py2 - py1)
    boxes = {}
    for key, item in (normalized or {}).items():
        boxes[key] = {
            "x1": round(px1 + item["x1"] * width, 1),
            "y1": round(py1 + item["y1"] * height, 1),
            "x2": round(px1 + item["x2"] * width, 1),
            "y2": round(py1 + item["y2"] * height, 1),
            "confidence": round(float(item.get("confidence") or 0.0), 3),
        }
    return boxes


class _EppSmoother:
    """Suavizado temporal por persona para evitar parpadeos del EPP.

    El casco y el chaleco se resuelven por separado. Una ausencia debe
    repetirse tres observaciones consecutivas; una presencia se confirma
    cuando supera el 60 % de la ventana. Las observaciones desconocidas no
    modifican el estado anterior.
    """

    def __init__(
        self,
        window: int = EPP_SMOOTH_WINDOW,
        threshold: float = EPP_SMOOTH_THRESHOLD,
        absence: int = EPP_SMOOTH_ABSENCE,
    ) -> None:
        self.window = max(3, int(window))
        self.threshold = max(0.5, min(0.95, float(threshold)))
        self.absence = max(1, min(self.window, int(absence)))
        self.history: dict[str, dict] = {}

    def reset(self) -> None:
        self.history.clear()

    def _resolve(self, history, previous, observation):
        if observation is None:
            return previous
        history.append(bool(observation))
        recent = list(history)[-self.absence :]
        if len(recent) >= self.absence and not any(recent):
            return False
        ratio = sum(1 for value in history if value) / max(1, len(history))
        if ratio >= self.threshold:
            return True
        if ratio <= 1.0 - self.threshold:
            return False
        return previous

    def update(
        self,
        track_id,
        helmet,
        vest,
        helmet_confidence=0.0,
        vest_confidence=0.0,
    ) -> dict:
        key = str(track_id)
        entry = self.history.get(key)
        if entry is None:
            entry = {
                "helmet": deque(maxlen=self.window),
                "vest": deque(maxlen=self.window),
                "helmetState": None,
                "vestState": None,
            }
            self.history[key] = entry

        helmet_state = self._resolve(
            entry["helmet"], entry["helmetState"], helmet
        )
        vest_state = self._resolve(entry["vest"], entry["vestState"], vest)
        entry["helmetState"] = helmet_state
        entry["vestState"] = vest_state
        return _epp_payload(
            helmet_state,
            vest_state,
            helmet_confidence,
            vest_confidence,
        )

    def prune(self, active_keys) -> None:
        active = {str(key) for key in active_keys}
        for key in list(self.history):
            if key not in active:
                del self.history[key]


def summarize_epp(payloads, model="", reason="") -> dict:
    """Resumen global de cumplimiento para /api/detections."""
    payloads = list(payloads or [])
    summary = _empty_epp_summary(
        enabled=bool(model),
        available=bool(model),
        model=model,
        reason=reason,
    )
    summary["persons"] = len(payloads)
    for payload in payloads:
        helmet = payload.get("helmet")
        vest = payload.get("vest")
        if helmet is True:
            summary["withHelmet"] += 1
        elif helmet is False:
            summary["withoutHelmet"] += 1
        if vest is True:
            summary["withVest"] += 1
        elif vest is False:
            summary["withoutVest"] += 1
        if not payload.get("missing") and payload.get("status") == "ok":
            summary["compliant"] += 1
        elif payload.get("status") == "missing":
            summary["nonCompliant"] += 1
        else:
            summary["unknown"] += 1
    evaluable = summary["compliant"] + summary["nonCompliant"]
    if evaluable:
        summary["compliance"] = round(
            summary["compliant"] / evaluable * 100.0, 1
        )
    return summary


class _FallTracker:
    """Heuristica temporal de caidas por ID de persona.

    Una caja horizontal (ancho/alto mayor o igual al umbral) se considera
    sospechosa. Si la condicion se mantiene durante ``grace`` segundos, se
    marca como caida. No usa un modelo de pose: solo geometria de la caja.
    """

    def __init__(self, ratio=FALLS_RATIO, grace=FALLS_GRACE_SECONDS) -> None:
        self.ratio = float(ratio)
        self.grace = float(grace)
        self.tracks: dict[str, dict] = {}

    def reset(self) -> None:
        self.tracks.clear()

    def _payload(self, status, ratio, seconds) -> dict:
        return {
            "status": status,
            "suspect": status in ("suspect", "fallen"),
            "fallen": status == "fallen",
            "ratio": round(float(ratio), 2),
            "seconds": round(float(seconds), 1),
            "threshold": round(self.ratio, 2),
        }

    def update(self, track_id, item, now) -> dict:
        try:
            width = max(
                0.0,
                float(item.get("x2", 0.0)) - float(item.get("x1", 0.0)),
            )
            height = max(
                1.0,
                float(item.get("y2", 0.0)) - float(item.get("y1", 0.0)),
            )
        except (TypeError, ValueError):
            return self._payload("normal", 0.0, 0.0)

        ratio = width / height
        if ratio < self.ratio:
            if track_id is not None:
                self.tracks.pop(str(track_id), None)
            return self._payload("normal", ratio, 0.0)

        if track_id is None:
            # Sin ID estable no se puede acumular tiempo: se informa el
            # riesgo del fotograma, pero nunca una caida confirmada.
            return self._payload("suspect", ratio, 0.0)

        key = str(track_id)
        entry = self.tracks.get(key)
        if entry is None:
            entry = {"since": now, "lastSeen": now}
            self.tracks[key] = entry
        entry["lastSeen"] = now
        seconds = max(0.0, now - entry["since"])
        status = "fallen" if seconds >= self.grace else "suspect"
        return self._payload(status, ratio, seconds)

    def prune(self, active_keys, now=None) -> None:
        active = {str(key) for key in active_keys}
        for key in list(self.tracks):
            if key in active:
                continue
            last_seen = self.tracks[key].get("lastSeen", 0.0)
            if now is None or now - last_seen > FALLS_TRACK_TTL:
                del self.tracks[key]


def summarize_falls(payloads, reason="") -> dict:
    """Resumen global de la heuristica de caidas para /api/detections."""
    payloads = list(payloads or [])
    summary = _empty_falls_summary(
        enabled=FALLS_ENABLED,
        available=FALLS_ENABLED,
        model="box-ratio" if FALLS_ENABLED else "",
        reason="" if FALLS_ENABLED else (reason or "disabled"),
    )
    summary["persons"] = len(payloads)
    for payload in payloads:
        status = payload.get("status")
        if status == "fallen":
            summary["fallen"] += 1
            summary["suspects"] += 1
        elif status == "suspect":
            summary["suspects"] += 1
    return summary


_LOCK = threading.Lock()
_STATE: dict = {
    "ok": True,
    "active": False,
    "status": "idle",
    "persons": 0,
    "visiblePersons": 0,
    "trackedPersons": 0,
    "uniquePersons": 0,
    "reidMatches": 0,
    "detections": [],
    "epp": _empty_epp_summary(),
    "falls": _empty_falls_summary(),
    "width": 0,
    "height": 0,
    "inferenceMs": 0.0,
    "fps": 0.0,
    "updatedAt": 0.0,
    "error": "",
    "model": f"YOLO11n · COCO + ByteTrack{' + ReID' if REID_ENABLED else ''}",
}

_QUEUE: "queue.Queue[bytes]" = queue.Queue(maxsize=1)
_STOP = threading.Event()
_FAILED = threading.Event()
_THREAD: threading.Thread | None = None
_THREAD_LOCK = threading.Lock()
_GENERATION = 0


def _set_state(**values) -> None:
    with _LOCK:
        _STATE.update(values)


def _publish(generation: int, **values) -> bool:
    """Actualiza el estado solo si el video sigue siendo el mismo.

    Evita que un resultado que estaba calculandose cuando el usuario
    desconecto vuelva a aparecer como si la camara siguiera activa.
    """
    with _LOCK:
        if generation != _GENERATION:
            return False
        _STATE.update(values)
        return True


def _snapshot_state() -> dict:
    with _LOCK:
        data = dict(_STATE)
        detections = []
        for item in _STATE["detections"]:
            copied = dict(item)
            if isinstance(copied.get("epp"), dict):
                copied["epp"] = dict(copied["epp"])
            if isinstance(copied.get("fall"), dict):
                copied["fall"] = dict(copied["fall"])
            detections.append(copied)
        data["detections"] = detections
        if isinstance(_STATE.get("epp"), dict):
            data["epp"] = dict(_STATE["epp"])
        if isinstance(_STATE.get("falls"), dict):
            data["falls"] = dict(_STATE["falls"])

    if not ENABLED:
        data.update(
            {
                "ok": True,
                "active": False,
                "status": "disabled",
                "persons": 0,
                "visiblePersons": 0,
                "trackedPersons": 0,
                "uniquePersons": 0,
                "reidMatches": 0,
                "detections": [],
                "fps": 0.0,
                "error": "",
            }
        )
        data["epp"] = _empty_epp_summary(
            enabled=False, available=False, reason="detector-disabled"
        )
        data["falls"] = _empty_falls_summary(
            enabled=False, available=False, reason="detector-disabled"
        )
        data["ageSeconds"] = None
        return data

    age = None
    if data["updatedAt"]:
        age = round(max(0.0, time.time() - data["updatedAt"]), 2)
    data["ageSeconds"] = age
    if data["status"] == "running" and age is not None and age > STALE_SECONDS:
        data["active"] = False
        data["persons"] = 0
        data["visiblePersons"] = 0
        data["trackedPersons"] = 0
        data["reidMatches"] = 0
        data["detections"] = []
        previous = dict(data.get("epp") or {})
        data["epp"] = _empty_epp_summary(
            enabled=previous.get("enabled", False),
            available=previous.get("available", False),
            model=previous.get("model", ""),
            reason=previous.get("reason", ""),
        )
        previous_falls = dict(data.get("falls") or {})
        data["falls"] = _empty_falls_summary(
            enabled=previous_falls.get("enabled", FALLS_ENABLED),
            available=previous_falls.get("available", FALLS_ENABLED),
            model=previous_falls.get("model", ""),
            reason=previous_falls.get("reason", ""),
        )
    return data


def snapshot() -> dict:
    """Estado actual del detector, listo para enviar como JSON."""
    return _snapshot_state()


def _thread_count() -> int:
    """Cantidad de hilos de inferencia (2 por defecto en este equipo).

    Se puede bajar a 1 con AUTEC_THREADS=1 si el video se entrecorta en
    equipos muy cargados.
    """
    try:
        value = int(os.environ.get("AUTEC_THREADS", "2"))
    except ValueError:
        value = 2
    return max(1, min(4, value))


def _limit_onnx_threads(threads: int) -> None:
    """Fija los hilos de ONNX Runtime antes de cargar el modelo.

    Ultralytics crea la sesion ONNX internamente. Este envoltorio solo le
    pasa las opciones de hilos para que la inferencia no acapare todos los
    nucleos y el video siga fluido.
    """
    try:
        import onnxruntime as ort
    except Exception as exc:  # noqa: BLE001
        print(f"[detector] No se pudo configurar ONNX Runtime: {exc}")
        return

    real_session = ort.InferenceSession
    if getattr(real_session, "_autec_limited", False):
        return

    def limited_session(*args, **kwargs):
        if len(args) > 1 and args[1] is not None:
            options = args[1]
        elif kwargs.get("sess_options") is not None:
            options = kwargs["sess_options"]
        else:
            options = ort.SessionOptions()
            if len(args) > 1:
                args = (args[0], options) + args[2:]
            else:
                kwargs["sess_options"] = options
        options.intra_op_num_threads = threads
        options.inter_op_num_threads = 1
        return real_session(*args, **kwargs)

    limited_session._autec_limited = True
    ort.InferenceSession = limited_session
    print(f"[detector] ONNX Runtime: {threads} hilo(s) de inferencia.")


class _AppearanceMemory:
    """Memoria local de apariencia para recuperar IDs al volver a entrar.

    ByteTrack solo conserva un ID durante unos pocos fotogramas. Cuando la
    persona sale del plano, su rastro se elimina y al volver recibe un ID
    nuevo. Esta memoria guarda el color de la ropa (histograma HSV del torso
    y del cuerpo completo) y, si la persona reaparece dentro del tiempo de
    memoria, le devuelve su numero anterior.

    Es una heuristica local: no identifica personas, no usa rostros y puede
    confundirse si dos personas visten ropa muy parecida.
    """

    def __init__(self, cv2_module, np_module) -> None:
        self.cv2 = cv2_module
        self.np = np_module
        self.active: dict[int, dict] = {}
        self.gallery: dict[int, dict] = {}
        self.next_display_id = 1
        self.matches = 0

    def reset(self) -> None:
        self.active.clear()
        self.gallery.clear()
        self.next_display_id = 1
        self.matches = 0

    def _histogram(self, crop, grid: bool = False):
        cv2 = self.cv2
        np = self.np
        resized = cv2.resize(crop, (64, 128), interpolation=cv2.INTER_AREA)
        hsv = cv2.cvtColor(resized, cv2.COLOR_BGR2HSV)
        if grid:
            cells = (
                hsv[0:64, 0:32],
                hsv[0:64, 32:64],
                hsv[64:128, 0:32],
                hsv[64:128, 32:64],
            )
        else:
            cells = (hsv,)
        parts = []
        for cell in cells:
            hist = cv2.calcHist([cell], [0, 1], None, [8, 8], [0, 180, 0, 256])
            cv2.normalize(hist, hist, norm_type=cv2.NORM_L1)
            parts.append(hist.flatten())
        vector = np.concatenate(parts).astype(np.float32)
        norm = float(np.linalg.norm(vector))
        return vector / norm if norm else None

    def descriptor(self, frame, box):
        """Describe la ropa visible de una persona con un vector normalizado."""
        cv2 = self.cv2
        np = self.np
        height, width = frame.shape[:2]
        x1, y1, x2, y2 = (float(value) for value in box)
        pad_x = (x2 - x1) * 0.05
        pad_y = (y2 - y1) * 0.03
        left = max(0, int(x1 - pad_x))
        top = max(0, int(y1 - pad_y))
        right = min(width, int(x2 + pad_x))
        bottom = min(height, int(y2 + pad_y))
        if right - left < 16 or bottom - top < 32:
            return None

        crop = frame[top:bottom, left:right]
        if crop.size == 0:
            return None

        crop_h, crop_w = crop.shape[:2]
        torso = crop[
            int(crop_h * 0.08) : int(crop_h * 0.62),
            int(crop_w * 0.10) : int(crop_w * 0.90),
        ]
        if torso.size == 0:
            return None

        torso_hist = self._histogram(torso, grid=False)
        body_hist = self._histogram(crop, grid=True)
        if torso_hist is None or body_hist is None:
            return None

        # El torso pesa mas porque describe la ropa; el cuerpo completo
        # ayuda cuando el torso esta parcialmente tapado.
        vector = np.concatenate(
            [
                torso_hist * float(np.sqrt(0.75)),
                body_hist * float(np.sqrt(0.25)),
            ]
        )
        norm = float(np.linalg.norm(vector))
        return vector / norm if norm else None

    def _remember(self, entry: dict, descriptor, now: float) -> None:
        if descriptor is None:
            return
        if now - entry["lastDescriptorAt"] < 0.35:
            return
        entry["descriptors"].append(descriptor)
        entry["lastDescriptorAt"] = now

    def _match(self, descriptor, now: float, present_raw_ids=None):
        if descriptor is None:
            return None

        # Candidatos: personas ausentes ya guardadas en la galeria y
        # personas que siguen en "active" pero cuyo ID interno de ByteTrack
        # ya no aparece en este fotograma. Esto cubre una reentrada rapida
        # antes de que termine el periodo de gracia.
        candidates = []
        expired = []
        for display_id, entry in self.gallery.items():
            if now - entry["lastSeen"] > REID_MEMORY_SECONDS:
                expired.append(display_id)
                continue
            if not entry["descriptors"]:
                continue
            score = max(
                float(self.np.dot(descriptor, candidate))
                for candidate in entry["descriptors"]
            )
            candidates.append((score, display_id, "gallery", None))

        if present_raw_ids is not None:
            for source_raw_id, entry in self.active.items():
                if source_raw_id in present_raw_ids:
                    continue
                if not entry["descriptors"]:
                    continue
                score = max(
                    float(self.np.dot(descriptor, candidate))
                    for candidate in entry["descriptors"]
                )
                candidates.append(
                    (score, entry["displayId"], "active", source_raw_id)
                )

        for display_id in expired:
            self.gallery.pop(display_id, None)

        if not candidates:
            return None

        candidates.sort(key=lambda item: item[0], reverse=True)
        best_score, display_id, source, source_raw_id = candidates[0]
        second_score = candidates[1][0] if len(candidates) > 1 else 0.0

        if best_score < REID_THRESHOLD:
            return None
        # Si dos personas se parecen casi igual, es mas seguro asignar un
        # ID nuevo que confundirlas.
        if best_score - second_score < REID_MARGIN:
            return None
        return display_id, best_score, source, source_raw_id

    def display_id_for(
        self,
        raw_id: int,
        frame,
        box,
        now: float,
        present_raw_ids=None,
    ):
        """Devuelve el numero visible para un ID interno de ByteTrack."""
        if not REID_ENABLED:
            return raw_id, False

        entry = self.active.get(raw_id)
        if entry is not None:
            entry["lastSeen"] = now
            entry["lastBox"] = box
            if now - entry["lastDescriptorAt"] >= 0.35:
                self._remember(entry, self.descriptor(frame, box), now)
            return entry["displayId"], False

        descriptor = self.descriptor(frame, box)
        match = self._match(descriptor, now, present_raw_ids)
        if match is not None:
            display_id, score, source, source_raw_id = match
            if source == "gallery":
                previous = self.gallery.pop(display_id)
            else:
                previous = self.active.pop(source_raw_id)
            descriptors = list(previous["descriptors"])
            if descriptor is not None:
                descriptors.append(descriptor)
            self.active[raw_id] = {
                "displayId": display_id,
                "lastSeen": now,
                "lastBox": box,
                "descriptors": deque(
                    descriptors[-REID_MAX_DESCRIPTORS:],
                    maxlen=REID_MAX_DESCRIPTORS,
                ),
                "lastDescriptorAt": now,
            }
            self.matches += 1
            print(
                f"[detector] ReID: persona #{display_id} recuperada "
                f"(similitud {score:.2f})."
            )
            return display_id, True

        display_id = self.next_display_id
        self.next_display_id += 1
        descriptors = deque(maxlen=REID_MAX_DESCRIPTORS)
        if descriptor is not None:
            descriptors.append(descriptor)
        self.active[raw_id] = {
            "displayId": display_id,
            "lastSeen": now,
            "lastBox": box,
            "descriptors": descriptors,
            "lastDescriptorAt": now,
        }
        return display_id, False

    def release_lost(self, now: float) -> None:
        """Guarda en la galeria los IDs que dejaron de verse."""
        if not REID_ENABLED:
            return

        for raw_id, entry in list(self.active.items()):
            if now - entry["lastSeen"] < REID_GRACE_SECONDS:
                continue
            self.gallery[entry["displayId"]] = {
                "descriptors": list(entry["descriptors"]),
                "lastSeen": entry["lastSeen"],
                "lastBox": entry["lastBox"],
            }
            del self.active[raw_id]

        for display_id, entry in list(self.gallery.items()):
            if now - entry["lastSeen"] > REID_MEMORY_SECONDS:
                del self.gallery[display_id]

        while len(self.gallery) > REID_MAX_GALLERY:
            oldest = min(
                self.gallery,
                key=lambda display_id: self.gallery[display_id]["lastSeen"],
            )
            del self.gallery[oldest]


def _current_generation() -> int:
    with _LOCK:
        return _GENERATION


def reset() -> None:
    """Se llama cuando ya no queda ningun cliente de video conectado.

    Ademas de limpiar el estado, cambia la generacion para que un fotograma
    que ya estaba en el hilo de inferencia no vuelva a marcar el detector
    como activo despues de desconectar.
    """
    global _GENERATION
    with _LOCK:
        _GENERATION += 1
        _STATE.update(
            {
                "active": False,
                "status": "idle" if _STATE["status"] != "error" else "error",
                "persons": 0,
                "visiblePersons": 0,
                "trackedPersons": 0,
                "uniquePersons": 0,
                "reidMatches": 0,
                "detections": [],
                "epp": _empty_epp_summary(reason="idle"),
                "falls": _empty_falls_summary(reason="idle"),
                "width": 0,
                "height": 0,
                "inferenceMs": 0.0,
                "fps": 0.0,
            }
        )

    # Descartar fotogramas viejos que hayan quedado en la cola.
    while True:
        try:
            _QUEUE.get_nowait()
        except queue.Empty:
            break


def _ensure_thread() -> None:
    global _THREAD
    if _FAILED.is_set():
        return
    if _THREAD is not None and _THREAD.is_alive():
        return

    with _THREAD_LOCK:
        if _FAILED.is_set():
            return
        if _THREAD is not None and _THREAD.is_alive():
            return
        _STOP.clear()
        _THREAD = threading.Thread(
            target=_worker,
            name="autec-detector",
            daemon=True,
        )
        _THREAD.start()


def offer_frame(jpeg: bytes) -> None:
    """Ofrece el ultimo frame disponible. Si el detector va lento, se descarta."""
    if not ENABLED or not jpeg or len(jpeg) > MAX_FRAME_BYTES or _STOP.is_set():
        return

    _ensure_thread()
    if _FAILED.is_set():
        return

    try:
        _QUEUE.get_nowait()
    except queue.Empty:
        pass

    try:
        _QUEUE.put_nowait(jpeg)
    except queue.Full:
        pass


def stop() -> None:
    _STOP.set()
    _FAILED.set()
    try:
        _QUEUE.put_nowait(b"")
    except queue.Full:
        pass
    thread = _THREAD
    if thread is not None and thread.is_alive():
        thread.join(timeout=3.0)
    _set_state(
        active=False,
        status="stopped",
        persons=0,
        visiblePersons=0,
        trackedPersons=0,
        uniquePersons=0,
        reidMatches=0,
        detections=[],
        epp=_empty_epp_summary(reason="stopped"),
        falls=_empty_falls_summary(reason="stopped"),
        fps=0.0,
    )


def _worker() -> None:
    # Evitar comprobaciones o instalaciones automaticas durante la inferencia.
    os.environ.setdefault("YOLO_OFFLINE", "1")
    os.environ.setdefault("YOLO_AUTOINSTALL", "false")
    threads = _thread_count()
    os.environ.setdefault("OMP_NUM_THREADS", str(threads))
    generation = _current_generation()
    _limit_onnx_threads(threads)
    try:
        import cv2
        import numpy as np
        import torch
        from ultralytics import YOLO
    except Exception as exc:  # noqa: BLE001
        message = f"No se pudo cargar la IA local: {exc}"
        print(f"[detector] {message}")
        _FAILED.set()
        _set_state(ok=False, active=False, status="error", error=message)
        return

    # ByteTrack depende de lap. Si falta, la deteccion de personas debe
    # seguir funcionando aunque sea sin IDs estables.
    tracking_error = None
    try:
        from ultralytics.trackers import BYTETracker
        from ultralytics.utils import YAML, IterableSimpleNamespace
        from ultralytics.utils.checks import check_yaml
    except Exception as exc:  # noqa: BLE001
        tracking_error = exc

    # Limitar el uso de CPU para no afectar al resto del equipo.
    try:
        torch.set_num_threads(threads)
    except Exception:  # noqa: BLE001
        pass

    if not MODEL_PATH.exists() and not ONNX_PATH.exists():
        message = f"No se encontro el modelo: {MODEL_PATH}"
        print(f"[detector] {message}")
        _FAILED.set()
        _set_state(ok=False, active=False, status="error", error=message)
        return

    model_path = ONNX_PATH if ONNX_PATH.exists() else MODEL_PATH
    base_label = "YOLO11n ONNX" if model_path.suffix == ".onnx" else "YOLO11n"
    _set_state(model=f"{base_label} · COCO")

    _set_state(status="loading", active=False, error="")
    print(f"[detector] Cargando modelo {model_path.name}...")

    try:
        model = YOLO(str(model_path))
    except Exception as exc:  # noqa: BLE001
        message = f"No se pudo cargar el modelo: {exc}"
        print(f"[detector] {message}")
        _FAILED.set()
        _set_state(ok=False, active=False, status="error", error=message)
        return

    tracker = None
    if tracking_error is not None:
        print(
            "[detector] ByteTrack no disponible: "
            f"{tracking_error}. Se usara conteo por fotograma."
        )
        _set_state(model=f"{base_label} · COCO")
    else:
        try:
            tracker_cfg = IterableSimpleNamespace(
                **YAML.load(check_yaml("bytetrack.yaml"))
            )
            # A ~4 FPS reales, 8 fotogramas equivalen a unos 2 segundos.
            tracker_cfg.track_buffer = TRACK_BUFFER
            tracker = BYTETracker(tracker_cfg)
            print("[detector] ByteTrack listo.")
        except Exception as exc:  # noqa: BLE001
            print(
                "[detector] ByteTrack no disponible: "
                f"{exc}. Se usara conteo por fotograma."
            )
            _set_state(model=f"{base_label} · COCO")

    memory = _AppearanceMemory(cv2, np) if tracker is not None else None

    # Modelo EPP opcional (casco y chaleco). Nunca bloquea la deteccion de
    # personas: si falta o falla, se publica el motivo y se sigue con COCO.
    epp_model = None
    epp_class_ids: dict[str, int] = {}
    epp_output_labels: dict[int, str] = {}
    epp_predict_classes: list[int] = []
    epp_label = ""
    epp_reason = "model-missing"
    epp_failures = 0

    if EPP_ENABLED:
        epp_path = None
        if EPP_ONNX_PATH.exists():
            epp_path = EPP_ONNX_PATH
        elif EPP_MODEL_PATH.exists():
            epp_path = EPP_MODEL_PATH

        if epp_path is None:
            print(
                "[detector] EPP sin modelo: "
                f"{EPP_MODEL_PATH.name} / {EPP_ONNX_PATH.name}. "
                "La web mostrara el estado real."
            )
        else:
            try:
                epp_model = YOLO(str(epp_path))
                epp_class_ids = resolve_epp_classes(epp_model.names)
                epp_output_labels = {
                    class_id: label
                    for label, class_id in epp_class_ids.items()
                    if label in ("helmet", "vest", "no_helmet", "no_vest")
                }
                epp_predict_classes = sorted(epp_output_labels)
                if not epp_predict_classes:
                    raise ValueError("el modelo no tiene clases helmet/vest")
                epp_label = epp_path.name
                epp_reason = ""
                print(
                    "[detector] EPP listo: "
                    + ", ".join(
                        f"{label}={class_id}"
                        for label, class_id in sorted(epp_class_ids.items())
                    )
                )
            except Exception as exc:  # noqa: BLE001
                epp_model = None
                epp_label = ""
                epp_reason = f"model-error: {exc}"
                print(f"[detector] EPP no disponible: {exc}")
    else:
        epp_reason = "disabled"
        print("[detector] EPP desactivado por AUTEC_EPP=0.")

    model_label = f"{base_label} · COCO"
    if tracker is not None:
        model_label += " + ByteTrack"
        if REID_ENABLED:
            model_label += " + ReID"
    if epp_model is not None:
        model_label += " + EPP"
    if FALLS_ENABLED:
        model_label += " + Caídas"
    _set_state(model=model_label)
    if tracker is not None and REID_ENABLED:
        print(
            "[detector] ReID listo: memoria de "
            f"{REID_MEMORY_SECONDS:.0f} s por persona."
        )

    print("[detector] Modelo listo. Esperando el primer fotograma...")
    if generation == _current_generation():
        # La sesion ONNX se crea en la primera inferencia. Mantener
        # "loading" hasta que haya un resultado evita que la web muestre
        # "esperando video" durante ese arranque lento.
        _set_state(ok=True, status="loading", active=False, error="")

    fps_value = 0.0
    last_processed = 0.0
    errors = 0
    last_seen_by_display: dict[int, float] = {}
    seen_ids: set[int] = set()
    tracker_generation = _current_generation()
    epp_smoother = _EppSmoother()
    epp_boxes_by_track: dict[int, dict] = {}
    epp_counter = EPP_EVERY
    falls_tracker = _FallTracker()

    while not _STOP.is_set():
        try:
            jpeg = _QUEUE.get(timeout=0.5)
        except queue.Empty:
            continue

        if not jpeg or _STOP.is_set():
            break

        generation = _current_generation()

        # Si el usuario desconecto y volvio a conectar, no reutilizar IDs
        # de la sesion anterior.
        if generation != tracker_generation:
            if tracker is not None:
                tracker.reset()
            if memory is not None:
                memory.reset()
            last_seen_by_display.clear()
            seen_ids.clear()
            epp_smoother.reset()
            epp_boxes_by_track.clear()
            epp_counter = EPP_EVERY
            falls_tracker.reset()
            tracker_generation = generation

        frame = cv2.imdecode(
            np.frombuffer(jpeg, dtype=np.uint8),
            cv2.IMREAD_COLOR,
        )
        if frame is None:
            continue

        height, width = frame.shape[:2]

        try:
            started = time.perf_counter()
            result = model.predict(
                source=frame,
                imgsz=IMAGE_SIZE,
                conf=CONFIDENCE,
                classes=[PERSON_CLASS_ID],
                verbose=False,
            )[0]
            boxes = result.boxes.cpu().numpy()
            tracks = tracker.update(boxes, frame) if tracker is not None else None
        except Exception as exc:  # noqa: BLE001
            errors += 1
            print(f"[detector] Error en inferencia ({errors}): {exc}")
            if errors >= 5:
                _FAILED.set()
                _set_state(
                    ok=False,
                    active=False,
                    status="error",
                    error=f"La deteccion se detuvo: {exc}",
                )
                break
            continue

        now = time.perf_counter()
        items = []

        if tracks is not None:
            present_raw_ids = {int(row[4]) for row in tracks}
            for row in tracks:
                x1, y1, x2, y2, track_id, confidence = row[:6]
                raw_id = int(track_id)
                if memory is not None:
                    display_id, _ = memory.display_id_for(
                        raw_id,
                        frame,
                        (x1, y1, x2, y2),
                        now,
                        present_raw_ids,
                    )
                else:
                    display_id = raw_id
                last_seen_by_display[display_id] = now
                seen_ids.add(display_id)
                items.append(
                    {
                        "x1": round(float(x1), 1),
                        "y1": round(float(y1), 1),
                        "x2": round(float(x2), 1),
                        "y2": round(float(y2), 1),
                        "confidence": round(float(confidence), 3),
                        "trackId": display_id,
                    }
                )
        else:
            # Respaldo si ByteTrack no pudo iniciarse: se mantiene la
            # deteccion de personas, pero sin IDs estables.
            for xyxy, confidence in zip(boxes.xyxy, boxes.conf):
                x1, y1, x2, y2 = (float(value) for value in xyxy)
                items.append(
                    {
                        "x1": round(x1, 1),
                        "y1": round(y1, 1),
                        "x2": round(x2, 1),
                        "y2": round(y2, 1),
                        "confidence": round(float(confidence), 3),
                        "trackId": None,
                    }
                )

        if memory is not None:
            memory.release_lost(now)

        # Mantener el conteo durante un instante aunque una deteccion
        # aislada falle. Asi el numero no parpadea.
        cutoff = now - TRACK_TTL
        for display_id in [
            display_id
            for display_id, last_seen in last_seen_by_display.items()
            if last_seen < cutoff
        ]:
            del last_seen_by_display[display_id]

        tracked_persons = len(last_seen_by_display)
        persons = tracked_persons if tracker is not None else len(items)

        # EPP se infiere cada AUTEC_EPP_EVERY fotogramas para no duplicar el
        # costo en CPU. Entre inferencias se conserva el ultimo estado
        # suavizado y las sub-cajas se reajustan a la persona actual.
        epp_items = []
        epp_fresh = False
        if epp_model is not None:
            epp_counter += 1
            if items and epp_counter >= EPP_EVERY:
                epp_counter = 0
                try:
                    epp_result = epp_model.predict(
                        source=frame,
                        imgsz=EPP_IMAGE_SIZE,
                        conf=EPP_CONFIDENCE,
                        classes=epp_predict_classes,
                        verbose=False,
                    )[0]
                    epp_boxes = epp_result.boxes.cpu().numpy()
                    for xyxy, confidence, class_id in zip(
                        epp_boxes.xyxy, epp_boxes.conf, epp_boxes.cls
                    ):
                        label = epp_output_labels.get(int(class_id))
                        if label is None:
                            continue
                        x1, y1, x2, y2 = (float(value) for value in xyxy)
                        epp_items.append(
                            {
                                "x1": x1,
                                "y1": y1,
                                "x2": x2,
                                "y2": y2,
                                "confidence": float(confidence),
                                "label": label,
                            }
                        )
                    epp_fresh = True
                    epp_failures = 0
                except Exception as exc:  # noqa: BLE001
                    epp_failures += 1
                    print(
                        f"[detector] Error en EPP ({epp_failures}): {exc}"
                    )
                    if epp_failures >= 3:
                        epp_model = None
                        epp_label = ""
                        epp_reason = f"inference-error: {exc}"
                        print(
                            "[detector] EPP desactivado tras tres errores "
                            "de inferencia."
                        )

            for item in items:
                track_id = item.get("trackId")
                if track_id is None:
                    # Sin ID estable no se puede suavizar entre fotogramas.
                    if epp_fresh:
                        association = associate_epp(item, epp_items)
                        helmet, helmet_conf = _epp_observation(
                            association, "helmet"
                        )
                        vest, vest_conf = _epp_observation(association, "vest")
                        item["epp"] = _epp_payload(
                            helmet,
                            vest,
                            helmet_conf,
                            vest_conf,
                            association,
                        )
                    continue

                if epp_fresh:
                    association = associate_epp(item, epp_items)
                    normalized = _epp_normalize_boxes(association, item)
                    if normalized:
                        epp_boxes_by_track[track_id] = normalized
                    helmet, helmet_conf = _epp_observation(
                        association, "helmet"
                    )
                    vest, vest_conf = _epp_observation(association, "vest")
                else:
                    helmet = None
                    vest = None
                    helmet_conf = 0.0
                    vest_conf = 0.0

                payload = epp_smoother.update(
                    track_id,
                    helmet,
                    vest,
                    helmet_conf,
                    vest_conf,
                )
                normalized = epp_boxes_by_track.get(track_id)
                if normalized:
                    payload["boxes"] = _epp_restore_boxes(normalized, item)
                item["epp"] = payload

            # Conservar el suavizado mientras ByteTrack recuerde el ID,
            # aunque una deteccion aislada no aparezca en este fotograma.
            epp_smoother.prune(last_seen_by_display.keys())
            for key in list(epp_boxes_by_track):
                if key not in last_seen_by_display:
                    del epp_boxes_by_track[key]

        epp_payloads = [
            item["epp"] for item in items if isinstance(item.get("epp"), dict)
        ]
        epp_summary = summarize_epp(
            epp_payloads,
            model=epp_label if epp_model is not None else "",
            reason=epp_reason if epp_model is None else "",
        )

        falls_payloads = []
        falls_keys = []
        if FALLS_ENABLED:
            for item in items:
                track_id = item.get("trackId")
                payload = falls_tracker.update(track_id, item, now)
                item["fall"] = payload
                falls_payloads.append(payload)
                if track_id is not None:
                    falls_keys.append(track_id)
            falls_tracker.prune(falls_keys, now)
        falls_summary = summarize_falls(
            falls_payloads,
            reason="" if FALLS_ENABLED else "disabled",
        )

        inference_ms = (time.perf_counter() - started) * 1000

        if last_processed:
            instant_fps = 1.0 / max(1e-6, now - last_processed)
            fps_value = instant_fps if not fps_value else (fps_value * 0.8) + (
                instant_fps * 0.2
            )
        last_processed = now
        errors = 0

        _publish(
            generation,
            ok=True,
            active=True,
            status="running",
            persons=persons,
            visiblePersons=len(items),
            trackedPersons=tracked_persons,
            uniquePersons=len(seen_ids),
            reidMatches=memory.matches if memory is not None else 0,
            detections=items,
            epp=epp_summary,
            falls=falls_summary,
            width=width,
            height=height,
            inferenceMs=round(inference_ms, 1),
            fps=round(fps_value, 1),
            updatedAt=time.time(),
            error="",
        )

        # Mantener el ritmo objetivo sin acumular retraso.
        elapsed = time.perf_counter() - now
        if elapsed < TARGET_INTERVAL:
            _STOP.wait(TARGET_INTERVAL - elapsed)

    _set_state(
        active=False,
        persons=0,
        visiblePersons=0,
        trackedPersons=0,
        uniquePersons=0,
        reidMatches=0,
        detections=[],
        epp=_empty_epp_summary(reason="stopped"),
        falls=_empty_falls_summary(reason="stopped"),
        fps=0.0,
    )
