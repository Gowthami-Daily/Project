"""Indian tax dashboard + income tax engine APIs under `/pf/tax`."""

from __future__ import annotations

from datetime import date
from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from fastapi_service.core.dependencies import ActiveProfileId, DbSession
from fastapi_service.models_extended import PfCapitalGain, PfIncomeTaxSource, PfTaxDeduction, PfTaxTransaction
from fastapi_service.repositories import pf_tax_repo
from fastapi_service.services import india_income_tax as itax
from fastapi_service.services import pf_tax_service
from fastapi_service.services.rbac_service import DashboardReader, FinanceParticipant

router = APIRouter()


class IncomeSourceIn(BaseModel):
    source_date: date
    income_type: str = Field(..., max_length=40)
    amount: float = Field(..., ge=0)
    fy_start_year: int | None = None
    notes: str | None = None


class TaxDeductionIn(BaseModel):
    deduction_date: date
    section: str = Field(..., max_length=24)
    amount: float = Field(..., ge=0)
    fy_start_year: int | None = None
    notes: str | None = None


class TaxTransactionIn(BaseModel):
    txn_date: date
    txn_type: str = Field(..., max_length=32)
    amount: float = Field(..., ge=0)
    fy_start_year: int | None = None
    notes: str | None = None


class CapitalGainIn(BaseModel):
    buy_date: date
    sell_date: date
    asset_type: str = Field(..., max_length=40)
    buy_amount: float = Field(..., ge=0)
    sell_amount: float = Field(..., ge=0)
    fy_start_year: int | None = None
    notes: str | None = None


def _fy_or_derive(d: date, fy: int | None) -> int:
    return fy if fy is not None else itax.fy_start_for_date(d)


@router.get('/summary')
def tax_summary(
    _: DashboardReader,
    db: DbSession,
    profile_id: ActiveProfileId,
    fy_start: int = Query(..., description='Financial year start year e.g. 2025 for FY 2025-26'),
    month: int = Query(..., ge=1, le=12, description='Calendar month 1-12'),
    year: int = Query(..., ge=2000, le=2100, description='Calendar year for selected month'),
    regime: Literal['old', 'new'] = Query('old'),
    type: Literal['daily', 'monthly'] = Query('daily', alias='type'),
) -> dict:
    return pf_tax_service.tax_summary(
        db,
        profile_id,
        fy_start=fy_start,
        cal_year=year,
        cal_month=month,
        regime=regime,
        granularity=type,
    )


@router.get('/trend')
def tax_trend(
    _: DashboardReader,
    db: DbSession,
    profile_id: ActiveProfileId,
    fy_start: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2000, le=2100),
    type: Literal['daily', 'monthly'] = Query('daily', alias='type'),
) -> dict:
    return pf_tax_service.tax_trend(
        db, profile_id, fy_start=fy_start, cal_year=year, cal_month=month, granularity=type
    )


@router.get('/distribution')
def tax_distribution(
    _: DashboardReader,
    db: DbSession,
    profile_id: ActiveProfileId,
    fy_start: int = Query(...),
    regime: Literal['old', 'new'] = Query('old'),
) -> dict:
    return pf_tax_service.tax_distribution(db, profile_id, fy_start=fy_start, regime=regime)


@router.get('/table')
def tax_table(
    _: DashboardReader,
    db: DbSession,
    profile_id: ActiveProfileId,
    fy_start: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2000, le=2100),
    type: Literal['daily', 'monthly'] = Query('daily', alias='type'),
    regime: Literal['old', 'new'] = Query('old'),
) -> dict:
    return pf_tax_service.tax_table(
        db,
        profile_id,
        fy_start=fy_start,
        cal_year=year,
        cal_month=month,
        granularity=type,
        regime=regime,
    )


@router.get('/insights')
def tax_insights(
    _: DashboardReader,
    db: DbSession,
    profile_id: ActiveProfileId,
    fy_start: int = Query(...),
    regime: Literal['old', 'new'] = Query('old'),
) -> dict:
    return pf_tax_service.tax_insights(db, profile_id, fy_start=fy_start, regime=regime)


@router.get('/tax-calculation')
def tax_calculation(
    _: DashboardReader,
    db: DbSession,
    profile_id: ActiveProfileId,
    fy_start: int = Query(...),
    regime: Literal['old', 'new'] = Query('old'),
) -> dict:
    return pf_tax_service.compute_tax_snapshot(db, profile_id, fy_start, regime=regime)


