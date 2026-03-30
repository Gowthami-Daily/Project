"""Liability list enrichment and page summary (dues, overdue)."""

from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import func as sqlfunc, select
from sqlalchemy.orm import Session

from fastapi_service.models_extended import FinanceLiability, LiabilityPayment
from fastapi_service.repositories import pf_finance_repo
from fastapi_service.schemas_extended import FinanceLiabilityOut, LiabilitiesPageSummaryOut


def liability_display_status(ln: FinanceLiability, *, today: date | None = None) -> str:
    today = today or date.today()
    if float(ln.outstanding_amount) <= 0.01:
        return 'PAID'
    if str(ln.status).upper() == 'CLOSED':
        return 'CLOSED'
    if ln.due_date is not None and ln.due_date < today and float(ln.outstanding_amount) > 0.01:
        return 'OVERDUE'
    return 'ACTIVE'


def enrich_liability(db: Session, ln: FinanceLiability) -> FinanceLiabilityOut:
    interest = pf_finance_repo.sum_liability_interest_paid(db, ln.id)
    st = liability_display_status(ln)
    has_s = pf_finance_repo.liability_has_emi_schedule(db, ln.id)
    next_emi = pf_finance_repo.next_pending_liability_emi(db, ln.id) if has_s else None
    extra: dict = {
        'display_status': st,
        'interest_paid_lifetime': Decimal(str(round(interest, 2))),
        'has_emi_schedule': has_s,
    }
    if next_emi:
        d, amt = next_emi
        extra['next_emi_due'] = d
        extra['next_emi_amount'] = Decimal(str(round(amt, 2)))
    base = FinanceLiabilityOut.model_validate(ln, from_attributes=True)
    return base.model_copy(update=extra)


def sum_profile_liability_interest_paid(db: Session, profile_id: int) -> float:
    stmt = (
        select(sqlfunc.coalesce(sqlfunc.sum(LiabilityPayment.interest_paid), 0))
        .join(FinanceLiability, LiabilityPayment.liability_id == FinanceLiability.id)
        .where(FinanceLiability.profile_id == profile_id)
    )
    return float(db.scalar(stmt) or 0)


def liabilities_page_summary(db: Session, profile_id: int) -> LiabilitiesPageSummaryOut:
    today = date.today()
    wk = today + timedelta(days=7)
    due_week = pf_finance_repo.liabilities_due_between(db, profile_id, today, wk)
    return LiabilitiesPageSummaryOut(
        total_liabilities_book=pf_finance_repo.sum_liabilities_total_book(db, profile_id),
        total_outstanding=pf_finance_repo.sum_liabilities_outstanding_active(db, profile_id),
        due_this_month_amount=pf_finance_repo.sum_liabilities_due_in_month(db, profile_id, today.year, today.month),
        overdue_amount=pf_finance_repo.sum_liabilities_outstanding_overdue(db, profile_id, today=today),
        due_this_week=due_week,
        interest_paid_lifetime=sum_profile_liability_interest_paid(db, profile_id),
    )


def list_enriched_liabilities(
    db: Session,
    profile_id: int,
    *,
    skip: int = 0,
    limit: int = 500,
    liability_type: str | None = None,
    status_filter: str | None = None,
    due_this_month: bool | None = None,
    search: str | None = None,
) -> list[FinanceLiabilityOut]:
    rows = pf_finance_repo.list_liabilities(
        db,
        profile_id,
        skip,
        limit,
        liability_type=liability_type,
        status_filter=status_filter,
        due_this_month=due_this_month,
        search=search,
    )
    return [enrich_liability(db, r) for r in rows]
