"""Credit cards: swipes (expense-linked), statement bills → liability, bank payments."""

from __future__ import annotations

import calendar
from datetime import date, timedelta

from sqlalchemy import delete, desc, func, literal, select
from sqlalchemy.orm import Session, selectinload

from fastapi_service.models_extended import (
    AccountTransaction,
    CreditCard,
    CreditCardBill,
    CreditCardPayment,
    CreditCardTransaction,
    FinanceExpense,
    FinanceLiability,
    PfExpenseCategory,
)
from fastapi_service.repositories.pf_finance_repo import _bump_account_balance, get_account_for_profile

# Issued statement not fully paid (includes legacy PENDING = billed unpaid)
_CC_BILL_UNPAID_STATUSES: tuple[str, ...] = ('PENDING', 'BILLED', 'PARTIAL', 'OVERDUE')

MINIMUM_DUE_FLOOR = 100.0


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


def sum_billed_outstanding_for_card(db: Session, card_id: int) -> float:
    stmt = (
        select(func.coalesce(func.sum(CreditCardBill.total_amount - CreditCardBill.amount_paid), 0))
        .where(
            CreditCardBill.card_id == card_id,
            CreditCardBill.status.in_(_CC_BILL_UNPAID_STATUSES),
        )
    )
    return max(0.0, float(db.scalar(stmt) or 0))


