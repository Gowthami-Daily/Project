"""
Create all SQLAlchemy application tables (same as FastAPI startup ``create_all``).

Use on an empty PostgreSQL/SQLite database (e.g. new Render DB) before or without
running uvicorn.

Run from ``backend/``::

    .venv\\Scripts\\python.exe init_db.py
"""

from __future__ import annotations


def main() -> None:
    import fastapi_service.models  # noqa: F401 — register mappers
    import fastapi_service.models_extended  # noqa: F401

    from fastapi_service.database import Base, engine
    from fastapi_service.migrate_sqlite import ensure_users_role_id_column

    Base.metadata.create_all(bind=engine)
    ensure_users_role_id_column(engine)

    names = sorted(Base.metadata.tables.keys())
    print(f"OK: {len(names)} tables ensured: {', '.join(names)}")


if __name__ == "__main__":
    main()
