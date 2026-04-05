"""Budget vs actual under `/pf/budget`."""

from __future__ import annotations

from datetime import date
from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from fastapi_service.core.dependencies import ActiveProfileId, DbSession
from fastapi_service.models_extended import PfBudget
from fastapi_service.repositories import pf_budget_repo
from fastapi_service.services import pf_budget_service
from fastapi_service.services.rbac_service import DashboardReader, FinanceParticipant

router = APIRouter()


class BudgetCreate(BaseModel):
    name: str | None = Field(None, max_length=120)
    expense_category_id: int | None = None
    category_label: str | None = Field(None, max_length=120)
    monthly_budget: float = Field(..., gt=0)
    start_date: date
    end_date: date | None = None


@router.get('/summary')
def budget_summary(
    _: DashboardReader,
    db: DbSession,
    profile_id: ActiveProfileId,
    month: str = Query(..., description='YYYY-MM'),
    expense_category_id: int | None = Query(None),
    type: Literal['daily', 'monthly'] = Query('daily', alias='type'),
) -> dict:
    y, m = _parse_month(month)
    return pf_budget_service.budget_summary(
        db, profile_id, year=y, month=m, expense_category_id=expense_category_id, granularity=type
    )


@router.get('/trend')
def budget_trend(
    _: DashboardReader,
    db: DbSession,
    profile_id: ActiveProfileId,
    month: str = Query(..., description='YYYY-MM (month for daily; year taken from same for monthly series)'),
    expense_category_id: int | None = Query(None),
    type: Literal['daily', 'monthly'] = Query('daily', alias='type'),
) -> dict:
    y, m = _parse_month(month)
    return pf_budget_service.budget_trend(
        db, profile_id, year=y, month=m, expense_category_id=expense_category_id, granularity=type
    )


@router.get('/distribution')
def budget_distribution(
    _: DashboardReader,
    db: DbSession,
    profile_id: ActiveProfileId,
    month: str = Query(...),
    expense_category_id: int | None = Query(None),
) -> dict:
    y, m = _parse_month(month)
    return pf_budget_service.budget_distribution(
        db, profile_id, year=y, month=m, expense_category_id=expense_category_id
    )


@router.get('/table')
def budget_table(
    _: DashboardReader,
    db: DbSession,
    profile_id: ActiveProfileId,
    month: str = Query(...),
    expense_category_id: int | None = Query(None),
    type: Literal['daily', 'monthly'] = Query('daily', alias='type'),
) -> dict:
    y, m = _parse_month(month)
    return pf_budget_service.budget_table(
        db, profile_id, year=y, month=m, expense_category_id=expense_category_id, granularity=type
    )


@router.get('/insights')
def budget_insights(
    _: DashboardReader,
    db: DbSession,
    profile_id: ActiveProfileId,
    month: str = Query(...),
    expense_category_id: int | None = Query(None),
) -> dict:
    y, m = _parse_month(month)
    return pf_budget_service.budget_insights(
        db, profile_id, year=y, month=m, expense_category_id=expense_category_id
    )


@router.get('/budgets')
def list_budgets(
    _: DashboardReader,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> dict:
    rows = pf_budget_repo.list_budgets(db, profile_id)
    return {
        'items': [
            {
                'id': b.id,
                'name': b.name,
                'expense_category_id': b.expense_category_id,
                'category_label': b.category_label,
                'monthly_budget': float(b.monthly_budget),
                'start_date': b.start_date.isoformat(),
                'end_date': b.end_date.isoformat() if b.end_date else None,
            }
            for b in rows
        ]
    }


@router.post('/budgets', status_code=201)
def create_budget(
    _: FinanceParticipant,
    db: DbSession,
    profile_id: ActiveProfileId,
    body: BudgetCreate,
) -> dict:
    if body.expense_category_id is None and not (body.category_label and body.category_label.strip()):
        raise HTTPException(status_code=400, detail='Provide expense_category_id or category_label')
    row = PfBudget(
        profile_id=profile_id,
        name=body.name,
        expense_category_id=body.expense_category_id,
        category_label=body.category_label.strip() if body.category_label else None,
        monthly_budget=body.monthly_budget,
        start_date=body.start_date,
        end_date=body.end_date,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {'id': row.id}


def _parse_month(s: str) -> tuple[int, int]:
    parts = s.strip().split('-')
    if len(parts) != 2:
        raise HTTPException(400, 'month must be YYYY-MM')
    return int(parts[0]), int(parts[1])