def sum_billed_outstanding_for_profile(db: Session, profile_id: int) -> float:
    stmt = (
        select(func.coalesce(func.sum(CreditCardBill.total_amount - CreditCardBill.amount_paid), 0))
        .select_from(CreditCardBill)
        .join(CreditCard, CreditCard.id == CreditCardBill.card_id)
        .where(
            CreditCard.profile_id == profile_id,
            CreditCardBill.status.in_(_CC_BILL_UNPAID_STATUSES),
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
                    CreditCardBill.status.in_(_CC_BILL_UNPAID_STATUSES),
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
            CreditCardBill.status.in_(_CC_BILL_UNPAID_STATUSES),
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
            CreditCardBill.status.in_(_CC_BILL_UNPAID_STATUSES),
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
    category_id: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    unbilled_only: bool = False,
    skip: int = 0,
    limit: int = 200,
) -> list[CreditCardTransaction]:
    stmt = (
        select(CreditCardTransaction)
        .join(CreditCard, CreditCard.id == CreditCardTransaction.card_id)
        .where(CreditCard.profile_id == profile_id)
        .options(selectinload(CreditCardTransaction.bill), selectinload(CreditCardTransaction.card))
    )
    if card_id is not None:
        stmt = stmt.where(CreditCardTransaction.card_id == card_id)
    if category_id is not None:
        stmt = stmt.where(CreditCardTransaction.category_id == category_id)
    if date_from is not None:
        stmt = stmt.where(CreditCardTransaction.transaction_date >= date_from)
    if date_to is not None:
        stmt = stmt.where(CreditCardTransaction.transaction_date <= date_to)
    if unbilled_only:
        stmt = stmt.where(CreditCardTransaction.bill_id.is_(None))
    stmt = stmt.order_by(CreditCardTransaction.transaction_date.desc(), CreditCardTransaction.id.desc())
    stmt = stmt.offset(skip).limit(limit)
    return list(db.scalars(stmt).all())


def statement_cycle_month_start(tx_date: date, closing_day: int | None) -> date:
    """Statement / bill cycle month (first day), from card closing day."""
    if closing_day is None:
        return date(tx_date.year, tx_date.month, 1)
    if tx_date.day <= int(closing_day):
        return date(tx_date.year, tx_date.month, 1)
    if tx_date.month == 12:
        return date(tx_date.year + 1, 1, 1)
    return date(tx_date.year, tx_date.month + 1, 1)


def transaction_ledger_status(
    tx: CreditCardTransaction, bill: CreditCardBill | None, *, today: date
) -> str:
    ttype = (getattr(tx, 'transaction_type', None) or 'swipe').strip().lower()
    if ttype == 'refund':
        return 'refunded'
    if bool(getattr(tx, 'is_emi', False)) or ttype == 'emi':
        return 'emi'
    if bill is None:
        return 'unbilled'
    rem = _bill_remaining(bill)
    if bill.status == 'PAID' or rem <= 0.01:
        return 'paid'
    if bill.due_date < today and rem > 0.01:
        return 'overdue'
    return 'billed'


def _category_name_map(db: Session, ids: set[int]) -> dict[int, str]:
    if not ids:
        return {}
    stmt = select(PfExpenseCategory.id, PfExpenseCategory.name).where(PfExpenseCategory.id.in_(ids))
    return {int(i): str(n) for i, n in db.execute(stmt).all()}


def fetch_ledger_transaction_candidates(
    db: Session,
    profile_id: int,
    *,
    card_id: int | None = None,
    category_id: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    unbilled_only: bool = False,
    max_rows: int = 4000,
) -> list[CreditCardTransaction]:
    stmt = (
        select(CreditCardTransaction)
        .join(CreditCard, CreditCard.id == CreditCardTransaction.card_id)
        .where(CreditCard.profile_id == profile_id)
        .options(selectinload(CreditCardTransaction.bill), selectinload(CreditCardTransaction.card))
    )
    if card_id is not None:
        stmt = stmt.where(CreditCardTransaction.card_id == card_id)
    if category_id is not None:
        stmt = stmt.where(CreditCardTransaction.category_id == category_id)
    if date_from is not None:
        stmt = stmt.where(CreditCardTransaction.transaction_date >= date_from)
    if date_to is not None:
        stmt = stmt.where(CreditCardTransaction.transaction_date <= date_to)
    if unbilled_only:
        stmt = stmt.where(CreditCardTransaction.bill_id.is_(None))
    stmt = stmt.order_by(
        CreditCardTransaction.transaction_date.asc(),
        CreditCardTransaction.id.asc(),
    )
    stmt = stmt.limit(max_rows)
    return list(db.scalars(stmt).all())


def build_ledger_page(
    db: Session,
    profile_id: int,
    *,
    card_id: int | None = None,
    category_id: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    unbilled_only: bool = False,
    status_filter: str | None = None,
    skip: int = 0,
    limit: int = 500,
) -> dict:
    rows = fetch_ledger_transaction_candidates(
        db,
        profile_id,
        card_id=card_id,
        category_id=category_id,
        date_from=date_from,
        date_to=date_to,
        unbilled_only=unbilled_only,
    )
    today = date.today()
    cat_ids = {int(tx.category_id) for tx in rows if tx.category_id is not None}
    cat_map = _category_name_map(db, cat_ids)
    items: list[dict] = []
    for tx in rows:
        card = tx.card
        bill = tx.bill
        st = transaction_ledger_status(tx, bill, today=today)
        closing = int(card.closing_day) if card and card.closing_day is not None else None
        cycle = statement_cycle_month_start(tx.transaction_date, closing)
        items.append(
            {
                'tx': tx,
                'card_name': card.card_name if card else '',
                'category_name': cat_map.get(int(tx.category_id)) if tx.category_id else None,
                'ledger_status': st,
                'billing_cycle_month': cycle,
                'running_balance': 0.0,
            }
        )
    if status_filter and str(status_filter).strip().lower() not in ('', 'all'):
        sf = str(status_filter).strip().lower()
        items = [it for it in items if it['ledger_status'] == sf]
    items.sort(key=lambda it: (it['tx'].card_id, it['tx'].transaction_date, it['tx'].id))
    cum: dict[int, float] = {}
    for it in items:
        tx = it['tx']
        cid = tx.card_id
        cum[cid] = cum.get(cid, 0.0) + float(tx.amount)
        it['running_balance'] = round(cum[cid], 2)
    summary = _ledger_summary_metrics(items)
    page = items[skip : skip + limit]
    ser = [_serialize_ledger_row(it) for it in page]
    return {'summary': summary, 'transactions': ser}


def _ledger_summary_metrics(items: list[dict]) -> dict:
    def ssum(status: str) -> float:
        return round(
            sum(float(it['tx'].amount) for it in items if it['ledger_status'] == status),
            2,
        )

    return {
        'transaction_count': len(items),
        'unbilled_amount': ssum('unbilled'),
        'billed_amount': ssum('billed'),
        'paid_amount': ssum('paid'),
        'overdue_amount': ssum('overdue'),
        'refunded_amount': ssum('refunded'),
        'emi_amount': ssum('emi'),
    }


def _serialize_ledger_row(it: dict) -> dict:
    tx = it['tx']
    return {
        'id': tx.id,
        'card_id': tx.card_id,
        'card_name': it['card_name'],
        'amount': float(tx.amount),
        'transaction_date': tx.transaction_date.isoformat(),
        'transaction_type': (getattr(tx, 'transaction_type', None) or 'swipe').strip().lower(),
        'merchant': getattr(tx, 'merchant', None),
        'category_id': tx.category_id,
        'category_name': it['category_name'],
        'description': tx.description,
        'notes': getattr(tx, 'notes', None),
        'attachment_url': getattr(tx, 'attachment_url', None),
        'expense_id': tx.expense_id,
        'bill_id': tx.bill_id,
        'is_emi': bool(getattr(tx, 'is_emi', False)),
        'emi_id': getattr(tx, 'emi_id', None),
        'billing_cycle_month': it['billing_cycle_month'].isoformat(),
        'ledger_status': it['ledger_status'],
        'running_balance': it['running_balance'],
        'created_at': tx.created_at.isoformat() if tx.created_at else None,
    }


def running_balance_after_tx(db: Session, tx: CreditCardTransaction) -> float:
    stmt = (
        select(CreditCardTransaction)
        .where(CreditCardTransaction.card_id == tx.card_id)
        .order_by(CreditCardTransaction.transaction_date.asc(), CreditCardTransaction.id.asc())
    )
    total = 0.0
    for t in db.scalars(stmt).all():
        total += float(t.amount)
        if t.id == tx.id:
            return round(total, 2)
    return round(total, 2)


def single_ledger_row_dict(db: Session, profile_id: int, tx_id: int) -> dict | None:
    tx = get_cc_transaction_for_profile(db, tx_id, profile_id)
    if tx is None:
        return None
    today = date.today()
    cat_name = None
    if tx.category_id:
        pc = db.get(PfExpenseCategory, tx.category_id)
        cat_name = pc.name if pc else None
    card = tx.card if tx.card is not None else db.get(CreditCard, tx.card_id)
    card_name = card.card_name if card else ''
    bill = tx.bill
    st = transaction_ledger_status(tx, bill, today=today)
    closing = int(card.closing_day) if card and card.closing_day is not None else None
    cycle = statement_cycle_month_start(tx.transaction_date, closing)
    rb = running_balance_after_tx(db, tx)
    fake = {
        'tx': tx,
        'card_name': card_name,
        'category_name': cat_name,
        'ledger_status': st,
        'billing_cycle_month': cycle,
        'running_balance': rb,
    }
    return _serialize_ledger_row(fake)


def get_cc_transaction_for_profile(
    db: Session, tx_id: int, profile_id: int
) -> CreditCardTransaction | None:
    stmt = (
        select(CreditCardTransaction)
        .join(CreditCard, CreditCard.id == CreditCardTransaction.card_id)
        .where(CreditCardTransaction.id == tx_id, CreditCard.profile_id == profile_id)
        .options(selectinload(CreditCardTransaction.bill), selectinload(CreditCardTransaction.card))
    )
    return db.scalars(stmt).first()


_CC_TX_PATCHABLE = frozenset(
    {
        'transaction_date',
        'amount',
        'category_id',
        'description',
        'merchant',
        'notes',
        'attachment_url',
        'transaction_type',
        'is_emi',
    }
)


def patch_cc_transaction(db: Session, tx: CreditCardTransaction, patch: dict) -> CreditCardTransaction:
    for key, val in patch.items():
        if key not in _CC_TX_PATCHABLE:
            continue
        setattr(tx, key, val)
    db.commit()
    db.refresh(tx)
    return tx


def delete_cc_transaction(db: Session, profile_id: int, tx_id: int) -> bool:
    tx = get_cc_transaction_for_profile(db, tx_id, profile_id)
    if tx is None:
        return False
    if tx.bill_id is not None:
        raise ValueError('Remove this line from the statement before deleting')
    if tx.expense_id is not None:
        from fastapi_service.repositories import pf_finance_repo

        ex = pf_finance_repo.get_expense_for_profile(db, tx.expense_id, profile_id)
        if ex is not None:
            pf_finance_repo.delete_expense(db, profile_id, ex)
            return True
    db.delete(tx)
    db.commit()
    return True


def attach_transaction_to_bill(
    db: Session, profile_id: int, tx_id: int, bill_id: int
) -> CreditCardTransaction:
    tx = get_cc_transaction_for_profile(db, tx_id, profile_id)
    if tx is None:
        raise ValueError('Transaction not found')
    bill = get_bill_for_profile(db, bill_id, profile_id)
    if bill is None:
        raise ValueError('Bill not found')
    if tx.card_id != bill.card_id:
        raise ValueError('Bill belongs to a different card')
    if tx.bill_id is not None:
        raise ValueError('Transaction is already on a bill')
    if bill.status == 'PAID':
        raise ValueError('Cannot add to a paid bill')
    add = float(tx.amount)
    bill.total_amount = round(float(bill.total_amount) + add, 2)
    if bill.liability_id is not None:
        liab = db.get(FinanceLiability, bill.liability_id)
        if liab is not None and liab.profile_id == profile_id:
            liab.total_amount = round(float(liab.total_amount) + add, 2)
            liab.outstanding_amount = round(float(liab.outstanding_amount) + add, 2)
    tx.bill_id = bill_id
    db.commit()
    db.refresh(tx)
    return tx


def create_transaction_from_expense(
    db: Session,
    expense: FinanceExpense,
    card_id: int,
    *,
    transaction_type: str = 'swipe',
    merchant: str | None = None,
    notes: str | None = None,
    attachment_url: str | None = None,
    is_emi: bool = False,
) -> CreditCardTransaction:
    """Link a posted expense to a card swipe row (caller commits expense first)."""
    tx = CreditCardTransaction(
        card_id=card_id,
        amount=expense.amount,
        transaction_date=expense.entry_date,
        category_id=expense.expense_category_id,
        description=expense.description,
        expense_id=expense.id,
        bill_id=None,
        transaction_type=(transaction_type or 'swipe').strip().lower()[:20],
        merchant=(merchant or '').strip()[:200] or None,
        notes=(notes or '').strip() or None,
        attachment_url=(attachment_url or '').strip() or None,
        is_emi=bool(is_emi),
        emi_id=None,
    )
    expense.credit_card_id = card_id
    db.add(tx)
    db.commit()
    db.refresh(tx)
    db.refresh(expense)
    return tx


def create_standalone_cc_ledger_row(
    db: Session,
    profile_id: int,
    *,
    card_id: int,
    transaction_type: str,
    amount_in: float,
    transaction_date: date,
    expense_category_id: int | None,
    category_label: str,
    description: str | None,
    merchant: str | None,
    notes: str | None,
    attachment_url: str | None,
    is_emi: bool,
    paid_by: str | None,
) -> CreditCardTransaction:
    """Standalone ledger line: swipe/refund/emi via expense + row; fee/interest row only."""
    ttype = (transaction_type or 'swipe').strip().lower()
    if ttype not in ('swipe', 'refund', 'fee', 'interest', 'emi'):
        raise ValueError('Invalid transaction_type')
    if get_card_for_profile(db, card_id, profile_id) is None:
        raise ValueError('Credit card not found')
    if ttype == 'refund':
        amt = -abs(float(amount_in))
    else:
        amt = abs(float(amount_in))
    from fastapi_service.repositories import pf_finance_repo

    if ttype in ('swipe', 'emi', 'refund'):
        cat = (category_label or 'general').strip() or 'general'
        ecid = expense_category_id
        if ecid is not None:
            pc = db.get(PfExpenseCategory, ecid)
            if pc:
                cat = pc.name
        row = FinanceExpense(
            profile_id=profile_id,
            account_id=None,
            amount=amt,
            category=cat,
            entry_date=transaction_date,
            description=description or merchant,
            expense_category_id=ecid,
            paid_by=paid_by,
            payment_method='credit_card',
            payment_instrument_id=None,
            credit_card_id=card_id,
            is_recurring=False,
            payment_status='PAID',
        )
        saved = pf_finance_repo.create_expense(db, row)
        tt = 'emi' if ttype == 'emi' else ('refund' if ttype == 'refund' else 'swipe')
        return create_transaction_from_expense(
            db,
            saved,
            card_id,
            transaction_type=tt,
            merchant=merchant,
            notes=notes,
            attachment_url=attachment_url,
            is_emi=is_emi or ttype == 'emi',
        )
    tx = CreditCardTransaction(
        card_id=card_id,
        amount=amt,
        transaction_date=transaction_date,
        category_id=expense_category_id,
        description=description or merchant,
        expense_id=None,
        bill_id=None,
        transaction_type=ttype,
        merchant=(merchant or '').strip()[:200] or None,
        notes=(notes or '').strip() or None,
        attachment_url=(attachment_url or '').strip() or None,
        is_emi=False,
        emi_id=None,
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)
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
        transaction_type='swipe',
        merchant=None,
        notes=None,
        attachment_url=None,
        is_emi=False,
        emi_id=None,
    )
    expense.credit_card_id = card_id
    db.add(tx)
    db.commit()
    db.refresh(expense)


