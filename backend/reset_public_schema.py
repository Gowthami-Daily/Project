"""
**Destructive:** Drop and recreate the PostgreSQL ``public`` schema (all data and objects
in ``public`` are removed), then rebuild SQLAlchemy tables + indexes and Django tables.

Does nothing useful for SQLite (use a fresh file or delete ``gowthami_inflow.db`` instead).

Run from ``backend/``::

    .venv\\Scripts\\python.exe reset_public_schema.py --yes
    .venv\\Scripts\\python.exe manage.py migrate --noinput

The ``--yes`` flag is required to avoid accidental runs.
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path

from sqlalchemy import text

BACKEND_DIR = Path(__file__).resolve().parent


def main() -> None:
    parser = argparse.ArgumentParser(description="Drop public schema on PostgreSQL and recreate ORM + Django DDL.")
    parser.add_argument("--yes", action="store_true", help="Confirm destructive reset (required).")
    parser.add_argument("--skip-django", action="store_true", help="Do not run manage.py migrate.")
    args = parser.parse_args()
    if not args.yes:
        parser.error("Refusing to run without --yes (this deletes all public schema data).")

    os.chdir(BACKEND_DIR)
    if str(BACKEND_DIR) not in sys.path:
        sys.path.insert(0, str(BACKEND_DIR))

    from fastapi_service.core.config import get_database_url
    from fastapi_service.database import engine

    url = get_database_url()
    if not (url.startswith("postgresql") or url.startswith("postgres")):
        print("DATABASE_URL is not PostgreSQL; aborting (no changes made).")
        print("For SQLite, delete the .db file or use a new path in config.")
        sys.exit(1)

    print("Dropping schema public CASCADE, then recreating …")
    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA IF EXISTS public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))
        conn.execute(text("GRANT ALL ON SCHEMA public TO PUBLIC"))
    engine.dispose()

    print("Running init_db (create_all + column ensures) …")
    import init_db  # noqa: E402 — after chdir

    init_db.main()

    if not args.skip_django:
        print("Running Django migrate …")
        subprocess.run(
            [sys.executable, str(BACKEND_DIR / "manage.py"), "migrate", "--noinput"],
            cwd=BACKEND_DIR,
            check=True,
        )

    print("Done.")


if __name__ == "__main__":
    main()
