#!/usr/bin/env python3
"""Aplica un archivo SQL al proyecto Supabase vinculado.

Uso:
    .venv\\Scripts\\python.exe scripts\\apply_supabase_sql.py supabase\\migrations\\20261122000100_vigia_init.sql

Requiere SUPABASE_ACCESS_TOKEN y SUPABASE_PROJECT_REF en el entorno o en .env.
La Management API ejecuta el SQL como el rol postgres del proyecto.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
ENV_FILE = BASE_DIR / ".env"
DEFAULT_API = "https://api.supabase.com/v1"


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


def setting(name: str, env: dict[str, str], default: str = "") -> str:
    return os.environ.get(name) or env.get(name) or default


def run_query(project_ref: str, token: str, sql: str, api_url: str) -> dict:
    body = json.dumps({"query": sql}).encode("utf-8")
    request = urllib.request.Request(
        f"{api_url.rstrip('/')}/projects/{project_ref}/database/query",
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": "VigIA/1.0",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            raw = response.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Supabase respondio {exc.code}: {detail}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"No se pudo conectar con Supabase: {exc.reason}") from exc
    return json.loads(raw) if raw.strip() else {}


def main() -> int:
    parser = argparse.ArgumentParser(description="Aplica SQL a Supabase.")
    parser.add_argument("sql_file", type=Path, help="Archivo .sql a ejecutar.")
    parser.add_argument("--project-ref", default="", help="Ref del proyecto Supabase.")
    parser.add_argument("--api-url", default=DEFAULT_API, help="URL base de la Management API.")
    args = parser.parse_args()

    env = load_env()
    token = setting("SUPABASE_ACCESS_TOKEN", env)
    project_ref = args.project_ref or setting("SUPABASE_PROJECT_REF", env)
    if not token:
        print("Falta SUPABASE_ACCESS_TOKEN en .env o en el entorno.", file=sys.stderr)
        return 2
    if not project_ref:
        print("Falta SUPABASE_PROJECT_REF en .env o usa --project-ref.", file=sys.stderr)
        return 2
    if not args.sql_file.exists():
        print(f"No existe el archivo SQL: {args.sql_file}", file=sys.stderr)
        return 2

    sql = args.sql_file.read_text(encoding="utf-8")
    print(f"Aplicando {args.sql_file} en {project_ref} ...")
    result = run_query(project_ref, token, sql, args.api_url)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