def yearly_spend_per_card(db: Session, profile_id: int) -> list[dict]:
    """Total spend per card per year, based on transaction date."""
    stmt = (
        select(
            CreditCard.card_name.label('card_name'),
            func.extract('year', CreditCardTransaction.transaction_date).label('year'),
            func.coalesce(func.sum(CreditCardTransaction.amount), 0).label('total_spent'),
        )
        .select_from(CreditCardTransaction)
        .join(CreditCard, CreditCard.id == CreditCardTransaction.card_id)
        .where(CreditCard.profile_id == profile_id)
        .group_by('card_name', 'year')
        .order_by('year', 'card_name')
    )
    rows = db.execute(stmt).all()
    return [
        {
            'card_name': card_name,
            'year': int(year),
            'total_spent': float(total_spent),
        }
        for card_name, year, total_spent in rows
    ]


def monthly_spend_for_card(
    db: Session,
    profile_id: int,
    *,
    card_id: int,
    year: int,
    category_id: int | None = None,
) -> list[dict]:
    """Month-wise spend for a single card in a given year."""
    stmt = (
        select(
            func.date_trunc('month', CreditCardTransaction.transaction_date).label('month'),
            func.coalesce(func.sum(CreditCardTransaction.amount), 0).label('total_spent'),
        )
        .select_from(CreditCardTransaction)
        .join(CreditCard, CreditCard.id == CreditCardTransaction.card_id)
        .where(
            CreditCard.profile_id == profile_id,
            CreditCardTransaction.card_id == card_id,
            func.extract('year', CreditCardTransaction.transaction_date) == year,
        )
    )
    if category_id is not None:
        stmt = stmt.where(CreditCardTransaction.category_id == category_id)
    stmt = stmt.group_by('month').order_by('month')
    rows = db.execute(stmt).all()
    return [
        {
            'month': month.date().isoformat(),
            'total_spent': float(total_spent),
        }
        for month, total_spent in rows
    ]


