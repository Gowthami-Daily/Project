import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from starlette.middleware.gzip import GZipMiddleware

from fastapi_service.api.v1.router import api_router
from fastapi_service.database import Base, SessionLocal, engine
from fastapi_service.routers import inflow as inflow_router
from fastapi_service.routers import ledger as ledger_router
from fastapi_service.routers import outflow as outflow_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    import fastapi_service.models  # noqa: F401 — register ORM mappers
    import fastapi_service.models_extended  # noqa: F401 — roles, profiles, finance tables

    from fastapi_service.migrate_sqlite import (
        ensure_account_movements_schema,
        ensure_loan_bank_account_columns,
        ensure_loan_credit_as_cash_columns,
        ensure_liability_emi_columns,
        ensure_loan_emi_interest_and_settlement_columns,
        ensure_pf_finance_expense_income_columns,
        ensure_pf_loan_extension_columns,
        ensure_loan_interest_free_days_column,
        ensure_pf_payment_instrument_column,
        ensure_pf_payment_instrument_finance_account_column,
        ensure_finance_expense_credit_card_id_column,
        ensure_credit_card_extra_columns,
        ensure_credit_card_bill_extra_columns,
        ensure_credit_card_payment_notes_column,
        ensure_credit_card_transaction_extra_columns,
        ensure_users_last_login_column,
        ensure_users_role_id_column,
    )

    ensure_account_movements_schema(engine)
    Base.metadata.create_all(bind=engine)
    ensure_users_role_id_column(engine)
    ensure_users_last_login_column(engine)
    ensure_pf_loan_extension_columns(engine)
    ensure_loan_interest_free_days_column(engine)
    ensure_liability_emi_columns(engine)
    ensure_loan_emi_interest_and_settlement_columns(engine)
    ensure_loan_bank_account_columns(engine)
    ensure_loan_credit_as_cash_columns(engine)
    ensure_pf_finance_expense_income_columns(engine)
    ensure_pf_payment_instrument_column(engine)
    ensure_pf_payment_instrument_finance_account_column(engine)
    ensure_finance_expense_credit_card_id_column(engine)
    ensure_credit_card_extra_columns(engine)
    ensure_credit_card_bill_extra_columns(engine)
    ensure_credit_card_payment_notes_column(engine)
    ensure_credit_card_transaction_extra_columns(engine)

    import init_db as _init_db

    _init_db.apply_postgres_performance_indexes(engine)

    db = SessionLocal()
    try:
        from fastapi_service.seed_inflow import seed_if_empty
        from fastapi_service.seed_ledger import seed_ledger_if_empty
        from fastapi_service.seed_outflow import seed_outflow_if_empty
        from fastapi_service.seed_auth import ensure_platform_super_admin_account, seed_default_admin_if_empty
        from fastapi_service.seed_procurement import seed_procurement_farmers_if_empty
        from fastapi_service.seed_extended import seed_extended
        from fastapi_service.seed_pf_demo_user import seed_pf_demo_user
        from fastapi_service.seed_pf_categories import seed_pf_finance_categories

        seed_extended(db)
        seed_pf_finance_categories(db)
        seed_default_admin_if_empty(db)
        seed_extended(db)
        seed_pf_demo_user(db)
        seed_if_empty(db)
        seed_ledger_if_empty(db)
        seed_outflow_if_empty(db)
        seed_procurement_farmers_if_empty(db)
        ensure_platform_super_admin_account(db)
    finally:
        db.close()
    yield


app = FastAPI(title='Gowthami Daily API', version='1.1.0', lifespan=lifespan)


def _cors_allow_origins() -> list[str]:
    """Local Vite + production Vercel; extend with comma-separated ``CORS_ORIGINS`` env."""
    origins = [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'https://project-gujv.vercel.app',
    ]
    extra = os.environ.get('CORS_ORIGINS', '')
    for part in extra.split(','):
        p = part.strip()
        if p.startswith('http'):
            origins.append(p)
    seen: set[str] = set()
    out: list[str] = []
    for o in origins:
        if o not in seen:
            seen.add(o)
            out.append(o)
    return out


app.add_middleware(GZipMiddleware, minimum_size=800)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_allow_origins(),
    allow_origin_regex=r'https://.*\.vercel\.app',
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
    expose_headers=['X-Total-Count'],
)

app.include_router(api_router, prefix='/api/v1')
app.include_router(inflow_router.router)
app.include_router(ledger_router.router)
app.include_router(outflow_router.router)


@app.get('/')
def root():
    return {'message': 'Finance API running'}


@app.get('/health')
def health_check():
    db_status = 'ok'
    try:
        with engine.connect() as conn:
            conn.execute(text('SELECT 1'))
    except Exception:
        db_status = 'error'

    return {
        'status': 'ok',
        'database': db_status,
        'timestamp': datetime.now(timezone.utc),
    }


@app.get('/warmup')
def warmup():
    return {'status': 'warmed'}


@app.get('/system/info')
def system_info():
    return {
        'app': 'Finance Management System',
        'version': '1.0',
        'modules': [
            'income',
            'expenses',
            'loans',
            'accounts',
            'investments',
            'assets',
        ],
    }


@app.get('/hello')
async def hello():
    return {
        'message': 'Hello from FastAPI',
        'source': 'backend/fastapi_service',
    }