@router.get('/income-summary')
def income_summary(
    _: DashboardReader,
    db: DbSession,
    profile_id: ActiveProfileId,
    fy_start: int = Query(...),
) -> dict:
    total = pf_tax_repo.sum_income_sources_fy(db, profile_id, fy_start)
    return {'fy_start_year': fy_start, 'fy_label': itax.fy_label(fy_start), 'total_income': round(total, 2)}


@router.get('/deductions-summary')
def deductions_summary(
    _: DashboardReader,
    db: DbSession,
    profile_id: ActiveProfileId,
    fy_start: int = Query(...),
) -> dict:
    raw = pf_tax_repo.sum_deductions_by_section_fy(db, profile_id, fy_start)
    capped = itax.clamp_deductions_by_section(pf_tax_service.normalize_deduction_totals(raw))
    return {
        'fy_start_year': fy_start,
        'by_section': {k: round(v, 2) for k, v in raw.items()},
        'capped': {k: round(v, 2) for k, v in capped.items()},
        'total_capped': round(sum(capped.values()), 2),
    }


@router.get('/capital-gains')
def capital_gains_list(
    _: DashboardReader,
    db: DbSession,
    profile_id: ActiveProfileId,
    fy_start: int = Query(...),
) -> dict:
    g, t = pf_tax_repo.capital_gains_totals_fy(db, profile_id, fy_start)
    return {'fy_start_year': fy_start, 'total_gains': round(g, 2), 'total_tax': round(t, 2)}


@router.post('/income-sources', status_code=201)
def create_income_source(
    _: FinanceParticipant,
    db: DbSession,
    profile_id: ActiveProfileId,
    body: IncomeSourceIn,
) -> dict:
    fy = _fy_or_derive(body.source_date, body.fy_start_year)
    row = PfIncomeTaxSource(
        profile_id=profile_id,
        source_date=body.source_date,
        income_type=body.income_type.strip(),
        amount=body.amount,
        fy_start_year=fy,
        notes=body.notes,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {'id': row.id}


@router.post('/deductions', status_code=201)
def create_deduction(
    _: FinanceParticipant,
    db: DbSession,
    profile_id: ActiveProfileId,
    body: TaxDeductionIn,
) -> dict:
    fy = _fy_or_derive(body.deduction_date, body.fy_start_year)
    row = PfTaxDeduction(
        profile_id=profile_id,
        deduction_date=body.deduction_date,
        section=body.section.strip(),
        amount=body.amount,
        fy_start_year=fy,
        notes=body.notes,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {'id': row.id}


@router.post('/transactions', status_code=201)
def create_tax_transaction(
    _: FinanceParticipant,
    db: DbSession,
    profile_id: ActiveProfileId,
    body: TaxTransactionIn,
) -> dict:
    fy = _fy_or_derive(body.txn_date, body.fy_start_year)
    row = PfTaxTransaction(
        profile_id=profile_id,
        txn_date=body.txn_date,
        txn_type=body.txn_type.strip(),
        amount=body.amount,
        fy_start_year=fy,
        notes=body.notes,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {'id': row.id}


@router.post('/capital-gains', status_code=201)
def create_capital_gain(
    _: FinanceParticipant,
    db: DbSession,
    profile_id: ActiveProfileId,
    body: CapitalGainIn,
) -> dict:
    if body.sell_date < body.buy_date:
        raise HTTPException(status_code=400, detail='sell_date must be on or after buy_date')
    gain, tax = itax.compute_capital_gain_tax_for_lot(
        asset_type=body.asset_type,
        buy_date=body.buy_date,
        sell_date=body.sell_date,
        buy_amount=body.buy_amount,
        sell_amount=body.sell_amount,
    )
    fy = _fy_or_derive(body.sell_date, body.fy_start_year)
    row = PfCapitalGain(
        profile_id=profile_id,
        buy_date=body.buy_date,
        sell_date=body.sell_date,
        asset_type=body.asset_type.strip(),
        buy_amount=body.buy_amount,
        sell_amount=body.sell_amount,
        gain_amount=gain,
        tax_amount=tax,
        fy_start_year=fy,
        notes=body.notes,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {'id': row.id, 'gain_amount': gain, 'tax_amount': tax}