def spend_by_category_year(db: Session, profile_id: int, year: int) -> list[dict]:
    """CC swipe totals by expense category name for a calendar year."""
    cat_label = func.coalesce(PfExpenseCategory.name, literal('Uncategorized'))
    stmt = (
        select(
            cat_label.label('category'),
            func.coalesce(func.sum(CreditCardTransaction.amount), 0).label('total_spent'),
        )
        .select_from(CreditCardTransaction)
        .join(CreditCard, CreditCard.id == CreditCardTransaction.card_id)
        .outerjoin(PfExpenseCategory, PfExpenseCategory.id == CreditCardTransaction.category_id)
        .where(
            CreditCard.profile_id == profile_id,
            func.extract('year', CreditCardTransaction.transaction_date) == year,
        )
        .group_by(cat_label)
        .order_by(desc(func.sum(CreditCardTransaction.amount)))
    )
    rows = db.execute(stmt).all()
    return [{'category': c, 'total_spent': float(t)} for c, t in rows]


def _utilization_status_label(pct: float) -> str:
    if pct < 30:
        return 'Good'
    if pct < 50:
        return 'Normal'
    if pct < 75:
        return 'Warning'
    return 'Danger'


def _card_next_due_and_overdue(db: Session, card_id: int, *, today: date) -> tuple[date | None, float]:
    """Earliest due date among open bills with balance; total overdue remaining."""
    stmt = (
        select(CreditCardBill)
        .where(
            CreditCardBill.card_id == card_id,
            CreditCardBill.status.in_(_CC_BILL_UNPAID_STATUSES),
        )
        .order_by(CreditCardBill.due_date.asc(), CreditCardBill.id.asc())
    )
    next_due: date | None = None
    overdue = 0.0
    for bill in db.scalars(stmt).all():
        rem = _bill_remaining(bill)
        if rem <= 0.01:
            continue
        if next_due is None:
            next_due = bill.due_date
        if bill.due_date < today:
            overdue += rem
    return next_due, round(overdue, 2)


def card_utilization_rows(db: Session, profile_id: int, *, today: date | None = None) -> list[dict]:
    """Per-card limits, unbilled/billed split, utilization, due dates, status label."""
    d = today or date.today()
    cards = list_cards(db, profile_id, 0, 500)
    out: list[dict] = []
    for c in cards:
        lim = float(c.card_limit or 0)
        unbilled = sum_unbilled_for_card(db, c.id)
        billed = sum_billed_outstanding_for_card(db, c.id)
        used = unbilled + billed
        avail = max(0.0, lim - used)
        pct = round((used / lim) * 100.0, 2) if lim > 0.01 else 0.0
        next_due, overdue_amt = _card_next_due_and_overdue(db, c.id, today=d)
        out.append(
            {
                'card_id': c.id,
                'card_name': c.card_name,
                'card_limit': round(lim, 2),
                'used_amount': round(used, 2),
                'available_credit': round(avail, 2),
                'unbilled_charges': round(unbilled, 2),
                'billed_outstanding': round(billed, 2),
                'utilization_pct': pct,
                'utilization_status': _utilization_status_label(pct),
                'next_due_date': next_due.isoformat() if next_due else None,
                'overdue_amount': overdue_amt,
            }
        )
    return out


