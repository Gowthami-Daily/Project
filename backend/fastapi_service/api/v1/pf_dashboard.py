from datetime import date

from fastapi import APIRouter, Query

from fastapi_service.core.dependencies import ActiveProfileId, DbSession
from fastapi_service.services import pf_dashboard_service
from fastapi_service.services.rbac_service import DashboardReader

router = APIRouter()


@router.get('/summary')
def dashboard_summary(
    _: DashboardReader,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> dict:
    return pf_dashboard_service.summary(db, profile_id)


@router.get('/income-vs-expense')
def income_vs_expense(
    _: DashboardReader,
    db: DbSession,
    profile_id: ActiveProfileId,
    year: int | None = Query(None, description='Calendar year; default current year'),
) -> list[dict]:
    return pf_dashboard_service.income_vs_expense(db, profile_id, year)


@router.get('/expense-category')
def expense_category(
    _: DashboardReader,
    db: DbSession,
    profile_id: ActiveProfileId,
    start_date: date | None = None,
    end_date: date | None = None,
) -> list[dict]:
    return pf_dashboard_service.expense_category(db, profile_id, start_date, end_date)


@router.get('/networth-growth')
def networth_growth(
    _: DashboardReader,
    db: DbSession,
    profile_id: ActiveProfileId,
    year: int | None = Query(None),
) -> list[dict]:
    return pf_dashboard_service.networth_growth(db, profile_id, year)


@router.get('/investment-allocation')
def investment_allocation(
    _: DashboardReader,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> list[dict]:
    return pf_dashboard_service.investment_allocation(db, profile_id)
