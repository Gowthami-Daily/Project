"""Credit cards: swipes (expense-linked), statement bills → liability, bank payments."""

from __future__ import annotations

import calendar
from datetime import date, timedelta

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session, selectinload

from fastapi_service.models_extended import (
    AccountTransaction,
    CreditCard,
    CreditCardBill,
    CreditCardPayment,
    CreditCardTransaction,
    FinanceExpense,
    FinanceLiability,
)
from fastapi_service.repositories.pf_finance_repo import _bump_account_balance, get_account_for_profile


def get_card_for_profile(db: Session, card_id: int, profile_id: int) -> CreditCard | None:
    row = db.get(CreditCard, card_id)
    if row is None or row.profile_id != profile_id:
        return None
    return row


def list_cards(db: Session, profile_id: int, skip: int, limit: int) -> list[CreditCard]:
    stmt = (
        select(CreditCard)
        .where(CreditCard.profile_id == profile_id)
        .order_by(CreditCard.card_name, CreditCard.id)
        .offset(skip)
        .limit(limit)
    )
    return list(db.scalars(stmt).all())


def create_card(db: Session, row: CreditCard) -> CreditCard:
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def sum_unbilled_for_card(db: Session, card_id: int) -> float:
    stmt = select(func.coalesce(func.sum(CreditCardTransaction.amount), 0)).where(
        CreditCardTransaction.card_id == card_id,
        CreditCardTransaction.bill_id.is_(None),
    )
    return float(db.scalar(stmt) or 0)


def sum_unbilled_for_profile(db: Session, profile_id: int) -> float:
    stmt = (
        select(func.coalesce(func.sum(CreditCardTransaction.amount), 0))
        .select_from(CreditCardTransaction)
        .join(CreditCard, CreditCard.id == CreditCardTransaction.card_id)
        .where(CreditCard.profile_id == profile_id, CreditCardTransaction.bill_id.is_(None))
    )
    return float(db.scalar(stmt) or 0)


def _bill_remaining(bill: CreditCardBill) -> float:
    return max(0.0, float(bill.total_amount) - float(bill.amount_paid))


def sum_billed_outstanding_for_profile(db: Session, profile_id: int) -> float:
    stmt = (
        select(func.coalesce(func.sum(CreditCardBill.total_amount - CreditCardBill.amount_paid), 0))
        .select_from(CreditCardBill)
        .join(CreditCard, CreditCard.id == CreditCardBill.card_id)
        .where(
            CreditCard.profile_id == profile_id,
            CreditCardBill.status.in_(('PENDING', 'PARTIAL')),
        )
    )
    raw = db.scalar(stmt)
    return max(0.0, float(raw or 0))


def used_amount_for_card(db: Session, card_id: int) -> float:
    return sum_unbilled_for_card(db, card_id) + max(
        0.0,
        float(
            db.scalar(
                select(func.coalesce(func.sum(CreditCardBill.total_amount - CreditCardBill.amount_paid), 0)).where(
                    CreditCardBill.card_id == card_id,
                    CreditCardBill.status.in_(('PENDING', 'PARTIAL')),
                )
            )
            or 0
        ),
    )


def sum_cc_payments_in_range(
    db: Session, profile_id: int, start: date | None, end: date | None
) -> float:
    """Cash outflows to pay card statements (payment date — cashflow)."""
    stmt = (
        select(func.coalesce(func.sum(CreditCardPayment.amount), 0))
        .select_from(CreditCardPayment)
        .join(CreditCard, CreditCard.id == CreditCardPayment.card_id)
        .where(CreditCard.profile_id == profile_id)
    )
    if start is not None:
        stmt = stmt.where(CreditCardPayment.payment_date >= start)
    if end is not None:
        stmt = stmt.where(CreditCardPayment.payment_date <= end)
    return float(db.scalar(stmt) or 0)


def nearest_open_bill(db: Session, profile_id: int) -> tuple[CreditCardBill, CreditCard] | None:
    stmt = (
        select(CreditCardBill, CreditCard)
        .join(CreditCard, CreditCard.id == CreditCardBill.card_id)
        .where(
            CreditCard.profile_id == profile_id,
            CreditCardBill.status.in_(('PENDING', 'PARTIAL')),
        )
        .order_by(CreditCardBill.due_date.asc(), CreditCardBill.id.asc())
    )
    for bill, card in db.execute(stmt).all():
        if _bill_remaining(bill) > 0.01:
            return bill, card
    return None