_CC_PATCHABLE = frozenset(
    {
        'card_name',
        'bank_name',
        'card_limit',
        'billing_cycle_start',
        'billing_cycle_end',
        'due_days',
        'closing_day',
        'due_day',
        'interest_rate',
        'annual_fee',
        'card_network',
        'card_type',
        'currency',
        'is_active',
    }
)


def patch_credit_card_row(db: Session, card: CreditCard, patch: dict) -> CreditCard:
    for key, val in patch.items():
        if key not in _CC_PATCHABLE:
            continue
        setattr(card, key, val)
    db.commit()
    db.refresh(card)
    return card


def delete_card_for_profile(db: Session, card_id: int, profile_id: int) -> bool:
    row = get_card_for_profile(db, card_id, profile_id)
    if row is None:
        return False
    db.delete(row)
    db.commit()
    return True


def _previous_statement_closing_balance(db: Session, card_id: int, before_date: date) -> float:
    stmt = (
        select(CreditCardBill)
        .where(
            CreditCardBill.card_id == card_id,
            CreditCardBill.bill_end_date < before_date,
        )
        .order_by(CreditCardBill.bill_end_date.desc(), CreditCardBill.id.desc())
        .limit(1)
    )
    prev = db.scalars(stmt).first()
    if prev is None:
        return 0.0
    return max(0.0, round(float(prev.total_amount) - float(prev.amount_paid), 2))


def _payments_on_card_in_period(db: Session, card_id: int, start: date, end: date) -> float:
    q = select(func.coalesce(func.sum(CreditCardPayment.amount), 0)).where(
        CreditCardPayment.card_id == card_id,
        CreditCardPayment.payment_date >= start,
        CreditCardPayment.payment_date <= end,
    )
    return round(float(db.scalar(q) or 0), 2)


def _aggregate_unbilled_period_tx(tx_rows: list[CreditCardTransaction]) -> dict:
    purchases = 0.0
    fees = 0.0
    interest = 0.0
    emi_component = 0.0
    for r in tx_rows:
        t = (getattr(r, 'transaction_type', None) or 'swipe').strip().lower()
        amt = float(r.amount)
        if t == 'fee':
            fees += amt
        elif t == 'interest':
            interest += amt
        elif t == 'emi':
            purchases += amt
            emi_component += amt
        elif t == 'refund':
            purchases += amt
        else:
            purchases += amt
    return {
        'purchases': round(purchases, 2),
        'fees': round(fees, 2),
        'interest': round(interest, 2),
        'emi_component': round(emi_component, 2),
    }


def compute_minimum_due_amount(
    *,
    interest: float,
    fees: float,
    emi_component: float,
    new_balance: float,
    floor: float = MINIMUM_DUE_FLOOR,
) -> float:
    if new_balance <= 0.01:
        return 0.0
    base = float(interest) + float(fees) + float(emi_component) + 0.05 * float(new_balance)
    pct_floor = max(0.01 * float(new_balance), 0.0)
    return round(max(base, floor, pct_floor), 2)


def preview_statement_for_card(
    db: Session,
    profile_id: int,
    *,
    card_id: int,
    bill_start_date: date,
    bill_end_date: date,
) -> dict:
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
    if not tx_rows:
        raise ValueError('No unbilled charges in this period')
    opening = round(_previous_statement_closing_balance(db, card_id, bill_start_date), 2)
    payments = _payments_on_card_in_period(db, card_id, bill_start_date, bill_end_date)
    agg = _aggregate_unbilled_period_tx(tx_rows)
    new_balance = round(
        opening - payments + agg['purchases'] + agg['fees'] + agg['interest'],
        2,
    )
    if new_balance <= 0.01:
        raise ValueError('Net statement amount must be greater than zero')
    due = bill_end_date + timedelta(days=int(card.due_days))
    minimum_due = compute_minimum_due_amount(
        interest=agg['interest'],
        fees=agg['fees'],
        emi_component=agg['emi_component'],
        new_balance=new_balance,
    )
    return {
        'card_id': card_id,
        'card_name': card.card_name,
        'bill_start_date': bill_start_date.isoformat(),
        'bill_end_date': bill_end_date.isoformat(),
        'due_date': due.isoformat(),
        'opening_balance': opening,
        'payments': payments,
        'purchases': agg['purchases'],
        'fees': agg['fees'],
        'interest': agg['interest'],
        'new_balance': new_balance,
        'minimum_due': minimum_due,
        'unbilled_transaction_count': len(tx_rows),
    }


def month_end_outstanding_for_profile(db: Session, profile_id: int, year: int, month: int) -> float:
    month_end = date(year, month, calendar.monthrange(year, month)[1])
    stmt = (
        select(CreditCardBill)
        .join(CreditCard, CreditCard.id == CreditCardBill.card_id)
        .where(
            CreditCard.profile_id == profile_id,
            CreditCardBill.bill_end_date <= month_end,
        )
    )
    total = 0.0
    for bill in db.scalars(stmt).all():
        paid_q = select(func.coalesce(func.sum(CreditCardPayment.amount), 0)).where(
            CreditCardPayment.bill_id == bill.id,
            CreditCardPayment.payment_date <= month_end,
        )
        paid = float(db.scalar(paid_q) or 0)
        total += max(0.0, float(bill.total_amount) - paid)
    return round(total, 2)


