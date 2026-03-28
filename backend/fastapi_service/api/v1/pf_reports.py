from datetime import date

from fastapi import APIRouter

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
