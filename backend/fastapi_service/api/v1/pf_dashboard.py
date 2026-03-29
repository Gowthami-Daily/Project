from datetime import date

from fastapi import APIRouter, HTTPException, Query

from fastapi_service.core.dependencies import ActiveProfileId, DbSession
from fastapi_service.services import pf_dashboard_service
from fastapi_service.services.rbac_service import DashboardReader

router = APIRouter()


@router.get('/summary')
def dashboard_summary(
    _: DashboardReader,
    db: DbSession,
    profile_id: ActiveProfileId,
    account_id: int | None = Query(
        None,
        description='Finance account id — limit income, expense, cash, charts and recent rows to that bank',
    ),
) -> dict:
    try:
        return pf_dashboard_service.summary(db, profile_id, account_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.get('/income-vs-expense')
def income_vs_expense(
    _: DashboardReader,
    db: DbSession,
    profile_id: ActiveProfileId,
    year: int | None = Query(None, description='Calendar year; default current year'),
    account_id: int | None = Query(None, description='Filter to one finance account'),
) -> list[dict]:
    try:
        return pf_dashboard_service.income_vs_expense(db, profile_id, year, account_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.get('/expense-category')
def expense_category(
    _: DashboardReader,
    db: DbSession,
    profile_id: ActiveProfileId,
    start_date: date | None = None,
    end_date: date | None = None,
    account_id: int | None = Query(None, description='Filter to one finance account'),
) -> list[dict]:
    try:
        return pf_dashboard_service.expense_category(db, profile_id, start_date, end_date, account_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.get('/networth-growth')
def networth_growth(
    _: DashboardReader,
    db: DbSession,
    profile_id: ActiveProfileId,
    year: int | None = Query(None),
    account_id: int | None = Query(None, description='Filter trend to one account (cumulative P&L for that account)'),
) -> list[dict]:
    try:
        return pf_dashboard_service.networth_growth(db, profile_id, year, account_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.get('/investment-allocation')
def investment_allocation(
    _: DashboardReader,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> list[dict]:
    return pf_dashboard_service.investment_allocation(db, profile_id)


@router.get('/loans-analytics')
def loans_analytics(
    _: DashboardReader,
    db: DbSession,
    profile_id: ActiveProfileId,
    year: int | None = None,
) -> dict:
    return pf_dashboard_service.loans_analytics(db, profile_id, year)


@router.get('/cashflow-month')
def cashflow_month(
    _: DashboardReader,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> dict:
    return pf_dashboard_service.cashflow_month_summary(db, profile_id)
