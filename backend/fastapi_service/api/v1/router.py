from fastapi import APIRouter

from fastapi_service.api.v1 import (
    auth,
    farmers,
    pf_analytics,
    pf_budget,
    pf_credit_cards,
    pf_dashboard,
    pf_export,
    pf_finance,
    pf_financial_health,
    pf_profiles,
    pf_reports,
    pf_tax,
    super_admin,
)

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
pf.include_router(pf_analytics.router, prefix='/analytics')
pf.include_router(pf_tax.router, prefix='/tax')
pf.include_router(pf_budget.router, prefix='/budget')
pf.include_router(pf_financial_health.router, prefix='/financial-health')
api_router.include_router(pf)

api_router.include_router(farmers.router, prefix='/farmers', tags=['farmers — procurement'])
