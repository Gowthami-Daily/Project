"""Investment holding ledger: transactions, aggregates, statement summary, XIRR."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from fastapi_service.models_extended import FinanceInvestment, FinanceInvestmentTransaction
from fastapi_service.repositories import pf_finance_repo
from fastapi_service.schemas_extended import (
    FinanceInvestmentLedgerOut,
    FinanceInvestmentOut,
    FinanceInvestmentTransactionCreate,
    FinanceInvestmentTransactionOut,
    InvestmentLedgerSummaryOut,
)

TXN_PURCHASE = frozenset({'sip', 'lumpsum', 'topup'})


def _decimal(v) -> Decimal:
    return Decimal(str(v))


def recompute_investment_aggregates(db: Session, inv: FinanceInvestment) -> FinanceInvestment:
    txns = pf_finance_repo.list_investment_transactions_for_profile(db, inv.id, inv.profile_id)
    if not txns:
        db.refresh(inv)
        return inv

    total_inv = Decimal('0')
    for t in txns:
        tt = (t.txn_type or '').lower()
        if tt in TXN_PURCHASE and float(t.amount) > 0:
            total_inv += _decimal(t.amount)

    if all(t.units is not None for t in txns):
        u = sum(_decimal(t.units) for t in txns)
        inv.units_held = float(u)
    else:
        inv.units_held = None

    last_tv: float | None = None
    for t in reversed(txns):
        if t.total_value is not None:
            last_tv = float(t.total_value)
            break

    inv.invested_amount = float(total_inv)
    if last_tv is not None:
        inv.current_value = last_tv
    elif inv.current_value is None:
        inv.current_value = float(total_inv)

    inv.investment_date = min(t.txn_date for t in txns)
    inv.last_transaction_date = max(t.txn_date for t in txns)
    db.add(inv)
    db.commit()
    db.refresh(inv)
    return inv


def _signed_amount_for_storage(txn_type: str, amount_positive: float) -> float:
    t = txn_type.lower()
    if t == 'withdraw':
        return -abs(amount_positive)
    return abs(amount_positive)


def _infer_units(txn_type: str, stored_amount: float, nav: float | None, explicit_units: float | None) -> float | None:
    if explicit_units is not None:
        return float(explicit_units)
    if nav is None or nav <= 0:
        return None
    return float(stored_amount) / float(nav)


def add_transaction(
    db: Session,
    inv: FinanceInvestment,
    body: FinanceInvestmentTransactionCreate,
) -> FinanceInvestmentTransaction:
    stored_amt = _signed_amount_for_storage(body.txn_type, body.amount)
    units = _infer_units(body.txn_type, stored_amt, body.nav, body.units)
    row = FinanceInvestmentTransaction(
        investment_id=inv.id,
        txn_date=body.txn_date,
        txn_type=body.txn_type,
        amount=stored_amt,
        units=units,
        nav=body.nav,
        total_value=body.total_value,
        notes=(body.notes.strip() or None) if body.notes else None,
        attachment_url=(body.attachment_url.strip() or None) if body.attachment_url else None,
    )
    pf_finance_repo.create_investment_transaction(db, row)
    recompute_investment_aggregates(db, inv)
    return row


def delete_transaction_and_recompute(
    db: Session, inv: FinanceInvestment, txn: FinanceInvestmentTransaction
) -> None:
    pf_finance_repo.delete_investment_transaction(db, txn)
    recompute_investment_aggregates(db, inv)


def _xnpv(rate: float, dates: list[date], amounts: list[float], origin: date) -> float:
    if rate <= -0.999999:
        return float('nan')
    total = 0.0
    for d, c in zip(dates, amounts):
        years = (d - origin).days / 365.0
        total += c / ((1.0 + rate) ** years)
    return total


def compute_xirr_percent(txns: list[FinanceInvestmentTransaction], terminal_value: float) -> float | None:
    """XIRR from investor cash flows + terminal market value on today."""
    if terminal_value <= 0 or len(txns) < 1:
        return None

    dates: list[date] = []
    amounts: list[float] = []

    for t in sorted(txns, key=lambda x: (x.txn_date, x.id)):
        tt = (t.txn_type or '').lower()
        amt = float(t.amount)
        if tt in TXN_PURCHASE:
            dates.append(t.txn_date)
            amounts.append(-abs(amt))
        elif tt == 'withdraw':
            dates.append(t.txn_date)
            amounts.append(abs(amt))
        elif tt in ('dividend', 'interest'):
            dates.append(t.txn_date)
            amounts.append(abs(amt))

    today = date.today()
    dates.append(today)
    amounts.append(float(terminal_value))

    if len(dates) < 2:
        return None

    origin = min(dates)

    def npv(r: float) -> float:
        return _xnpv(r, dates, amounts, origin)

    lo, hi = -0.9999, 10.0
    v_lo, v_hi = npv(lo), npv(hi)
    if v_lo * v_hi > 0:
        hi = 100.0
        v_hi = npv(hi)
        if v_lo * v_hi > 0:
            return None

    a, b = (lo, hi) if v_lo < v_hi else (hi, lo)
    va, vb = npv(a), npv(b)
    if va > vb:
        a, b, va, vb = b, a, vb, va

    for _ in range(120):
        mid = (a + b) / 2.0
        vm = npv(mid)
        if abs(vm) < 1e-7:
            return round(mid * 100.0, 4)
        if vm < 0:
            a = mid
        else:
            b = mid
    return round(((a + b) / 2.0) * 100.0, 4)


def build_ledger_out(db: Session, investment_id: int, profile_id: int) -> FinanceInvestmentLedgerOut | None:
    inv = pf_finance_repo.get_investment_for_profile(db, investment_id, profile_id)
    if inv is None:
        return None
    txns = pf_finance_repo.list_investment_transactions_for_profile(db, investment_id, profile_id)

    total_invested = Decimal('0')
    for t in txns:
        tt = (t.txn_type or '').lower()
        if tt in TXN_PURCHASE and float(t.amount) > 0:
            total_invested += _decimal(t.amount)

    cv = inv.current_value if inv.current_value is not None else inv.invested_amount
    cv_dec = _decimal(cv)
    profit = cv_dec - total_invested
    ret_pct = float((profit / total_invested) * 100) if total_invested > 0 else None
    xirr_pct = compute_xirr_percent(txns, float(cv_dec))

    last_dt = max((t.txn_date for t in txns), default=None)
    ub = None
    if all(t.units is not None for t in txns):
        ub = sum(_decimal(t.units) for t in txns)

    summary = InvestmentLedgerSummaryOut(
        total_invested=total_invested,
        current_value=cv_dec,
        profit=profit,
        return_pct=ret_pct,
        xirr_percent=xirr_pct,
        units_balance=ub,
        last_txn_date=last_dt,
    )

    return FinanceInvestmentLedgerOut(
        investment=FinanceInvestmentOut.model_validate(inv),
        transactions=[FinanceInvestmentTransactionOut.model_validate(t) for t in txns],
        summary=summary,
    )
