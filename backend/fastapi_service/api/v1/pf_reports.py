from datetime import date

from fastapi import APIRouter, HTTPException, Query

from fastapi_service.core.dependencies import ActiveProfileId, DbSession
from fastapi_service.services import pf_reports_service
from fastapi_service.services.rbac_service import ReportReader

router = APIRouter()


@router.get('/profit-loss')
def profit_loss(
    _: ReportReader,
    db: DbSession,
    profile_id: ActiveProfileId,
    start_date: date | None = None,
    end_date: date | None = None,
) -> dict:
    return pf_reports_service.profit_loss(db, profile_id, start_date, end_date)


@router.get('/cashflow')
def cashflow(
    _: ReportReader,
    db: DbSession,
    profile_id: ActiveProfileId,
    start_date: date | None = None,
    end_date: date | None = None,
) -> dict:
    return pf_reports_service.cashflow_summary(db, profile_id, start_date, end_date)


@router.get('/expense-report')
def expense_report(
    _: ReportReader,
    db: DbSession,
    profile_id: ActiveProfileId,
    start_date: date | None = None,
    end_date: date | None = None,
) -> list[dict]:
    return pf_reports_service.expense_report(db, profile_id, start_date, end_date)


@router.get('/expense-analytics')
def expense_analytics(
    _: ReportReader,
    db: DbSession,
    profile_id: ActiveProfileId,
    start_date: date | None = None,
    end_date: date | None = None,
) -> dict:
    return pf_reports_service.expense_analytics(db, profile_id, start_date, end_date)


@router.get('/income-report')
def income_report(
    _: ReportReader,
    db: DbSession,
    profile_id: ActiveProfileId,
    start_date: date | None = None,
    end_date: date | None = None,
) -> dict:
    return pf_reports_service.income_report(db, profile_id, start_date, end_date)


@router.get('/investment-report')
def investment_report(
    _: ReportReader,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> dict:
    return pf_reports_service.investment_report(db, profile_id)


@router.get('/loan-report')
def loan_report(
    _: ReportReader,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> dict:
    return pf_reports_service.loan_report(db, profile_id)


@router.get('/daily')
def daily_ledger(
    _: ReportReader,
    db: DbSession,
    profile_id: ActiveProfileId,
    from_date: date = Query(..., description='Start date (inclusive), YYYY-MM-DD'),
    to_date: date = Query(..., description='End date (inclusive), YYYY-MM-DD'),
    account_id: int | None = Query(
        None,
        description='Optional finance account — only rows linked to this account',
    ),
) -> dict:
    try:
        return pf_reports_service.daily_ledger(db, profile_id, from_date, to_date, account_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get('/month-ledger')
def month_ledger(
    _: ReportReader,
    db: DbSession,
    profile_id: ActiveProfileId,
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12, description='Calendar month 1–12'),
    account_id: int | None = Query(
        None,
        description='Optional finance account — only rows linked to this account',
    ),
) -> dict:
    try:
        return pf_reports_service.month_ledger(db, profile_id, year, month, account_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get('/monthly-tables')
def monthly_financial_tables(
    _: ReportReader,
    db: DbSession,
    profile_id: ActiveProfileId,
    year: int = Query(..., ge=2000, le=2100, description='Calendar year'),
    account_id: int | None = Query(
        None,
        description='Optional finance account — tables use that bank only for income/expense/cash columns',
    ),
) -> dict:
    try:
        return pf_reports_service.monthly_financial_tables(db, profile_id, year, account_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