def build_credit_card_alerts(db: Session, profile_id: int, cards: list[CreditCard], *, today: date) -> list[dict]:
    alerts: list[dict] = []
    horizon = today + timedelta(days=3)
    stmt = (
        select(CreditCardBill, CreditCard)
        .join(CreditCard, CreditCard.id == CreditCardBill.card_id)
        .where(
            CreditCard.profile_id == profile_id,
            CreditCardBill.status.in_(('PENDING', 'PARTIAL')),
        )
        .order_by(CreditCardBill.due_date.asc())
    )
    for bill, card in db.execute(stmt).all():
        rem = _bill_remaining(bill)
        if rem <= 0.01:
            continue
        if bill.due_date < today:
            alerts.append(
                {
                    'type': 'overdue',
                    'severity': 'high',
                    'message': f'{card.card_name}: statement #{bill.id} was due {bill.due_date}; ₹{rem:,.0f} remaining',
                    'card_id': card.id,
                    'bill_id': bill.id,
                    'due_date': bill.due_date.isoformat(),
                    'amount': round(rem, 2),
                }
            )
        elif today <= bill.due_date <= horizon:
            days_left = (bill.due_date - today).days
            alerts.append(
                {
                    'type': 'due_soon',
                    'severity': 'medium',
                    'message': f'{card.card_name}: ₹{rem:,.0f} due in {days_left} day(s) ({bill.due_date})',
                    'card_id': card.id,
                    'bill_id': bill.id,
                    'due_date': bill.due_date.isoformat(),
                    'amount': round(rem, 2),
                }
            )
    for card in cards:
        lim = float(card.card_limit or 0)
        if lim <= 0.01:
            continue
        used = used_amount_for_card(db, card.id)
        ratio = used / lim
        if ratio >= 0.8:
            alerts.append(
                {
                    'type': 'limit_high',
                    'severity': 'high' if ratio >= 0.95 else 'medium',
                    'message': f'{card.card_name}: {ratio * 100:.0f}% of ₹{lim:,.0f} limit used (₹{used:,.0f})',
                    'card_id': card.id,
                    'used_ratio': round(ratio, 4),
                    'used_amount': round(used, 2),
                    'card_limit': round(lim, 2),
                }
            )
    sev_order = {'high': 0, 'medium': 1, 'low': 2}
    alerts.sort(key=lambda a: (sev_order.get(a.get('severity', 'low'), 2), a.get('due_date', '')))
    return alerts


def list_transactions(
    db: Session,
    profile_id: int,
    *,
    card_id: int | None = None,
    unbilled_only: bool = False,
    skip: int = 0,
    limit: int = 200,
) -> list[CreditCardTransaction]:
    stmt = (
        select(CreditCardTransaction)
        .join(CreditCard, CreditCard.id == CreditCardTransaction.card_id)
        .where(CreditCard.profile_id == profile_id)
        .options(selectinload(CreditCardTransaction.bill))
    )
    if card_id is not None:
        stmt = stmt.where(CreditCardTransaction.card_id == card_id)
    if unbilled_only:
        stmt = stmt.where(CreditCardTransaction.bill_id.is_(None))
    stmt = stmt.order_by(CreditCardTransaction.transaction_date.desc(), CreditCardTransaction.id.desc())
    stmt = stmt.offset(skip).limit(limit)
    return list(db.scalars(stmt).all())


def create_transaction_from_expense(db: Session, expense: FinanceExpense, card_id: int) -> CreditCardTransaction:
    """Link a posted expense to a card swipe row (caller commits expense first)."""
    tx = CreditCardTransaction(
        card_id=card_id,
        amount=expense.amount,
        transaction_date=expense.entry_date,
        category_id=expense.expense_category_id,
        description=expense.description,
        expense_id=expense.id,
        bill_id=None,
    )
    expense.credit_card_id = card_id
    db.add(tx)
    db.commit()
    db.refresh(tx)
    db.refresh(expense)
    return tx


def _cc_tx_for_expense(db: Session, expense_id: int) -> CreditCardTransaction | None:
    return db.scalar(
        select(CreditCardTransaction).where(CreditCardTransaction.expense_id == expense_id).limit(1)
    )


def delete_transactions_for_expense(db: Session, expense_id: int) -> None:
    """Remove swipe rows tied to an expense (caller commits)."""
    ex = _cc_tx_for_expense(db, expense_id)
    if ex is not None and ex.bill_id is not None:
        raise ValueError('This expense is on a credit card statement; remove it from the bill first')
    db.execute(delete(CreditCardTransaction).where(CreditCardTransaction.expense_id == expense_id))


