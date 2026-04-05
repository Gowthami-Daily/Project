"""Financial health score under `/pf/financial-health`."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Query

from fastapi_service.core.dependencies import ActiveProfileId, DbSession
from fastapi_service.services import pf_financial_health_service
from fastapi_service.services.rbac_service import DashboardReader, FinanceParticipant

router = APIRouter()


@router.get('/summary')
def health_summary(
    _: DashboardReader,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> dict:
    return pf_financial_health_service.health_summary(db, profile_id, persist=False)


@router.post('/recalculate', status_code=201)
def health_recalculate(
    _: FinanceParticipant,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> dict:
    return pf_financial_health_service.health_summary(db, profile_id, persist=True)


@router.get('/trend')
def health_trend(
    _: DashboardReader,
    db: DbSession,
    profile_id: ActiveProfileId,
    year: int = Query(..., ge=2000, le=2100),
    type: Literal['daily', 'monthly'] = Query('monthly', alias='type'),
) -> dict:
    return pf_financial_health_service.health_trend(db, profile_id, year=year, granularity=type)


@router.get('/table')
def health_table(
    _: DashboardReader,
    db: DbSession,
    profile_id: ActiveProfileId,
    year: int = Query(..., ge=2000, le=2100),
) -> dict:
    return pf_financial_health_service.health_table(db, profile_id, year=year)


@router.get('/insights')
def health_insights(
    _: DashboardReader,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> dict:
    return pf_financial_health_service.health_insights(db, profile_id)