def outstanding_balance_trend(
    db: Session, profile_id: int, *, end_year: int, end_month: int, months: int = 12
) -> list[dict]:
    out: list[dict] = []
    y, m = end_year, end_month
    for _ in range(months):
        bal = month_end_outstanding_for_profile(db, profile_id, y, m)
        out.append(
            {
                'year': y,
                'month': m,
                'month_label': f'{y}-{m:02d}',
                'outstanding': bal,
            }
        )
        if m == 1:
            y -= 1
            m = 12
        else:
            m -= 1
    return list(reversed(out))


def interest_charges_by_bill_month(
    db: Session, profile_id: int, *, end_year: int, end_month: int, months: int = 12
) -> list[dict]:
    out: list[dict] = []
    y, m = end_year, end_month
    for _ in range(months):
        ms = date(y, m, 1)
        me_m = date(y, m, calendar.monthrange(y, m)[1])
        stmt = (
            select(func.coalesce(func.sum(CreditCardBill.interest + CreditCardBill.late_fee), 0))
            .select_from(CreditCardBill)
            .join(CreditCard, CreditCard.id == CreditCardBill.card_id)
            .where(
                CreditCard.profile_id == profile_id,
                CreditCardBill.bill_end_date >= ms,
                CreditCardBill.bill_end_date <= me_m,
            )
        )
        amt = round(float(db.scalar(stmt) or 0), 2)
        out.append({'year': y, 'month': m, 'month_label': f'{y}-{m:02d}', 'interest_and_fees': amt})
        if m == 1:
            y -= 1
            m = 12
        else:
            m -= 1
    return list(reversed(out))


def statement_detail_for_bill(db: Session, profile_id: int, bill_id: int) -> dict | None:
    bill = get_bill_for_profile(db, bill_id, profile_id)
    if bill is None:
        return None
    card = get_card_for_profile(db, bill.card_id, profile_id)
    stmt = (
        select(CreditCardTransaction)
        .where(CreditCardTransaction.bill_id == bill_id)
        .order_by(CreditCardTransaction.transaction_date.asc(), CreditCardTransaction.id.asc())
    )
    tx_rows = list(db.scalars(stmt).all())
    lines: list[dict] = []
    if float(bill.opening_balance or 0) > 0.01:
        lines.append(
            {
                'date': bill.bill_start_date.isoformat(),
                'description': 'Opening / previous balance',
                'type': 'opening',
                'amount': float(bill.opening_balance or 0),
            }
        )
    for r in tx_rows:
        t = (r.transaction_type or 'swipe').strip().lower()
        lines.append(
            {
                'date': r.transaction_date.isoformat(),
                'description': (r.description or r.merchant or t).strip() or t,
                'type': t,
                'amount': float(r.amount),
                'transaction_id': r.id,
            }
        )
    rem = _bill_remaining(bill)
    return {
        'bill': {
            'id': bill.id,
            'card_id': bill.card_id,
            'card_name': card.card_name if card else '',
            'bill_start_date': bill.bill_start_date.isoformat(),
            'bill_end_date': bill.bill_end_date.isoformat(),
            'due_date': bill.due_date.isoformat(),
            'status': bill.status,
            'opening_balance': float(bill.opening_balance or 0),
            'total_amount': float(bill.total_amount),
            'amount_paid': float(bill.amount_paid),
            'minimum_due': float(bill.minimum_due or 0),
            'interest': float(bill.interest or 0),
            'late_fee': float(bill.late_fee or 0),
            'remaining': round(rem, 2),
        },
        'lines': lines,
    }


def mark_bill_overdue_with_late_fee(
    db: Session,
    profile_id: int,
    *,
    bill_id: int,
    late_fee_amount: float = 500.0,
) -> CreditCardBill:
    bill = get_bill_for_profile(db, bill_id, profile_id)
    if bill is None:
        raise ValueError('Bill not found')
    if bill.status == 'PAID':
        raise ValueError('Bill is already paid')
    if _bill_remaining(bill) <= 0.01:
        raise ValueError('Nothing due on this bill')
    fee = max(0.0, round(float(late_fee_amount), 2))
    if float(bill.late_fee or 0) < 0.01 and fee > 0.01:
        bill.late_fee = fee
        bill.total_amount = round(float(bill.total_amount) + fee, 2)
        bill.minimum_due = round(float(bill.minimum_due) + fee, 2)
        if bill.liability_id is not None:
            liab = db.get(FinanceLiability, bill.liability_id)
            if liab is not None and liab.profile_id == profile_id:
                liab.total_amount = round(float(liab.total_amount) + fee, 2)
                liab.outstanding_amount = round(float(liab.outstanding_amount) + fee, 2)
    bill.status = 'OVERDUE'
    db.commit()
    db.refresh(bill)
    return bill


