from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from fastapi_service.api.v1.router import api_router
from fastapi_service.database import Base, SessionLocal, engine
from fastapi_service.routers import inflow as inflow_router
from fastapi_service.routers import ledger as ledger_router
from fastapi_service.routers import outflow as outflow_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    import fastapi_service.models  # noqa: F401 — register ORM mappers
    import fastapi_service.models_extended  # noqa: F401 — roles, profiles, finance tables

    Base.metadata.create_all(bind=engine)
    from fastapi_service.migrate_sqlite import ensure_users_role_id_column

    ensure_users_role_id_column(engine)
    db = SessionLocal()
    try:
        from fastapi_service.seed_inflow import seed_if_empty
        from fastapi_service.seed_ledger import seed_ledger_if_empty
        from fastapi_service.seed_outflow import seed_outflow_if_empty
        from fastapi_service.seed_auth import seed_default_admin_if_empty
        from fastapi_service.seed_procurement import seed_procurement_farmers_if_empty
        from fastapi_service.seed_extended import seed_extended
        from fastapi_service.seed_pf_demo_user import seed_pf_demo_user

        seed_extended(db)
        seed_default_admin_if_empty(db)
        seed_extended(db)
        seed_pf_demo_user(db)
        seed_if_empty(db)
        seed_ledger_if_empty(db)
        seed_outflow_if_empty(db)
        seed_procurement_farmers_if_empty(db)
    finally:
        db.close()
    yield


app = FastAPI(title='Gowthami Daily API', version='1.1.0', lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        'http://localhost:5173',
        'http://127.0.0.1:5173',
    ],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.include_router(api_router, prefix='/api/v1')
app.include_router(inflow_router.router)
app.include_router(ledger_router.router)
app.include_router(outflow_router.router)


@app.get('/hello')
async def hello():
    return {
        'message': 'Hello from FastAPI',
        'source': 'backend/fastapi_service',
    }
