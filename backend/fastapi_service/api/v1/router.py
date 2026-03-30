from fastapi import APIRouter

from fastapi_service.api.v1 import auth, farmers, pf_credit_cards, pf_dashboard, pf_export, pf_finance, pf_profiles, pf_reports, super_admin

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(super_admin.router)

pf = APIRouter(prefix='/pf', tags=['personal-finance'])
pf.include_router(pf_profiles.router, prefix='/profiles')
pf.include_router(pf_dashboard.router, prefix='/dashboard')
pf.include_router(pf_reports.router, prefix='/reports')
pf.include_router(pf_finance.router, prefix='/finance')
pf.include_router(pf_credit_cards.router, prefix='/finance')
pf.include_router(pf_export.router, prefix='/export')
api_router.include_router(pf)

api_router.include_router(farmers.router, prefix='/farmers', tags=['farmers — procurement'])