def sync_expense_cc_transaction(
    db: Session, profile_id: int, expense: FinanceExpense, card_id: int | None
) -> None:
    """After expense patch: single CC line per expense."""
    existing = _cc_tx_for_expense(db, expense.id)
    if existing is not None and existing.bill_id is not None:
        raise ValueError('This expense is on a statement; you cannot change how it was paid')
    db.execute(delete(CreditCardTransaction).where(CreditCardTransaction.expense_id == expense.id))
    if card_id is None:
        expense.credit_card_id = None
        db.commit()
        db.refresh(expense)
        return
    if get_card_for_profile(db, card_id, profile_id) is None:
        raise ValueError('Credit card not found')
    pm = (expense.payment_method or '').strip().lower()
    if pm != 'credit_card':
        expense.credit_card_id = None
        db.commit()
        db.refresh(expense)
        return
    tx = CreditCardTransaction(
        card_id=card_id,
        amount=expense.amount,
        transaction_date=expense.entry_date,
        category_id=expense.expense_category_id,
        description=expense.description,
        expense_id=expense.id,
        bill_id=None,
    )
    expense.credit_card_id = card_id
    db.add(tx)
    db.commit()
    db.refresh(expense)


def generate_bill(
    db: Session,
    profile_id: int,
    *,
    card_id: int,
    bill_start_date: date,
    bill_end_date: date,
) -> CreditCardBill:
    if bill_end_date < bill_start_date:
        raise ValueError('bill_end_date must be on or after bill_start_date')
    card = get_card_for_profile(db, card_id, profile_id)
    if card is None:
        raise ValueError('Credit card not found')

    stmt = select(CreditCardTransaction).where(
        CreditCardTransaction.card_id == card_id,
        CreditCardTransaction.bill_id.is_(None),
        CreditCardTransaction.transaction_date >= bill_start_date,
        CreditCardTransaction.transaction_date <= bill_end_date,
    )
    tx_rows = list(db.scalars(stmt).all())
    total = round(sum(float(r.amount) for r in tx_rows), 2)
    if total <= 0:
        raise ValueError('No unbilled charges in this period')

    due = bill_end_date + timedelta(days=int(card.due_days))
    liab = FinanceLiability(
        profile_id=profile_id,
        liability_name=f'CC statement · {card.card_name} · {bill_start_date}–{bill_end_date}',
        liability_type='CREDIT_CARD_STATEMENT',
        total_amount=total,
        outstanding_amount=total,
        due_date=due,
        billing_cycle_day=card.billing_cycle_start,
        lender_name=card.bank_name,
        notes=f'credit_card_bill_pending card_id={card_id}',
        status='ACTIVE',
    )
    db.add(liab)
    db.flush()

    bill = CreditCardBill(
        card_id=card_id,
        bill_start_date=bill_start_date,
        bill_end_date=bill_end_date,
        total_amount=total,
        due_date=due,
        status='PENDING',
        liability_id=liab.id,
        amount_paid=0,
    )
    db.add(bill)
    db.flush()

    for r in tx_rows:
        r.bill_id = bill.id

    db.commit()
    db.refresh(bill)
    return bill


def list_bills(db: Session, profile_id: int, card_id: int | None, skip: int, limit: int) -> list[CreditCardBill]:
    stmt = select(CreditCardBill).join(CreditCard, CreditCard.id == CreditCardBill.card_id)
    stmt = stmt.where(CreditCard.profile_id == profile_id)
    if card_id is not None:
        stmt = stmt.where(CreditCardBill.card_id == card_id)
    stmt = stmt.order_by(CreditCardBill.due_date.desc(), CreditCardBill.id.desc())
    stmt = stmt.offset(skip).limit(limit)
    return list(db.scalars(stmt).all())


def get_bill_for_profile(db: Session, bill_id: int, profile_id: int) -> CreditCardBill | None:
    stmt = (
        select(CreditCardBill)
        .join(CreditCard, CreditCard.id == CreditCardBill.card_id)
        .where(CreditCardBill.id == bill_id, CreditCard.profile_id == profile_id)
    )
    return db.scalars(stmt).first()


def pay_bill(
    db: Session,
    profile_id: int,
    user_id: int | None,
    *,
    bill_id: int,
    amount: float,
    payment_date: date,
    from_account_id: int,
    reference_number: str | None,
    movement_id: int | None = None,
) -> CreditCardPayment:
    bill = get_bill_for_profile(db, bill_id, profile_id)
    if bill is None:
        raise ValueError('Bill not found')
    if bill.status == 'PAID':
        raise ValueError('Bill is already paid')
    rem = _bill_remaining(bill)
    if rem <= 0.005:
        raise ValueError('Nothing due on this bill')
    amt = float(amount)
    if amt <= 0:
        raise ValueError('Amount must be positive')
    if amt > rem + 0.01:
        raise ValueError('Amount exceeds remaining bill balance')

    acc = get_account_for_profile(db, from_account_id, profile_id)
    if acc is None:
        raise ValueError('Account not found')
    if float(acc.balance) + 0.005 < amt:
        raise ValueError('Insufficient balance in the source account')

    _bump_account_balance(db, profile_id, from_account_id, -amt)

    pay = CreditCardPayment(
        card_id=bill.card_id,
        bill_id=bill.id,
        amount=amt,
        payment_date=payment_date,
        from_account_id=from_account_id,
        reference_number=(reference_number or '').strip()[:100] or None,
    )
    db.add(pay)
    db.flush()

    db.add(
        AccountTransaction(
            profile_id=profile_id,
            account_id=from_account_id,
            transaction_type='CC_BILL_PAYMENT',
            amount=amt,
            movement_id=movement_id,
            entry_date=payment_date,
            reference_number=pay.reference_number,
            notes=f'Credit card bill #{bill.id}',
            created_by=user_id,
        )
    )

    new_paid = round(float(bill.amount_paid) + amt, 2)
    bill.amount_paid = new_paid
    if new_paid + 0.01 >= float(bill.total_amount):
        bill.status = 'PAID'
    else:
        bill.status = 'PARTIAL'

    if bill.liability_id is not None:
        liab = db.get(FinanceLiability, bill.liability_id)
        if liab is not None and liab.profile_id == profile_id:
            liab.outstanding_amount = max(0.0, round(float(liab.outstanding_amount) - amt, 2))
            if liab.outstanding_amount <= 0.01:
                liab.status = 'CLOSED'

    db.commit()
    db.refresh(pay)
    return pay


