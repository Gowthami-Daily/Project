"""Personal finance modular analytics (TASK 6) — `/pf/analytics/{module}/...`."""

from __future__ import annotations

import re
from datetime import date
from typing import Literal

from fastapi import APIRouter, HTTPException, Query

from fastapi_service.core.dependencies import ActiveProfileId, DbSession
from fastapi_service.services import pf_analytics_service
from fastapi_service.services.rbac_service import DashboardReader

router = APIRouter()

_MONTH_RE = re.compile(r'^(\d{4})-(\d{2})$')


def _parse_month(month: str | None) -> tuple[int, int]:
    if not month:
        t = date.today()
        return t.year, t.month
    m = _MONTH_RE.match(month.strip())
    if not m:
        raise HTTPException(status_code=400, detail='month must be YYYY-MM')
    y, mo = int(m.group(1)), int(m.group(2))
    if mo < 1 or mo > 12:
        raise HTTPException(status_code=400, detail='invalid month')
    return y, mo


Granularity = Literal['daily', 'monthly']


@router.get('/{module}/summary')
def analytics_summary(
    _: DashboardReader,
    db: DbSession,
    profile_id: ActiveProfileId,
    module: str,
    month: str | None = Query(None, description='Calendar month YYYY-MM (default: current)'),
    account_id: int | None = Query(None, description='Finance account filter'),
    expense_category_id: int | None = Query(None),
    income_category_id: int | None = Query(None),
) -> dict:
    mod = module.strip().lower()
    if mod not in pf_analytics_service.ANALYTICS_MODULES:
        raise HTTPException(status_code=404, detail='Unknown analytics module')
    y, m = _parse_month(month)
    return pf_analytics_service.dispatch_summary(
        db,
        profile_id,
        mod,
        year=y,
        month=m,
        account_id=account_id,
        expense_category_id=expense_category_id,
        income_category_id=income_category_id,
    )


@router.get('/{module}/trend')
def analytics_trend(
    _: DashboardReader,
    db: DbSession,
    profile_id: ActiveProfileId,
    module: str,
    granularity: Granularity = Query('daily', alias='type', description='daily | monthly'),
    month: str | None = Query(None, description='For daily: month YYYY-MM (default current)'),
    year: int | None = Query(None, ge=2000, le=2100, description='For monthly: year (default from month or current year)'),
    account_id: int | None = Query(None),
    expense_category_id: int | None = Query(None),
    income_category_id: int | None = Query(None),
) -> dict:
    mod = module.strip().lower()
    if mod not in pf_analytics_service.ANALYTICS_MODULES:
        raise HTTPException(status_code=404, detail='Unknown analytics module')
    y, mo = _parse_month(month)
    y_series = year if year is not None else y
    return pf_analytics_service.dispatch_trend(
        db,
        profile_id,
        mod,
        granularity=granularity,
        year=y_series,
        month=mo if granularity == 'daily' else None,
        account_id=account_id,
        expense_category_id=expense_category_id,
        income_category_id=income_category_id,
    )


@router.get('/{module}/distribution')
def analytics_distribution(
    _: DashboardReader,
    db: DbSession,
    profile_id: ActiveProfileId,
    module: str,
    month: str | None = Query(None),
    account_id: int | None = Query(None),
    expense_category_id: int | None = Query(None),
    income_category_id: int | None = Query(None),
) -> dict:
    mod = module.strip().lower()
    if mod not in pf_analytics_service.ANALYTICS_MODULES:
        raise HTTPException(status_code=404, detail='Unknown analytics module')
    y, m = _parse_month(month)
    return pf_analytics_service.dispatch_distribution(
        db,
        profile_id,
        mod,
        year=y,
        month=m,
        account_id=account_id,
        expense_category_id=expense_category_id,
        income_category_id=income_category_id,
    )


@router.get('/{module}/table')
def analytics_table(
    _: DashboardReader,
    db: DbSession,
    profile_id: ActiveProfileId,
    module: str,
    granularity: Granularity = Query('daily', alias='type'),
    month: str | None = Query(None),
    year: int | None = Query(None, ge=2000, le=2100),
    account_id: int | None = Query(None),
    expense_category_id: int | None = Query(None),
    income_category_id: int | None = Query(None),
) -> dict:
    mod = module.strip().lower()
    if mod not in pf_analytics_service.ANALYTICS_MODULES:
        raise HTTPException(status_code=404, detail='Unknown analytics module')
    y, mo = _parse_month(month)
    y_series = year if year is not None else y
    return pf_analytics_service.dispatch_table(
        db,
        profile_id,
        mod,
        granularity=granularity,
        year=y_series,
        month=mo if granularity == 'daily' else None,
        account_id=account_id,
        expense_category_id=expense_category_id,
        income_category_id=income_category_id,
    )


@router.get('/{module}/insights')
def analytics_insights(
    _: DashboardReader,
    db: DbSession,
    profile_id: ActiveProfileId,
    module: str,
    month: str | None = Query(None),
    account_id: int | None = Query(None),
    expense_category_id: int | None = Query(None),
    income_category_id: int | None = Query(None),
) -> dict:
    mod = module.strip().lower()
    if mod not in pf_analytics_service.ANALYTICS_MODULES:
        raise HTTPException(status_code=404, detail='Unknown analytics module')
    y, m = _parse_month(month)
    return pf_analytics_service.dispatch_insights(
        db,
        profile_id,
        mod,
        year=y,
        month=m,
        account_id=account_id,
        expense_category_id=expense_category_id,
        income_category_id=income_category_id,
    )
