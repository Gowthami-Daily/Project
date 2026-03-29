import time
from datetime import date

from fastapi import APIRouter, HTTPException, Query

from fastapi_service.core.dependencies import ActiveProfileId, DbSession
from fastapi_service.services import pf_dashboard_service
from fastapi_service.services.rbac_service import DashboardReader

router = APIRouter()

# Short TTL in-process cache (per worker). Reduces repeated dashboard load cost.
_BUNDLE_CACHE: dict[str, tuple[float, dict]] = {}
_BUNDLE_TTL_S = 300.0


def _cached_bundle_body(
    db,
    profile_id: int,
    account_id: int | None,
    period_year: int,
    period_month: int,
    recent_limit: int,
) -> dict:
    key = f'{profile_id}:{account_id}:{period_year}:{period_month}:r{recent_limit}'
    now = time.monotonic()
    hit = _BUNDLE_CACHE.get(key)
    if hit is not None and now - hit[0] < _BUNDLE_TTL_S:
        return hit[1]
    body = pf_dashboard_service.dashboard_bundle(
        db, profile_id, account_id, period_year, period_month, recent_limit=recent_limit
    )
    _BUNDLE_CACHE[key] = (now, body)
    if len(_BUNDLE_CACHE) > 256:
        _BUNDLE_CACHE.clear()
    return body


@router.get('/summary')
def dashboard_summary(
    _: DashboardReader,
    db: DbSession,
    profile_id: ActiveProfileId,
    account_id: int | None = Query(
        None,
        description='Finance account id — limit income, expense, cash, charts and recent rows to that bank',
    ),
    period_year: int | None = Query(
        None,
        ge=2000,
        le=2100,
        description='With period_month: limit income/expense/unallocated/recent tx to that calendar month',
    ),
    period_month: int | None = Query(
        None,
        ge=1,
        le=12,
        description='With period_year: calendar month (1–12)',
    ),
    full: bool = Query(
        False,
        description='If true: same payload as GET /bundle (single-call dashboard). Requires period_year + period_month.',
    ),
    recent_limit: int = Query(
        15,
        ge=1,
        le=50,
        description='Recent transactions cap (summary row list; also used when full=true)',
    ),
) -> dict:
    if (period_year is None) ^ (period_month is None):
        raise HTTPException(
            status_code=400,
            detail='Pass both period_year and period_month, or neither (year-to-date).',
        )
    if full:
        if period_year is None or period_month is None:
            raise HTTPException(
                status_code=400,
                detail='full=true requires both period_year and period_month (same as /bundle).',
            )
        try:
            return _cached_bundle_body(db, profile_id, account_id, period_year, period_month, recent_limit)
        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e)) from e
    try:
        return pf_dashboard_service.summary(
            db,
            profile_id,
            account_id,
            period_year=period_year,
            period_month=period_month,
            recent_limit=recent_limit,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.get('/bundle')
def dashboard_bundle(
    _: DashboardReader,
    db: DbSession,
    profile_id: ActiveProfileId,
    account_id: int | None = Query(
        None,
        description='Finance account id — same filtering as /summary',
    ),
    period_year: int = Query(..., ge=2000, le=2100),
    period_month: int = Query(..., ge=1, le=12),
    recent_limit: int = Query(
        15,
        ge=1,
        le=50,
        description='Max recent transactions in summary (smaller = faster payload)',
    ),
) -> dict:
    """All dashboard widgets in one response (accounts, summary, charts, loans, cashflow)."""
    try:
        return _cached_bundle_body(db, profile_id, account_id, period_year, period_month, recent_limit)
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
    year: int | None = Query(None, ge=2000, le=2100, description='Calendar year; default current'),
    month: int | None = Query(None, ge=1, le=12, description='Calendar month; default current'),
) -> dict:
    if (year is None) ^ (month is None):
        raise HTTPException(status_code=400, detail='Pass both year and month, or neither.')
    try:
        return pf_dashboard_service.cashflow_month_summary(db, profile_id, year, month)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
