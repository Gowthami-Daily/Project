"""Loan list enrichment: balance, overdue, display status, filters (PF loans UI + dashboard)."""

from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy.orm import Session

from fastapi_service.models_extended import Loan
from fastapi_service.repositories import pf_finance_repo
from fastapi_service.schemas_extended import LoanOut, LoansPageSummaryOut, LoanReminderItemOut, LoanUpcomingEmiItemOut


def loan_kind_to_type(loan_kind: str) -> str:
    m = {
        'emi_schedule': 'EMI',
        'interest_free': 'INTEREST_FREE',
        'simple_accrual': 'SIMPLE_INTEREST',
    }
    return m.get(str(loan_kind).strip(), 'EMI')


def normalize_emi_interest_method(raw: str | None) -> str:
    v = str(raw or 'flat').strip().lower()
    if v == 'reducing_balance':
        return 'REDUCING_BALANCE'
    if v in ('simple_interest', 'simple'):
        return 'SIMPLE_INTEREST'
    return 'FLAT'


def normalize_emi_settlement(raw: str | None) -> str:
    v = str(raw or 'receipt').strip().lower()
    if v == 'payment':
        return 'PAYMENT'
    return 'RECEIPT'


def _compute_display_status(db: Session, ln: Loan, balance: float) -> tuple[str, bool]:
    has_s = pf_finance_repo.loan_has_emi_schedule(db, ln.id)
    if has_s:
        n_unpaid = pf_finance_repo.count_unpaid_schedule_rows(db, ln.id)
        if n_unpaid == 0:
            return 'COMPLETED', False
        overdue_amt = pf_finance_repo.loan_overdue_unpaid_emi_sum(db, ln.id)
        if overdue_amt > 0.01:
            return 'OVERDUE', True
    if str(ln.status).upper() == 'CLOSED' or balance <= 0.01:
        return 'CLOSED', False
    return 'ACTIVE', False


def loan_matches_status_filter(
    *,
    display_status: str,
    balance: float,
    is_overdue: bool,
    loan_status: str,
    filt_raw: str | None,
) -> bool:
    if not filt_raw or str(filt_raw).strip().upper() in ('', 'ALL'):
        return True
    f = str(filt_raw).strip().upper()
    st = str(loan_status).upper()
    if f == 'ACTIVE':
        return balance > 0.01 and st != 'CLOSED'
    if f == 'CLOSED':
        return balance <= 0.01 or st == 'CLOSED'
    if f == 'OVERDUE':
        return is_overdue
    if f == 'COMPLETED':
        return display_status == 'COMPLETED'
    return True


def build_loan_out(
    db: Session,
    ln: Loan,
    *,
    has_emi_schedule: bool,
    next_emi: tuple[date, float] | None,
    interest_collected: float,
) -> LoanOut:
    balance = pf_finance_repo.loan_balance_due_for_loan(db, ln)
    display_status, is_overdue = _compute_display_status(db, ln, balance)
    extra: dict = {
        'has_emi_schedule': has_emi_schedule,
        'display_status': display_status,
        'is_overdue': is_overdue,
        'balance_due': Decimal(str(round(balance, 2))),
        'interest_collected_lifetime': Decimal(str(round(interest_collected, 2))),
    }
    if next_emi:
        d, amt = next_emi
        extra['next_emi_due'] = d
        extra['next_emi_amount'] = Decimal(str(amt))
    base = LoanOut.model_validate(ln, from_attributes=True)
    return base.model_copy(update=extra)


def list_enriched_loans(
    db: Session,
    profile_id: int,
    *,
    loan_type: str | None = None,
    status: str | None = None,
    search: str | None = None,
) -> list[LoanOut]:
    rows = pf_finance_repo.list_loans(db, profile_id, loan_type=loan_type, search=search)
    if not rows:
        return []
    ids = [r.id for r in rows]
    with_schedule = pf_finance_repo.loan_ids_with_emi_schedule(db, ids)
    next_emi = pf_finance_repo.next_pending_emi_by_loan(db, profile_id)
    interest_map = pf_finance_repo.interest_paid_by_loan_ids(db, profile_id, ids)
    out: list[LoanOut] = []
    for ln in rows:
        lo = build_loan_out(
            db,
            ln,
            has_emi_schedule=ln.id in with_schedule,
            next_emi=next_emi.get(ln.id),
            interest_collected=interest_map.get(ln.id, 0.0),
        )
        if loan_matches_status_filter(
            display_status=lo.display_status,
            balance=float(lo.balance_due),
            is_overdue=lo.is_overdue,
            loan_status=lo.status,
            filt_raw=status,
        ):
            out.append(lo)
    return out


def loans_page_summary(db: Session, profile_id: int) -> LoansPageSummaryOut:
    today = date.today()
    week_end = today + timedelta(days=7)
    reminders_raw = pf_finance_repo.loan_reminder_rows(db, profile_id, today=today)
    reminders = [
        LoanReminderItemOut(
            loan_id=r['loan_id'],
            borrower_name=r['borrower_name'],
            kind=r['kind'],
            due_date=r['due_date'],
            emi_amount=r.get('emi_amount'),
            emi_number=r.get('emi_number'),
        )
        for r in reminders_raw
    ]
    upcoming_raw = pf_finance_repo.upcoming_unpaid_emis_in_range(db, profile_id, today, week_end)
    upcoming = [
        LoanUpcomingEmiItemOut(
            loan_id=r['loan_id'],
            borrower_name=r['borrower_name'],
            due_date=r['due_date'],
            emi_amount=r['emi_amount'],
            emi_number=r['emi_number'],
        )
        for r in upcoming_raw
    ]
    return LoansPageSummaryOut(
        total_given=pf_finance_repo.sum_loan_principal_for_profile(db, profile_id),
        total_received=pf_finance_repo.sum_loan_payments_for_profile(db, profile_id),
        total_outstanding=pf_finance_repo.sum_loan_outstanding(db, profile_id),
        overdue_amount=pf_finance_repo.profile_overdue_emi_amount(db, profile_id, today=today),
        interest_earned_lifetime=pf_finance_repo.sum_loan_interest_collected_for_profile(db, profile_id),
        reminders=reminders,
        upcoming_emis_this_week=upcoming,
    )
