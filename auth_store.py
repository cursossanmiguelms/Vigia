#!/usr/bin/env python3
"""Autenticación simple de VigIA, persistida en Supabase.

No usa Clerk. Las contraseñas se guardan como hash PBKDF2 y las sesiones
viven en la tabla `sessions`. El token de sesión es opaco y se entrega al
navegador en una cookie HttpOnly.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

import supabase_store

SESSION_COOKIE = "vigia_session"
SESSION_HOURS = 24
PBKDF2_ITERATIONS = 210_000


def hash_password(password: str, *, iterations: int = PBKDF2_ITERATIONS) -> str:
    """Devuelve un hash PBKDF2-SHA256 con salt aleatorio."""
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return f"pbkdf2_sha256${iterations}${salt.hex()}${digest.hex()}"


def verify_password(password: str, encoded: str | None) -> bool:
    """Verifica una contraseña contra el formato guardado."""
    if not encoded:
        return False
    try:
        algorithm, raw_iterations, salt_hex, digest_hex = encoded.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        digest = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            bytes.fromhex(salt_hex),
            int(raw_iterations),
        )
        return hmac.compare_digest(digest.hex(), digest_hex)
    except (ValueError, TypeError):
        return False


def _now() -> datetime:
    return datetime.now(timezone.utc)


def authenticate(email: str, password: str) -> dict[str, Any] | None:
    """Devuelve el perfil si las credenciales son válidas."""
    email = str(email or "").strip().lower()
    password = str(password or "")
    if not email or not password:
        return None
    rows = supabase_store.fetch("profiles", {"select": "*", "email": f"eq.{email}"})
    if not rows:
        return None
    profile = rows[0]
    if profile.get("status") not in (None, "", "active"):
        return None
    if not verify_password(password, profile.get("password_hash")):
        return None
    return profile


def create_session(profile: dict[str, Any], ip: str = "") -> str:
    """Crea una sesión y devuelve su token opaco."""
    token = secrets.token_urlsafe(36)
    now = _now()
    supabase_store.insert(
        "sessions",
        {
            "id": token,
            "profile_id": profile.get("id"),
            "company_id": profile.get("company_id"),
            "user_name": profile.get("name", ""),
            "company_name": "",
            "role": profile.get("role", "operator"),
            "ip": ip or "",
            "started_at": now.isoformat(),
            "last_seen": now.isoformat(),
            "expires_at": (now + timedelta(hours=SESSION_HOURS)).isoformat(),
        },
    )
    return token


def get_session(token: str | None) -> dict[str, Any] | None:
    """Devuelve perfil + sesión si el token sigue vigente."""
    if not token:
        return None
    now = _now().isoformat()
    try:
        sessions = supabase_store.fetch(
            "sessions",
            {
                "select": "*",
                "id": f"eq.{token}",
                "ended_at": "is.null",
                "expires_at": f"gt.{now}",
            },
        )
    except supabase_store.SupabaseError:
        return None
    if not sessions:
        return None
    session = sessions[0]
    profile_id = session.get("profile_id")
    if not profile_id:
        return None
    profiles = supabase_store.fetch("profiles", {"select": "*", "id": f"eq.{profile_id}"})
    if not profiles:
        return None
    return {"profile": profiles[0], "session": session}


def end_session(token: str | None) -> None:
    """Cierra una sesión si existe."""
    if not token:
        return
    try:
        supabase_store.update(
            "sessions",
            {"id": token},
            {"ended_at": _now().isoformat()},
        )
    except supabase_store.SupabaseError:
        pass


def public_profile(profile: dict[str, Any]) -> dict[str, Any]:
    """Versión del perfil que puede viajar al navegador."""
    return {
        "id": profile.get("id"),
        "name": profile.get("name", ""),
        "email": profile.get("email", ""),
        "role": profile.get("role", "operator"),
        "companyId": profile.get("company_id"),
        "status": profile.get("status", "active"),
    }
