"""
Create all SQLAlchemy application tables (same as FastAPI startup ``create_all``).

Use on an empty PostgreSQL/SQLite database (e.g. new Render DB) before or without
running uvicorn.

Run from ``backend/``::

    .venv\\Scripts\\python.exe init_db.py
"""

from __future__ import annotations

from pathlib import Path

from sqlalchemy import text
from sqlalchemy.engine import Engine


def apply_postgres_performance_indexes(engine: Engine) -> None:
    """
    Apply ``sql/008_performance_indexes_postgres.sql`` (IF NOT EXISTS indexes).
    No-op on SQLite. Safe to call on every startup.
    """
    if engine.dialect.name != 'postgresql':
        return
    path = Path(__file__).resolve().parent / 'sql' / '008_performance_indexes_postgres.sql'
    if not path.is_file():
        return
    raw = path.read_text(encoding='utf-8')
    lines = [ln for ln in raw.splitlines() if not ln.strip().startswith('--')]
    blob = '\n'.join(lines)
    with engine.begin() as conn:
        for chunk in blob.split(';'):
            stmt = chunk.strip()
            if stmt:
                conn.execute(text(stmt))


def main() -> None:
    import fastapi_service.models  # noqa: F401 — register mappers
    import fastapi_service.models_extended  # noqa: F401

    from fastapi_service.database import Base, engine
    from fastapi_service.migrate_sqlite import (
        ensure_loan_bank_account_columns,
        ensure_loan_credit_as_cash_columns,
        ensure_pf_finance_expense_income_columns,
        ensure_pf_loan_extension_columns,
        ensure_loan_interest_free_days_column,
        ensure_pf_payment_instrument_column,
        ensure_pf_payment_instrument_finance_account_column,
        ensure_users_last_login_column,
        ensure_users_role_id_column,
    )

    Base.metadata.create_all(bind=engine)
    ensure_users_role_id_column(engine)
    ensure_users_last_login_column(engine)
    ensure_pf_loan_extension_columns(engine)
    ensure_loan_interest_free_days_column(engine)
    ensure_loan_bank_account_columns(engine)
    ensure_loan_credit_as_cash_columns(engine)
    ensure_pf_finance_expense_income_columns(engine)
    ensure_pf_payment_instrument_column(engine)
    ensure_pf_payment_instrument_finance_account_column(engine)

    apply_postgres_performance_indexes(engine)

    names = sorted(Base.metadata.tables.keys())
    print(f"OK: {len(names)} tables ensured: {', '.join(names)}")


if __name__ == "__main__":
    main()