def billed_vs_paid_monthly(
    db: Session, profile_id: int, *, end_year: int, end_month: int, months: int = 12
) -> list[dict]:
    """Per calendar month: statement totals (by bill_end_date) vs payments (by payment_date)."""
    out: list[dict] = []
    y, m = end_year, end_month
    for _ in range(months):
        ms = date(y, m, 1)
        me_m = date(y, m, calendar.monthrange(y, m)[1])
        stmt_billed = (
            select(func.coalesce(func.sum(CreditCardBill.total_amount), 0))
            .select_from(CreditCardBill)
            .join(CreditCard, CreditCard.id == CreditCardBill.card_id)
            .where(
                CreditCard.profile_id == profile_id,
                CreditCardBill.bill_end_date >= ms,
                CreditCardBill.bill_end_date <= me_m,
            )
        )
        stmt_paid = (
            select(func.coalesce(func.sum(CreditCardPayment.amount), 0))
            .select_from(CreditCardPayment)
            .join(CreditCard, CreditCard.id == CreditCardPayment.card_id)
            .where(
                CreditCard.profile_id == profile_id,
                CreditCardPayment.payment_date >= ms,
                CreditCardPayment.payment_date <= me_m,
            )
        )
        billed_amt = float(db.scalar(stmt_billed) or 0)
        paid_amt = float(db.scalar(stmt_paid) or 0)
        out.append(
            {
                'year': y,
                'month': m,
                'month_start': ms.isoformat(),
                'billed': round(billed_amt, 2),
                'paid': round(paid_amt, 2),
            }
        )
        if m == 1:
            y -= 1
            m = 12
        else:
            m -= 1
    return list(reversed(out))