def dashboard_summary(
    db: Session, profile_id: int, *, period_year: int, period_month: int
) -> dict:
    today = date.today()
    cards = list_cards(db, profile_id, 0, 500)
    total_limit = sum(float(c.card_limit or 0) for c in cards)
    unbilled = sum_unbilled_for_profile(db, profile_id)
    billed_out = sum_billed_outstanding_for_profile(db, profile_id)
    used = unbilled + billed_out
    available = max(0.0, total_limit - used) if total_limit > 0 else 0.0

    ms = date(period_year, period_month, 1)
    me = date(period_year, period_month, calendar.monthrange(period_year, period_month)[1])

    stmt_month_due = (
        select(func.coalesce(func.sum(CreditCardBill.total_amount - CreditCardBill.amount_paid), 0))
        .select_from(CreditCardBill)
        .join(CreditCard, CreditCard.id == CreditCardBill.card_id)
        .where(
            CreditCard.profile_id == profile_id,
            CreditCardBill.due_date >= ms,
            CreditCardBill.due_date <= me,
            CreditCardBill.status.in_(('PENDING', 'PARTIAL')),
        )
    )
    due_month = max(0.0, float(db.scalar(stmt_month_due) or 0))

    week_end = today + timedelta(days=7)
    stmt_week = (
        select(func.coalesce(func.sum(CreditCardBill.total_amount - CreditCardBill.amount_paid), 0))
        .select_from(CreditCardBill)
        .join(CreditCard, CreditCard.id == CreditCardBill.card_id)
        .where(
            CreditCard.profile_id == profile_id,
            CreditCardBill.due_date >= today,
            CreditCardBill.due_date <= week_end,
            CreditCardBill.status.in_(('PENDING', 'PARTIAL')),
        )
    )
    due_week = max(0.0, float(db.scalar(stmt_week) or 0))

    stmt_overdue = (
        select(func.coalesce(func.sum(CreditCardBill.total_amount - CreditCardBill.amount_paid), 0))
        .select_from(CreditCardBill)
        .join(CreditCard, CreditCard.id == CreditCardBill.card_id)
        .where(
            CreditCard.profile_id == profile_id,
            CreditCardBill.due_date < today,
            CreditCardBill.status.in_(('PENDING', 'PARTIAL')),
        )
    )
    overdue = max(0.0, float(db.scalar(stmt_overdue) or 0))

    current_bill = None
    nb = nearest_open_bill(db, profile_id)
    if nb is not None:
        bill, ccard = nb
        current_bill = {
            'bill_id': bill.id,
            'card_id': ccard.id,
            'card_name': ccard.card_name,
            'due_date': bill.due_date.isoformat(),
            'total_amount': round(float(bill.total_amount), 2),
            'amount_paid': round(float(bill.amount_paid), 2),
            'remaining': round(_bill_remaining(bill), 2),
            'status': bill.status,
            'bill_period': f'{bill.bill_start_date.isoformat()}–{bill.bill_end_date.isoformat()}',
        }

    alerts = build_credit_card_alerts(db, profile_id, cards, today=today)

    return {
        'total_credit_limit': round(total_limit, 2),
        'used_limit': round(used, 2),
        'available_limit': round(available, 2),
        'unbilled_charges': round(unbilled, 2),
        'billed_outstanding': round(billed_out, 2),
        'total_outstanding': round(used, 2),
        'due_this_month': round(due_month, 2),
        'due_this_week': round(due_week, 2),
        'overdue_amount': round(overdue, 2),
        'card_count': len(cards),
        'current_bill': current_bill,
        'alerts': alerts,
    }
