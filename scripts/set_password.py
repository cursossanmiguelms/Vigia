#!/usr/bin/env python3
"""Define la contraseña de un perfil de VigIA en Supabase.

Uso:
    python scripts/set_password.py admin@vigia.local 'MiPassword123!'

Si no se pasa la contraseña se usa VIGIA_ADMIN_PASSWORD del entorno.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import auth_store  # noqa: E402
import supabase_store  # noqa: E402


def main() -> int:
    email = sys.argv[1] if len(sys.argv) > 1 else "admin@vigia.local"
    password = (
        sys.argv[2]
        if len(sys.argv) > 2
        else os.environ.get("VIGIA_ADMIN_PASSWORD", "")
    )
    if not password:
        print("Falta la contraseña (argumento o VIGIA_ADMIN_PASSWORD).", file=sys.stderr)
        return 2

    rows = supabase_store.fetch("profiles", {"select": "id,email", "email": f"eq.{email}"})
    if not rows:
        print(f"No existe el perfil {email}.", file=sys.stderr)
        return 1

    supabase_store.update(
        "profiles",
        {"id": rows[0]["id"]},
        {"password_hash": auth_store.hash_password(password)},
    )
    print(f"Contraseña actualizada para {email}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