def generate_bill(
    db: Session,
    profile_id: int,
    *,
    card_id: int,
    bill_start_date: date,
    bill_end_date: date,
) -> CreditCardBill:
    preview = preview_statement_for_card(
        db,
        profile_id,
        card_id=card_id,
        bill_start_date=bill_start_date,
        bill_end_date=bill_end_date,
    )
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
    if not tx_rows:
        raise ValueError('No unbilled charges in this period')

    new_balance = float(preview['new_balance'])
    opening = float(preview['opening_balance'])
    agg_interest = float(preview['interest'])
    min_due = float(preview['minimum_due'])
    due = date.fromisoformat(preview['due_date'])

    liab = FinanceLiability(
        profile_id=profile_id,
        liability_name=f'CC statement · {card.card_name} · {bill_start_date}–{bill_end_date}',
        liability_type='CREDIT_CARD_STATEMENT',
        total_amount=new_balance,
        outstanding_amount=new_balance,
        due_date=due,
        billing_cycle_day=card.billing_cycle_start,
        lender_name=card.bank_name,
        notes=f'credit_card_bill_billed card_id={card_id}',
        status='ACTIVE',
    )
    db.add(liab)
    db.flush()

    bill = CreditCardBill(
        card_id=card_id,
        bill_start_date=bill_start_date,
        bill_end_date=bill_end_date,
        total_amount=new_balance,
        due_date=due,
        status='BILLED',
        liability_id=liab.id,
        amount_paid=0,
        opening_balance=opening,
        minimum_due=min_due,
        interest=agg_interest,
        late_fee=0,
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


def _resolve_payment_amount(
    bill: CreditCardBill,
    *,
    amount: float | None,
    payment_type: str | None,
) -> float:
    rem = _bill_remaining(bill)
    pt = (payment_type or 'custom').strip().lower()
    if pt == 'full':
        return round(rem, 2)
    if pt == 'minimum':
        md = max(float(bill.minimum_due or 0), MINIMUM_DUE_FLOOR)
        return round(min(rem, md), 2)
    if amount is None or float(amount) <= 0:
        raise ValueError('Amount is required for custom payments')
    return round(float(amount), 2)


def pay_bill(
    db: Session,
    profile_id: int,
    user_id: int | None,
    *,
    bill_id: int,
    amount: float | None,
    payment_date: date,
    from_account_id: int,
    reference_number: str | None,
    payment_type: str | None = None,
    notes: str | None = None,
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
    amt = _resolve_payment_amount(bill, amount=amount, payment_type=payment_type)
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
        notes=(notes or '').strip() or None,
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
    elif payment_date > bill.due_date:
        bill.status = 'OVERDUE'
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


def apply_cc_statement_payment_from_liability(
    db: Session,
    profile_id: int,
    *,
    liability_id: int,
    amount_paid: float,
    payment_date: date,
    finance_account_id: int | None,
    payment_mode: str,
    movement_id: int | None,
    notes: str | None = None,
) -> None:
    """Mirror ``record_liability_payment`` into ``credit_card_bills`` (and ``credit_card_payments`` for BANK).

    CC utilization and available credit are derived from unbilled swipes plus ``bill.total_amount - amount_paid``,
    not from the liability row alone. Without this, paying a ``CREDIT_CARD_STATEMENT`` liability leaves the bill
    unchanged so the Credit Card page stays wrong.
    """
    bill = db.scalars(
        select(CreditCardBill)
        .join(CreditCard, CreditCard.id == CreditCardBill.card_id)
        .where(CreditCardBill.liability_id == liability_id, CreditCard.profile_id == profile_id)
    ).first()
    if bill is None:
        return
    rem = _bill_remaining(bill)
    if rem <= 0.005:
        return
    amt = min(float(amount_paid), rem)
    if amt <= 0:
        return

    mode = str(payment_mode or 'CASH').strip().upper()
    if mode == 'BANK':
        if finance_account_id is None:
            return
        pay = CreditCardPayment(
            card_id=bill.card_id,
            bill_id=bill.id,
            amount=amt,
            payment_date=payment_date,
            from_account_id=finance_account_id,
            reference_number=None,
            notes=(notes or '').strip() or None,
        )
        db.add(pay)
        db.flush()

    new_paid = round(float(bill.amount_paid) + amt, 2)
    bill.amount_paid = new_paid
    if new_paid + 0.01 >= float(bill.total_amount):
        bill.status = 'PAID'
    elif payment_date > bill.due_date:
        bill.status = 'OVERDUE'
    else:
        bill.status = 'PARTIAL'


def total_spend_month(db: Session, profile_id: int, *, period_year: int, period_month: int) -> float:
    """Sum of credit card transaction amounts (swipes) in the calendar month."""
    ms = date(period_year, period_month, 1)
    me = date(period_year, period_month, calendar.monthrange(period_year, period_month)[1])
    stmt = (
        select(func.coalesce(func.sum(CreditCardTransaction.amount), 0))
        .select_from(CreditCardTransaction)
        .join(CreditCard, CreditCard.id == CreditCardTransaction.card_id)
        .where(
            CreditCard.profile_id == profile_id,
            CreditCardTransaction.transaction_date >= ms,
            CreditCardTransaction.transaction_date <= me,
        )
    )
    return round(float(db.scalar(stmt) or 0), 2)


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
            CreditCardBill.status.in_(_CC_BILL_UNPAID_STATUSES),
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
            CreditCardBill.status.in_(_CC_BILL_UNPAID_STATUSES),
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
            CreditCardBill.status.in_(_CC_BILL_UNPAID_STATUSES),
        )
    )
    overdue = max(0.0, float(db.scalar(stmt_overdue) or 0))

    utilization_pct = round((used / total_limit) * 100.0, 2) if total_limit > 0.01 else 0.0

    stmt_paid_month = (
        select(func.coalesce(func.sum(CreditCardPayment.amount), 0))
        .select_from(CreditCardPayment)
        .join(CreditCard, CreditCard.id == CreditCardPayment.card_id)
        .where(
            CreditCard.profile_id == profile_id,
            CreditCardPayment.payment_date >= ms,
            CreditCardPayment.payment_date <= me,
        )
    )
    paid_this_month = round(float(db.scalar(stmt_paid_month) or 0), 2)

    stmt_interest_fees_month = (
        select(
            func.coalesce(func.sum(CreditCardBill.interest + CreditCardBill.late_fee), 0),
        )
        .select_from(CreditCardBill)
        .join(CreditCard, CreditCard.id == CreditCardBill.card_id)
        .where(
            CreditCard.profile_id == profile_id,
            CreditCardBill.due_date >= ms,
            CreditCardBill.due_date <= me,
            CreditCardBill.status.in_(_CC_BILL_UNPAID_STATUSES),
        )
    )
    interest_fees_due_month = round(float(db.scalar(stmt_interest_fees_month) or 0), 2)

    if period_month == 1:
        py_lm, pm_lm = period_year - 1, 12
    else:
        py_lm, pm_lm = period_year, period_month - 1
    lms = date(py_lm, pm_lm, 1)
    lme_lm = date(py_lm, pm_lm, calendar.monthrange(py_lm, pm_lm)[1])
    stmt_last_month_tx = (
        select(func.coalesce(func.sum(CreditCardTransaction.amount), 0))
        .select_from(CreditCardTransaction)
        .join(CreditCard, CreditCard.id == CreditCardTransaction.card_id)
        .where(
            CreditCard.profile_id == profile_id,
            CreditCardTransaction.transaction_date >= lms,
            CreditCardTransaction.transaction_date <= lme_lm,
        )
    )
    last_month_spend = round(float(db.scalar(stmt_last_month_tx) or 0), 2)

    y12, m12 = period_year, period_month
    for _ in range(11):
        if m12 == 1:
            y12 -= 1
            m12 = 12
        else:
            m12 -= 1
    start_12m = date(y12, m12, 1)
    stmt_tx_12m = (
        select(func.coalesce(func.sum(CreditCardTransaction.amount), 0))
        .select_from(CreditCardTransaction)
        .join(CreditCard, CreditCard.id == CreditCardTransaction.card_id)
        .where(
            CreditCard.profile_id == profile_id,
            CreditCardTransaction.transaction_date >= start_12m,
            CreditCardTransaction.transaction_date <= me,
        )
    )
    total_12m_spend = float(db.scalar(stmt_tx_12m) or 0)
    avg_monthly_spend = round(total_12m_spend / 12.0, 2)

    stmt_hi_card = (
        select(CreditCard.card_name, func.coalesce(func.sum(CreditCardTransaction.amount), 0).label('tot'))
        .select_from(CreditCardTransaction)
        .join(CreditCard, CreditCard.id == CreditCardTransaction.card_id)
        .where(
            CreditCard.profile_id == profile_id,
            CreditCardTransaction.transaction_date >= ms,
            CreditCardTransaction.transaction_date <= me,
        )
        .group_by(CreditCard.id, CreditCard.card_name)
        .order_by(desc(func.sum(CreditCardTransaction.amount)))
        .limit(1)
    )
    hi_row = db.execute(stmt_hi_card).first()
    highest_spend_card_this_month = hi_row[0] if hi_row else None
    highest_spend_amount_this_month = round(float(hi_row[1]), 2) if hi_row else 0.0

    if utilization_pct < 30:
        credit_health = 'EXCELLENT'
    elif utilization_pct < 50:
        credit_health = 'GOOD'
    elif utilization_pct < 75:
        credit_health = 'WARNING'
    else:
        credit_health = 'DANGER'

    current_bill = None
    nb = nearest_open_bill(db, profile_id)
    next_due_date = None
    if nb is not None:
        bill, ccard = nb
        next_due_date = bill.due_date.isoformat()
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
        'utilization_pct': utilization_pct,
        'paid_this_month': paid_this_month,
        'interest_fees_due_month': interest_fees_due_month,
        'last_month_spend': last_month_spend,
        'avg_monthly_spend': avg_monthly_spend,
        'highest_spend_card_this_month': highest_spend_card_this_month,
        'highest_spend_amount_this_month': highest_spend_amount_this_month,
        'next_due_date': next_due_date,
        'credit_health': credit_health,
        'card_count': len(cards),
        'current_bill': current_bill,
        'alerts': alerts,
    }
