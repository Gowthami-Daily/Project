"""Fixed assets list/summary enrichment (depreciation display, linked liability label)."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from fastapi_service.models_extended import FinanceAsset, FinanceLiability
from fastapi_service.repositories import pf_finance_repo
from fastapi_service.schemas_extended import AssetsPageSummaryOut, FinanceAssetOut
from fastapi_service.services.pf_asset_valuation import (
    book_depreciation_amount,
    depreciation_years,
    effective_current_value,
)


def liability_name_map_for_ids(db: Session, profile_id: int, ids: set[int]) -> dict[int, str]:
    if not ids:
        return {}
    stmt = select(FinanceLiability.id, FinanceLiability.liability_name).where(
        FinanceLiability.profile_id == profile_id,
        FinanceLiability.id.in_(ids),
    )
    return {int(i): str(n) for i, n in db.execute(stmt).all()}


def enrich_asset_row(
    row: FinanceAsset,
    *,
    liability_names: dict[int, str],
    today: date | None = None,
) -> FinanceAssetOut:
    t = today or date.today()
    eff = effective_current_value(row, today=t)
    bd = book_depreciation_amount(row, today=t)
    yrs = depreciation_years(row.purchase_date, today=t)
    lid = row.linked_liability_id
    lname = liability_names.get(lid) if lid is not None else None
    return FinanceAssetOut(
        id=row.id,
        profile_id=row.profile_id,
        asset_name=row.asset_name,
        asset_type=row.asset_type,
        purchase_value=row.purchase_value,
        current_value=row.current_value,
        purchase_date=row.purchase_date,
        depreciation_rate=row.depreciation_rate,
        location=row.location,
        linked_liability_id=lid,
        linked_liability_name=lname,
        notes=row.notes,
        created_at=row.created_at,
        updated_at=row.updated_at,
        effective_current_value=Decimal(str(round(eff, 2))),
        book_depreciation=Decimal(str(round(bd, 2))),
        depreciation_years=round(yrs, 4),
    )


def list_enriched_assets(
    db: Session,
    profile_id: int,
    skip: int,
    limit: int,
    *,
    asset_type: str | None = None,
    location_q: str | None = None,
    search: str | None = None,
) -> list[FinanceAssetOut]:
    rows = pf_finance_repo.list_assets(
        db,
        profile_id,
        skip,
        limit,
        asset_type=asset_type,
        location_q=location_q,
        search=search,
    )
    lids = {r.linked_liability_id for r in rows if r.linked_liability_id is not None}
    names = liability_name_map_for_ids(db, profile_id, lids)
    return [enrich_asset_row(r, liability_names=names) for r in rows]


def get_enriched_asset(db: Session, profile_id: int, asset_id: int) -> FinanceAssetOut | None:
    row = pf_finance_repo.get_asset_for_profile(db, asset_id, profile_id)
    if row is None:
        return None
    lids = {row.linked_liability_id} if row.linked_liability_id is not None else set()
    names = liability_name_map_for_ids(db, profile_id, lids)
    return enrich_asset_row(row, liability_names=names)


def assets_page_summary(db: Session, profile_id: int) -> AssetsPageSummaryOut:
    rows = pf_finance_repo.list_all_assets(db, profile_id)
    total_purchase = 0.0
    total_effective = 0.0
    total_dep = 0.0
    for r in rows:
        total_purchase += float(r.purchase_value or 0)
        eff = effective_current_value(r)
        total_effective += eff
        total_dep += book_depreciation_amount(r)
    locs = pf_finance_repo.list_distinct_asset_locations(db, profile_id)
    linked_n = pf_finance_repo.count_assets_with_linked_liability(db, profile_id)
    return AssetsPageSummaryOut(
        total_current_value=round(total_effective, 2),
        total_purchase_value=round(total_purchase, 2),
        total_depreciation=round(total_dep, 2),
        linked_loan_count=linked_n,
        locations=locs,
    )
