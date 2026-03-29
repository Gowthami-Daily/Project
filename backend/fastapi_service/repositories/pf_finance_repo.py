import calendar
from datetime import date, timedelta

from sqlalchemy import and_, delete, extract, func, or_, select, update
from sqlalchemy.orm import Session, selectinload

from fastapi_service.models_extended import (
    FinanceAccount,
    FinanceAsset,
    FinanceExpense,
    FinanceIncome,
    FinanceInvestment,
    FinanceLiability,
    LiabilityPayment,
    Loan,
    LoanPayment,
    LoanSchedule,
    PfExpenseCategory,
    PfIncomeCategory,
    PfPaymentInstrument,
)


def add_months(d: date, months: int) -> date:
    m = d.month - 1 + months
    y = d.year + m // 12
    m = m % 12 + 1
    day = min(d.day, calendar.monthrange(y, m)[1])
    return date(y, m, day)


def investment_allocation_by_type(db: Session, profile_id: int) -> list[dict]:
    stmt = (
        select(FinanceInvestment.investment_type, func.sum(FinanceInvestment.invested_amount))
        .where(FinanceInvestment.profile_id == profile_id)
        .group_by(FinanceInvestment.investment_type)
    )
    return [{'type': r[0], 'value': float(r[1])} for r in db.execute(stmt).all()]


def list_investments(db: Session, profile_id: int, skip: int, limit: int) -> list[FinanceInvestment]:
    stmt = (
        select(FinanceInvestment)
        .where(FinanceInvestment.profile_id == profile_id)
        .order_by(FinanceInvestment.investment_date.desc(), FinanceInvestment.id.desc())
        .offset(skip)
        .limit(limit)
    )
    return list(db.scalars(stmt).all())


def get_investment_for_profile(db: Session, investment_id: int, profile_id: int) -> FinanceInvestment | None:
    row = db.get(FinanceInvestment, investment_id)
    if row is None or row.profile_id != profile_id:
        return None
    return row


def create_investment(db: Session, row: FinanceInvestment) -> FinanceInvestment:
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def update_investment(db: Session, row: FinanceInvestment) -> FinanceInvestment:
    db.commit()
    db.refresh(row)
    return row


def delete_investment(db: Session, row: FinanceInvestment) -> None:
    db.delete(row)
    db.commit()


def list_assets(
    db: Session,
    profile_id: int,
    skip: int,
    limit: int,
    *,
    asset_type: str | None = None,
    location_q: str | None = None,
    search: str | None = None,
) -> list[FinanceAsset]:
    stmt = select(FinanceAsset).where(FinanceAsset.profile_id == profile_id)
    at = (asset_type or '').strip().upper()
    if at and at not in ('', 'ALL'):
        stmt = stmt.where(FinanceAsset.asset_type == at)
    lq = (location_q or '').strip()
    if lq:
        stmt = stmt.where(FinanceAsset.location.ilike(f'%{lq}%'))
    q = (search or '').strip()
    if q:
        stmt = stmt.where(FinanceAsset.asset_name.ilike(f'%{q}%'))
    stmt = stmt.order_by(FinanceAsset.asset_name).offset(skip).limit(limit)
    return list(db.scalars(stmt).all())


def list_all_assets(db: Session, profile_id: int) -> list[FinanceAsset]:
    stmt = select(FinanceAsset).where(FinanceAsset.profile_id == profile_id).order_by(FinanceAsset.asset_name)
    return list(db.scalars(stmt).all())


def get_asset_for_profile(db: Session, asset_id: int, profile_id: int) -> FinanceAsset | None:
    row = db.get(FinanceAsset, asset_id)
    if row is None or row.profile_id != profile_id:
        return None
    return row


def create_asset(db: Session, row: FinanceAsset) -> FinanceAsset:
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def update_asset(db: Session, row: FinanceAsset, fields: dict) -> FinanceAsset:
    for k, v in fields.items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return row


def delete_asset(db: Session, row: FinanceAsset) -> None:
    db.delete(row)
    db.commit()


def list_distinct_asset_locations(db: Session, profile_id: int) -> list[str]:
    stmt = (
        select(FinanceAsset.location)
        .where(FinanceAsset.profile_id == profile_id)
        .where(FinanceAsset.location.is_not(None))
        .where(FinanceAsset.location != '')
        .distinct()
        .order_by(FinanceAsset.location)
    )
    return [str(x) for x in db.scalars(stmt).all() if x]


def count_assets_with_linked_liability(db: Session, profile_id: int) -> int:
    stmt = select(func.count(FinanceAsset.id)).where(
        FinanceAsset.profile_id == profile_id, FinanceAsset.linked_liability_id.is_not(None)
    )
    return int(db.scalar(stmt) or 0)


def list_liabilities(
    db: Session,
    profile_id: int,
    skip: int,
    limit: int,
    *,
    liability_type: str | None = None,
    status_filter: str | None = None,
    due_this_month: bool | None = None,
    search: str | None = None,
) -> list[FinanceLiability]:
    stmt = select(FinanceLiability).where(FinanceLiability.profile_id == profile_id)
    if liability_type and str(liability_type).strip().upper() not in ('', 'ALL'):
        stmt = stmt.where(FinanceLiability.liability_type == str(liability_type).strip().upper())
    q = (search or '').strip()
    if q:
        stmt = stmt.where(FinanceLiability.liability_name.ilike(f'%{q}%'))
    sf = (status_filter or '').strip().upper()
    today = date.today()
    if sf == 'ACTIVE':
        stmt = stmt.where(
            func.upper(FinanceLiability.status) == 'ACTIVE',
            FinanceLiability.outstanding_amount > 0.01,
        )
    elif sf == 'CLOSED' or sf == 'PAID':
        stmt = stmt.where(
            or_(
                func.upper(FinanceLiability.status) == 'CLOSED',
                FinanceLiability.outstanding_amount <= 0.01,
            )
        )
    elif sf == 'OVERDUE':
        stmt = stmt.where(
            FinanceLiability.due_date.is_not(None),
            FinanceLiability.due_date < today,
            FinanceLiability.outstanding_amount > 0.01,
            func.upper(FinanceLiability.status) == 'ACTIVE',
        )
    if due_this_month:
        ms = date(today.year, today.month, 1)
        me = date(today.year, today.month, calendar.monthrange(today.year, today.month)[1])
        stmt = stmt.where(
            FinanceLiability.due_date.is_not(None),
            FinanceLiability.due_date >= ms,
            FinanceLiability.due_date <= me,
        )
    stmt = stmt.order_by(FinanceLiability.due_date.asc().nullslast(), FinanceLiability.liability_name)
    stmt = stmt.offset(skip).limit(limit)
    return list(db.scalars(stmt).all())


def get_liability_for_profile(db: Session, liability_id: int, profile_id: int) -> FinanceLiability | None:
    row = db.get(FinanceLiability, liability_id)
    if row is None or row.profile_id != profile_id:
        return None
    return row


def create_liability(db: Session, row: FinanceLiability) -> FinanceLiability:
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def update_liability_row(db: Session, row: FinanceLiability) -> FinanceLiability:
    db.commit()
    db.refresh(row)
    return row


def delete_liability_for_profile(db: Session, profile_id: int, liability_id: int) -> None:
    row = get_liability_for_profile(db, liability_id, profile_id)
    if row is None:
        raise ValueError('Liability not found')
    db.delete(row)
    db.commit()


def list_liability_payments(db: Session, liability_id: int) -> list[LiabilityPayment]:
    stmt = (
        select(LiabilityPayment)
        .where(LiabilityPayment.liability_id == liability_id)
        .order_by(LiabilityPayment.payment_date.desc(), LiabilityPayment.id.desc())
    )
    return list(db.scalars(stmt).all())


def sum_liability_interest_paid(db: Session, liability_id: int) -> float:
    stmt = select(func.coalesce(func.sum(LiabilityPayment.interest_paid), 0)).where(
        LiabilityPayment.liability_id == liability_id
    )
    return float(db.scalar(stmt) or 0)


def record_liability_payment(
    db: Session,
    profile_id: int,
    liability_id: int,
    *,
    payment_date: date,
    amount_paid: float,
    interest_paid: float,
    payment_mode: str,
    finance_account_id: int | None,
    notes: str | None,
) -> LiabilityPayment:
    ln = get_liability_for_profile(db, liability_id, profile_id)
    if ln is None:
        raise ValueError('Liability not found')
    if str(ln.status).upper() == 'CLOSED':
        raise ValueError('Liability is closed')
    ap = float(amount_paid)
    ip = float(interest_paid)
    if ap <= 0:
        raise ValueError('Amount paid must be positive')
    due = max(0.0, float(ln.outstanding_amount))
    if ap > due + 0.02:
        raise ValueError('Payment exceeds outstanding balance')
    mode = str(payment_mode or 'CASH').strip().upper()
    acc_id: int | None = None
    if mode == 'BANK':
        if finance_account_id is None:
            raise ValueError('Select a bank account for BANK mode')
        if get_account_for_profile(db, finance_account_id, profile_id) is None:
            raise ValueError('Account not found')
        acc_id = finance_account_id
        _bump_account_balance(db, profile_id, acc_id, -ap)
    elif mode != 'CASH':
        raise ValueError('payment_mode must be CASH or BANK')
    elif finance_account_id is not None:
        raise ValueError('Do not set finance_account_id for CASH payments')
    row = LiabilityPayment(
        liability_id=liability_id,
        payment_date=payment_date,
        amount_paid=ap,
        interest_paid=ip,
        payment_mode=mode,
        finance_account_id=acc_id,
        notes=(notes.strip() or None) if notes else None,
    )
    db.add(row)
    ln.outstanding_amount = max(0.0, due - ap)
    if ln.outstanding_amount <= 0.01:
        ln.outstanding_amount = 0.0
        ln.status = 'CLOSED'
    db.commit()
    db.refresh(row)
    return row


def close_liability_if_zero(db: Session, profile_id: int, liability_id: int) -> FinanceLiability:
    ln = get_liability_for_profile(db, liability_id, profile_id)
    if ln is None:
        raise ValueError('Liability not found')
    if float(ln.outstanding_amount) > 0.01:
        raise ValueError('Outstanding balance remains')
    ln.status = 'CLOSED'
    ln.outstanding_amount = 0.0
    db.commit()
    db.refresh(ln)
    return ln


def sum_liabilities_outstanding_active(db: Session, profile_id: int) -> float:
    stmt = select(func.coalesce(func.sum(FinanceLiability.outstanding_amount), 0)).where(
        FinanceLiability.profile_id == profile_id,
        func.upper(FinanceLiability.status) == 'ACTIVE',
    )
    return float(db.scalar(stmt) or 0)


def sum_liabilities_outstanding_overdue(db: Session, profile_id: int, *, today: date | None = None) -> float:
    today = today or date.today()
    stmt = select(func.coalesce(func.sum(FinanceLiability.outstanding_amount), 0)).where(
        FinanceLiability.profile_id == profile_id,
        FinanceLiability.due_date.is_not(None),
        FinanceLiability.due_date < today,
        FinanceLiability.outstanding_amount > 0.01,
        func.upper(FinanceLiability.status) == 'ACTIVE',
    )
    return float(db.scalar(stmt) or 0)


def sum_liabilities_due_in_month(db: Session, profile_id: int, y: int, m: int) -> float:
    ms = date(y, m, 1)
    me = date(y, m, calendar.monthrange(y, m)[1])
    stmt = select(func.coalesce(func.sum(FinanceLiability.outstanding_amount), 0)).where(
        FinanceLiability.profile_id == profile_id,
        FinanceLiability.due_date.is_not(None),
        FinanceLiability.due_date >= ms,
        FinanceLiability.due_date <= me,
        FinanceLiability.outstanding_amount > 0.01,
        func.upper(FinanceLiability.status) == 'ACTIVE',
    )
    return float(db.scalar(stmt) or 0)


def liabilities_due_between(db: Session, profile_id: int, start: date, end: date) -> list[dict]:
    stmt = (
        select(
            FinanceLiability.id,
            FinanceLiability.liability_name,
            FinanceLiability.due_date,
            FinanceLiability.outstanding_amount,
            FinanceLiability.minimum_due,
        )
        .where(
            FinanceLiability.profile_id == profile_id,
            FinanceLiability.due_date.is_not(None),
            FinanceLiability.due_date >= start,
            FinanceLiability.due_date <= end,
            FinanceLiability.outstanding_amount > 0.01,
            func.upper(FinanceLiability.status) == 'ACTIVE',
        )
        .order_by(FinanceLiability.due_date, FinanceLiability.liability_name)
    )
    return [
        {
            'liability_id': int(r[0]),
            'liability_name': str(r[1]),
            'due_date': r[2],
            'outstanding_amount': float(r[3]),
            'minimum_due': float(r[4]) if r[4] is not None else None,
        }
        for r in db.execute(stmt).all()
    ]


def sum_liabilities_total_book(db: Session, profile_id: int) -> float:
    stmt = select(func.coalesce(func.sum(FinanceLiability.total_amount), 0)).where(
        FinanceLiability.profile_id == profile_id
    )
    return float(db.scalar(stmt) or 0)


def list_recent_mixed(
    db: Session,
    profile_id: int,
    limit: int,
    account_id: int | None = None,
    start: date | None = None,
    end: date | None = None,
) -> list[dict]:
    fetch_n = max(limit * 5, 100)
    inc = list_income(db, profile_id, 0, fetch_n, start, end, account_id)
    exp = list_expenses(db, profile_id, 0, fetch_n, start, end, account_id)
    merged: list[dict] = []
    for i in inc:
        merged.append(
            {
                'kind': 'income',
                'id': i.id,
                'date': i.entry_date.isoformat(),
                'amount': float(i.amount),
                'category': i.category,
                'description': i.description,
            }
        )
    for e in exp:
        merged.append(
            {
                'kind': 'expense',
                'id': e.id,
                'date': e.entry_date.isoformat(),
                'amount': float(e.amount),
                'category': e.category,
                'description': e.description,
            }
        )
    merged.sort(key=lambda r: r['date'], reverse=True)
    return merged[:limit]


def list_accounts(db: Session, profile_id: int, skip: int, limit: int) -> list[FinanceAccount]:
    stmt = (
        select(FinanceAccount)
        .where(FinanceAccount.profile_id == profile_id)
        .order_by(FinanceAccount.account_name)
        .offset(skip)
        .limit(limit)
    )
    return list(db.scalars(stmt).all())


def create_account(db: Session, row: FinanceAccount) -> FinanceAccount:
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def get_account_for_profile(db: Session, account_id: int, profile_id: int) -> FinanceAccount | None:
    row = db.get(FinanceAccount, account_id)
    if row is None or row.profile_id != profile_id:
        return None
    return row


def update_account_balance(db: Session, row: FinanceAccount, balance: float) -> FinanceAccount:
    row.balance = balance
    db.commit()
    db.refresh(row)
    return row


def delete_account(db: Session, profile_id: int, account_id: int) -> None:
    row = get_account_for_profile(db, account_id, profile_id)
    if row is None:
        raise ValueError('Account not found')
    db.execute(
        delete(FinanceIncome).where(
            FinanceIncome.profile_id == profile_id,
            FinanceIncome.account_id == account_id,
        )
    )
    db.execute(
        delete(FinanceExpense).where(
            FinanceExpense.profile_id == profile_id,
            FinanceExpense.account_id == account_id,
        )
    )
    db.delete(row)
    db.commit()


def get_income_for_profile(db: Session, income_id: int, profile_id: int) -> FinanceIncome | None:
    row = db.get(FinanceIncome, income_id)
    if row is None or row.profile_id != profile_id:
        return None
    return row


def get_expense_for_profile(db: Session, expense_id: int, profile_id: int) -> FinanceExpense | None:
    row = db.get(FinanceExpense, expense_id)
    if row is None or row.profile_id != profile_id:
        return None
    return row


def delete_income(db: Session, profile_id: int, row: FinanceIncome) -> None:
    if row.account_id is not None:
        _bump_account_balance(db, profile_id, row.account_id, -float(row.amount))
    db.delete(row)
    db.commit()


def _expense_balance_applies(row: FinanceExpense) -> bool:
    st = (getattr(row, 'payment_status', None) or 'PAID')
    return str(st).upper() == 'PAID'


def delete_expense(db: Session, profile_id: int, row: FinanceExpense) -> None:
    if _expense_balance_applies(row) and row.account_id is not None:
        _bump_account_balance(db, profile_id, row.account_id, float(row.amount))
    db.delete(row)
    db.commit()


def update_income(
    db: Session, profile_id: int, row: FinanceIncome, patch: dict
) -> FinanceIncome:
    old_acc = row.account_id
    old_amt = float(row.amount)
    if old_acc is not None:
        _bump_account_balance(db, profile_id, old_acc, -old_amt)

    if 'amount' in patch:
        row.amount = patch['amount']
    if 'category' in patch:
        row.category = patch['category']
    if 'income_type' in patch:
        row.income_type = patch['income_type']
    if 'entry_date' in patch:
        row.entry_date = patch['entry_date']
    if 'description' in patch:
        row.description = patch['description']
    if 'account_id' in patch:
        aid = patch['account_id']
        if aid is not None and get_account_for_profile(db, aid, profile_id) is None:
            raise ValueError('Account not found or not in this profile')
        row.account_id = patch['account_id']
    if 'income_category_id' in patch:
        row.income_category_id = patch['income_category_id']
        iid = patch['income_category_id']
        if iid is not None:
            ic = db.get(PfIncomeCategory, int(iid))
            if ic:
                row.category = ic.name
    if 'received_from' in patch:
        row.received_from = patch['received_from']
    if 'payment_method' in patch:
        row.payment_method = patch['payment_method']
    if 'receipt_image_url' in patch:
        row.receipt_image_url = patch['receipt_image_url']
    if 'is_recurring' in patch:
        row.is_recurring = bool(patch['is_recurring'])
    if 'recurring_type' in patch:
        row.recurring_type = patch['recurring_type']

    new_acc = row.account_id
    new_amt = float(row.amount)
    if new_acc is not None:
        _bump_account_balance(db, profile_id, new_acc, new_amt)

    db.commit()
    db.refresh(row)
    return row


def update_expense(
    db: Session, profile_id: int, row: FinanceExpense, patch: dict
) -> FinanceExpense:
    old_applies = _expense_balance_applies(row)
    old_acc = row.account_id
    old_amt = float(row.amount)
    if old_applies and old_acc is not None:
        _bump_account_balance(db, profile_id, old_acc, old_amt)

    if 'amount' in patch:
        row.amount = patch['amount']
    if 'category' in patch:
        row.category = patch['category']
    if 'entry_date' in patch:
        row.entry_date = patch['entry_date']
    if 'description' in patch:
        row.description = patch['description']
    if 'account_id' in patch:
        aid = patch['account_id']
        if aid is not None and get_account_for_profile(db, aid, profile_id) is None:
            raise ValueError('Account not found or not in this profile')
        row.account_id = patch['account_id']
    if 'expense_category_id' in patch:
        row.expense_category_id = patch['expense_category_id']
        eid = patch['expense_category_id']
        if eid is not None:
            pc = db.get(PfExpenseCategory, eid)
            if pc:
                row.category = pc.name
    if 'paid_by' in patch:
        row.paid_by = patch['paid_by']
    if 'payment_method' in patch:
        row.payment_method = patch['payment_method']
    if 'bill_image_url' in patch:
        row.bill_image_url = patch['bill_image_url']
    if 'payment_instrument_id' in patch:
        row.payment_instrument_id = patch['payment_instrument_id']
    if 'is_recurring' in patch:
        row.is_recurring = bool(patch['is_recurring'])
    if 'recurring_type' in patch:
        row.recurring_type = patch['recurring_type']
    if 'payment_status' in patch:
        ps = patch['payment_status']
        row.payment_status = str(ps or 'PAID').strip().upper() or 'PAID'

    new_applies = _expense_balance_applies(row)
    new_acc = row.account_id
    new_amt = float(row.amount)
    if new_applies and new_acc is not None:
        _bump_account_balance(db, profile_id, new_acc, -new_amt)

    db.commit()
    db.refresh(row)
    return row


def _effective_account_id_for_cash(db: Session, profile_id: int, account_id: int | None) -> int | None:
    """If ``account_id`` is set, use it. If ``None`` and the profile has exactly one account, use that."""
    if account_id is not None:
        return account_id
    stmt = (
        select(FinanceAccount.id)
        .where(FinanceAccount.profile_id == profile_id)
        .order_by(FinanceAccount.id)
        .limit(2)
    )
    ids = list(db.scalars(stmt).all())
    if len(ids) == 1:
        return ids[0]
    return None


def _bump_account_balance(db: Session, profile_id: int, account_id: int, delta: float) -> None:
    acc = get_account_for_profile(db, account_id, profile_id)
    if acc is None:
        raise ValueError('Account not found or not in this profile')
    acc.balance = float(acc.balance) + float(delta)


def list_income(
    db: Session,
    profile_id: int,
    skip: int,
    limit: int,
    start: date | None,
    end: date | None,
    account_id: int | None = None,
) -> list[FinanceIncome]:
    stmt = (
        select(FinanceIncome)
        .where(FinanceIncome.profile_id == profile_id)
        .options(selectinload(FinanceIncome.income_category_rel))
    )
    if account_id is not None:
        stmt = stmt.where(FinanceIncome.account_id == account_id)
    if start:
        stmt = stmt.where(FinanceIncome.entry_date >= start)
    if end:
        stmt = stmt.where(FinanceIncome.entry_date <= end)
    stmt = stmt.order_by(FinanceIncome.entry_date.desc()).offset(skip).limit(limit)
    return list(db.scalars(stmt).all())


def create_income(db: Session, row: FinanceIncome, *, adjust_account_balance: bool = True) -> FinanceIncome:
    if adjust_account_balance:
        eff = _effective_account_id_for_cash(db, row.profile_id, row.account_id)
        if eff is not None:
            _bump_account_balance(db, row.profile_id, eff, float(row.amount))
            row.account_id = eff
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def list_expenses(
    db: Session,
    profile_id: int,
    skip: int,
    limit: int,
    start: date | None,
    end: date | None,
    account_id: int | None = None,
) -> list[FinanceExpense]:
    stmt = (
        select(FinanceExpense)
        .where(FinanceExpense.profile_id == profile_id)
        .options(
            selectinload(FinanceExpense.expense_category_rel),
            selectinload(FinanceExpense.payment_instrument_rel),
        )
    )
    if account_id is not None:
        stmt = stmt.where(FinanceExpense.account_id == account_id)
    if start:
        stmt = stmt.where(FinanceExpense.entry_date >= start)
    if end:
        stmt = stmt.where(FinanceExpense.entry_date <= end)
    stmt = stmt.order_by(FinanceExpense.entry_date.desc()).offset(skip).limit(limit)
    return list(db.scalars(stmt).all())


def create_expense(db: Session, row: FinanceExpense, *, adjust_account_balance: bool = True) -> FinanceExpense:
    if adjust_account_balance and _expense_balance_applies(row):
        eff = _effective_account_id_for_cash(db, row.profile_id, row.account_id)
        if eff is not None:
            _bump_account_balance(db, row.profile_id, eff, -float(row.amount))
            row.account_id = eff
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def sum_income(
    db: Session,
    profile_id: int,
    start: date | None,
    end: date | None,
    account_id: int | None = None,
) -> float:
    stmt = select(func.coalesce(func.sum(FinanceIncome.amount), 0)).where(FinanceIncome.profile_id == profile_id)
    if account_id is not None:
        stmt = stmt.where(FinanceIncome.account_id == account_id)
    if start:
        stmt = stmt.where(FinanceIncome.entry_date >= start)
    if end:
        stmt = stmt.where(FinanceIncome.entry_date <= end)
    return float(db.scalar(stmt) or 0)


def sum_expense(
    db: Session,
    profile_id: int,
    start: date | None,
    end: date | None,
    account_id: int | None = None,
) -> float:
    stmt = select(func.coalesce(func.sum(FinanceExpense.amount), 0)).where(FinanceExpense.profile_id == profile_id)
    if account_id is not None:
        stmt = stmt.where(FinanceExpense.account_id == account_id)
    if start:
        stmt = stmt.where(FinanceExpense.entry_date >= start)
    if end:
        stmt = stmt.where(FinanceExpense.entry_date <= end)
    return float(db.scalar(stmt) or 0)


def sum_income_unassigned(db: Session, profile_id: int, start: date | None, end: date | None) -> float:
    stmt = (
        select(func.coalesce(func.sum(FinanceIncome.amount), 0))
        .where(FinanceIncome.profile_id == profile_id)
        .where(FinanceIncome.account_id.is_(None))
    )
    if start:
        stmt = stmt.where(FinanceIncome.entry_date >= start)
    if end:
        stmt = stmt.where(FinanceIncome.entry_date <= end)
    return float(db.scalar(stmt) or 0)


def sum_expense_unassigned(db: Session, profile_id: int, start: date | None, end: date | None) -> float:
    stmt = (
        select(func.coalesce(func.sum(FinanceExpense.amount), 0))
        .where(FinanceExpense.profile_id == profile_id)
        .where(FinanceExpense.account_id.is_(None))
    )
    if start:
        stmt = stmt.where(FinanceExpense.entry_date >= start)
    if end:
        stmt = stmt.where(FinanceExpense.entry_date <= end)
    return float(db.scalar(stmt) or 0)


def sum_investments_invested(db: Session, profile_id: int) -> float:
    stmt = select(func.coalesce(func.sum(FinanceInvestment.invested_amount), 0)).where(
        FinanceInvestment.profile_id == profile_id
    )
    return float(db.scalar(stmt) or 0)


def sum_assets(db: Session, profile_id: int) -> float:
    """Sum of **effective** fixed-asset values (depreciation applied when configured)."""
    from fastapi_service.services.pf_asset_valuation import effective_current_value

    rows = list_all_assets(db, profile_id)
    return sum(effective_current_value(r) for r in rows)


def sum_liabilities(db: Session, profile_id: int) -> float:
    """Total outstanding on active liabilities (money you owe) — used in net worth."""
    return sum_liabilities_outstanding_active(db, profile_id)


def sum_account_balances(db: Session, profile_id: int) -> float:
    stmt = select(func.coalesce(func.sum(FinanceAccount.balance), 0)).where(
        FinanceAccount.profile_id == profile_id
    )
    return float(db.scalar(stmt) or 0)


def income_by_month(
    db: Session, profile_id: int, year: int, account_id: int | None = None
) -> list[tuple[str, float]]:
    """Month key YYYY-MM — PostgreSQL ``to_char`` or SQLite ``strftime``."""
    dialect = db.get_bind().dialect.name
    if dialect == 'postgresql':
        ym = func.to_char(FinanceIncome.entry_date, 'YYYY-MM').label('ym')
        yfilt = extract('year', FinanceIncome.entry_date) == year
    else:
        ym = func.strftime('%Y-%m', FinanceIncome.entry_date).label('ym')
        yfilt = func.strftime('%Y', FinanceIncome.entry_date) == str(year)
    stmt = (
        select(ym, func.sum(FinanceIncome.amount))
        .where(FinanceIncome.profile_id == profile_id)
        .where(yfilt)
    )
    if account_id is not None:
        stmt = stmt.where(FinanceIncome.account_id == account_id)
    stmt = stmt.group_by(ym).order_by(ym)
    return [(r[0], float(r[1])) for r in db.execute(stmt).all()]


def expense_by_month(
    db: Session, profile_id: int, year: int, account_id: int | None = None
) -> list[tuple[str, float]]:
    dialect = db.get_bind().dialect.name
    if dialect == 'postgresql':
        ym = func.to_char(FinanceExpense.entry_date, 'YYYY-MM').label('ym')
        yfilt = extract('year', FinanceExpense.entry_date) == year
    else:
        ym = func.strftime('%Y-%m', FinanceExpense.entry_date).label('ym')
        yfilt = func.strftime('%Y', FinanceExpense.entry_date) == str(year)
    stmt = (
        select(ym, func.sum(FinanceExpense.amount))
        .where(FinanceExpense.profile_id == profile_id)
        .where(yfilt)
    )
    if account_id is not None:
        stmt = stmt.where(FinanceExpense.account_id == account_id)
    stmt = stmt.group_by(ym).order_by(ym)
    return [(r[0], float(r[1])) for r in db.execute(stmt).all()]


def expense_by_category(
    db: Session,
    profile_id: int,
    start: date | None,
    end: date | None,
    account_id: int | None = None,
) -> list[tuple[str, float]]:
    stmt = select(FinanceExpense.category, func.sum(FinanceExpense.amount)).where(
        FinanceExpense.profile_id == profile_id
    )
    if account_id is not None:
        stmt = stmt.where(FinanceExpense.account_id == account_id)
    if start:
        stmt = stmt.where(FinanceExpense.entry_date >= start)
    if end:
        stmt = stmt.where(FinanceExpense.entry_date <= end)
    stmt = stmt.group_by(FinanceExpense.category)
    return [(r[0], float(r[1])) for r in db.execute(stmt).all()]


def list_pf_expense_categories(db: Session) -> list[PfExpenseCategory]:
    stmt = select(PfExpenseCategory).order_by(PfExpenseCategory.name)
    return list(db.scalars(stmt).all())


def list_pf_income_categories(db: Session) -> list[PfIncomeCategory]:
    stmt = select(PfIncomeCategory).order_by(PfIncomeCategory.name)
    return list(db.scalars(stmt).all())


def get_pf_payment_instrument(db: Session, instrument_id: int, profile_id: int) -> PfPaymentInstrument | None:
    row = db.get(PfPaymentInstrument, instrument_id)
    if row is None or row.profile_id != profile_id:
        return None
    return row


def list_pf_payment_instruments(db: Session, profile_id: int, kind: str | None = None) -> list[PfPaymentInstrument]:
    stmt = select(PfPaymentInstrument).where(PfPaymentInstrument.profile_id == profile_id)
    if kind:
        stmt = stmt.where(PfPaymentInstrument.kind == kind.strip().lower())
    stmt = stmt.order_by(PfPaymentInstrument.label)
    return list(db.scalars(stmt).all())


def create_pf_payment_instrument(db: Session, row: PfPaymentInstrument) -> PfPaymentInstrument:
    row.kind = (row.kind or '').strip().lower()
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def delete_pf_payment_instrument(db: Session, profile_id: int, instrument_id: int) -> None:
    row = get_pf_payment_instrument(db, instrument_id, profile_id)
    if row is None:
        raise ValueError('Payment instrument not found')
    db.execute(
        update(FinanceExpense)
        .where(FinanceExpense.payment_instrument_id == instrument_id)
        .values(payment_instrument_id=None)
    )
    db.delete(row)
    db.commit()


def normalize_expense_payment_instrument(
    db: Session, profile_id: int, payment_method: str | None, instrument_id: int | None
) -> int | None:
    """Return instrument id for card/upi; clear for cash/bank_transfer."""
    m = (payment_method or '').strip().lower()
    if m in ('card', 'upi'):
        if instrument_id is None:
            raise ValueError('Select which card or UPI was used')
        inst = get_pf_payment_instrument(db, int(instrument_id), profile_id)
        if inst is None:
            raise ValueError('Payment instrument not found')
        if inst.kind != m:
            raise ValueError('Selected instrument does not match payment method')
        return int(instrument_id)
    return None


def resolve_expense_payment_fields(
    db: Session,
    profile_id: int,
    payment_status: str | None,
    payment_method: str | None,
    account_id: int | None,
    instrument_id: int | None,
) -> tuple[int | None, int | None]:
    """
    Returns ``(account_id, payment_instrument_id)`` for an expense row.
    Card/UPI always uses the instrument's linked ``finance_account_id``.
    """
    ps = (payment_status or 'PAID').upper()
    m = (payment_method or '').strip().lower()
    if m in ('card', 'upi'):
        nid = normalize_expense_payment_instrument(db, profile_id, payment_method, instrument_id)
        inst = get_pf_payment_instrument(db, nid, profile_id)
        assert inst is not None
        if inst.finance_account_id is None:
            raise ValueError(
                'This card/UPI has no linked account. Remove and save it again, choosing which bank/cash account it draws from.'
            )
        if get_account_for_profile(db, inst.finance_account_id, profile_id) is None:
            raise ValueError('Linked account not found')
        return inst.finance_account_id, nid

    if ps == 'PAID':
        if account_id is None:
            raise ValueError('Select how you paid (account).')
        if get_account_for_profile(db, account_id, profile_id) is None:
            raise ValueError('Account not found')
    elif account_id is not None and get_account_for_profile(db, account_id, profile_id) is None:
        raise ValueError('Account not found')
    return account_id, None


def next_pending_emi_by_loan(db: Session, profile_id: int) -> dict[int, tuple[date, float]]:
    """Earliest unpaid schedule installment per loan (due date + EMI amount)."""
    stmt = (
        select(LoanSchedule.loan_id, LoanSchedule.due_date, LoanSchedule.emi_amount)
        .join(Loan, Loan.id == LoanSchedule.loan_id)
        .where(Loan.profile_id == profile_id, func.lower(LoanSchedule.payment_status) != 'paid')
        .order_by(LoanSchedule.loan_id, LoanSchedule.due_date, LoanSchedule.emi_number)
    )
    out: dict[int, tuple[date, float]] = {}
    for lid, due, amt in db.execute(stmt).all():
        if lid not in out:
            out[int(lid)] = (due, float(amt))
    return out


def sum_pending_loan_schedule_emis(db: Session, profile_id: int) -> float:
    stmt = (
        select(func.coalesce(func.sum(LoanSchedule.emi_amount), 0))
        .select_from(LoanSchedule)
        .join(Loan, LoanSchedule.loan_id == Loan.id)
        .where(Loan.profile_id == profile_id, func.lower(LoanSchedule.payment_status) != 'paid')
    )
    return float(db.scalar(stmt) or 0)


def sum_account_balances_cash_vs_bank(db: Session, profile_id: int) -> dict[str, float]:
    rows = list_accounts(db, profile_id, 0, 500)
    cash = 0.0
    bank = 0.0
    for a in rows:
        t = (a.account_type or '').lower()
        if 'cash' in t or 'wallet' in t or t in ('petty', 'hand'):
            cash += float(a.balance)
        else:
            bank += float(a.balance)
    return {'cash': cash, 'bank': bank, 'total': cash + bank}


def sum_expense_categories_exact(
    db: Session,
    profile_id: int,
    start: date | None,
    end: date | None,
    category_names: list[str],
) -> float:
    if not category_names:
        return 0.0
    stmt = select(func.coalesce(func.sum(FinanceExpense.amount), 0)).where(
        FinanceExpense.profile_id == profile_id,
        FinanceExpense.category.in_(category_names),
    )
    if start:
        stmt = stmt.where(FinanceExpense.entry_date >= start)
    if end:
        stmt = stmt.where(FinanceExpense.entry_date <= end)
    return float(db.scalar(stmt) or 0)


def sum_expense_emi_categories(
    db: Session, profile_id: int, start: date | None, end: date | None
) -> float:
    emi_exact = ('EMI – Loans', 'EMI – Credit Card')
    stmt = select(func.coalesce(func.sum(FinanceExpense.amount), 0)).where(
        FinanceExpense.profile_id == profile_id,
        or_(
            FinanceExpense.category.in_(emi_exact),
            FinanceExpense.category.ilike('%EMI%'),
        ),
    )
    if start:
        stmt = stmt.where(FinanceExpense.entry_date >= start)
    if end:
        stmt = stmt.where(FinanceExpense.entry_date <= end)
    return float(db.scalar(stmt) or 0)


def expense_by_paid_by(
    db: Session,
    profile_id: int,
    start: date | None,
    end: date | None,
) -> list[tuple[str, float]]:
    stmt = select(FinanceExpense.paid_by, func.sum(FinanceExpense.amount)).where(
        FinanceExpense.profile_id == profile_id
    )
    if start:
        stmt = stmt.where(FinanceExpense.entry_date >= start)
    if end:
        stmt = stmt.where(FinanceExpense.entry_date <= end)
    stmt = stmt.group_by(FinanceExpense.paid_by)
    merged: dict[str, float] = {}
    for pb, total in db.execute(stmt).all():
        label = (pb or '').strip() or '(Unspecified)'
        merged[label] = merged.get(label, 0.0) + float(total)
    return sorted(merged.items(), key=lambda x: -x[1])


def expense_by_account_breakdown(
    db: Session,
    profile_id: int,
    start: date | None,
    end: date | None,
) -> list[tuple[int | None, str, float]]:
    an = func.coalesce(FinanceAccount.account_name, '(No account)')
    stmt = (
        select(FinanceExpense.account_id, an, func.sum(FinanceExpense.amount))
        .outerjoin(FinanceAccount, FinanceExpense.account_id == FinanceAccount.id)
        .where(FinanceExpense.profile_id == profile_id)
    )
    if start:
        stmt = stmt.where(FinanceExpense.entry_date >= start)
    if end:
        stmt = stmt.where(FinanceExpense.entry_date <= end)
    stmt = stmt.group_by(FinanceExpense.account_id, an).order_by(func.sum(FinanceExpense.amount).desc())
    return [(r[0], str(r[1]), float(r[2])) for r in db.execute(stmt).all()]


def _expense_scope(
    profile_id: int,
    start: date | None,
    end: date | None,
    account_id: int | None = None,
    expense_category_id: int | None = None,
    paid_by_contains: str | None = None,
):
    conds = [FinanceExpense.profile_id == profile_id]
    if start is not None:
        conds.append(FinanceExpense.entry_date >= start)
    if end is not None:
        conds.append(FinanceExpense.entry_date <= end)
    if account_id is not None:
        conds.append(FinanceExpense.account_id == account_id)
    if expense_category_id is not None:
        conds.append(FinanceExpense.expense_category_id == expense_category_id)
    pb = (paid_by_contains or '').strip()
    if pb:
        conds.append(FinanceExpense.paid_by.ilike(f'%{pb}%'))
    return and_(*conds)


def _income_scope(
    profile_id: int,
    start: date | None,
    end: date | None,
    account_id: int | None = None,
    income_category_id: int | None = None,
    person_contains: str | None = None,
):
    conds = [FinanceIncome.profile_id == profile_id]
    if start is not None:
        conds.append(FinanceIncome.entry_date >= start)
    if end is not None:
        conds.append(FinanceIncome.entry_date <= end)
    if account_id is not None:
        conds.append(FinanceIncome.account_id == account_id)
    if income_category_id is not None:
        conds.append(FinanceIncome.income_category_id == income_category_id)
    p = (person_contains or '').strip()
    if p:
        conds.append(
            or_(
                FinanceIncome.received_from.ilike(f'%{p}%'),
                FinanceIncome.description.ilike(f'%{p}%'),
            )
        )
    return and_(*conds)


def sum_expense_scoped(
    db: Session,
    profile_id: int,
    start: date | None,
    end: date | None,
    *,
    account_id: int | None = None,
    expense_category_id: int | None = None,
    paid_by_contains: str | None = None,
) -> float:
    stmt = select(func.coalesce(func.sum(FinanceExpense.amount), 0)).where(
        _expense_scope(profile_id, start, end, account_id, expense_category_id, paid_by_contains)
    )
    return float(db.scalar(stmt) or 0)


def sum_income_scoped(
    db: Session,
    profile_id: int,
    start: date | None,
    end: date | None,
    *,
    account_id: int | None = None,
    income_category_id: int | None = None,
    person_contains: str | None = None,
) -> float:
    stmt = select(func.coalesce(func.sum(FinanceIncome.amount), 0)).where(
        _income_scope(profile_id, start, end, account_id, income_category_id, person_contains)
    )
    return float(db.scalar(stmt) or 0)


def expense_by_category_scoped(
    db: Session,
    profile_id: int,
    start: date | None,
    end: date | None,
    *,
    account_id: int | None = None,
    expense_category_id: int | None = None,
    paid_by_contains: str | None = None,
) -> list[tuple[str, float]]:
    stmt = (
        select(FinanceExpense.category, func.sum(FinanceExpense.amount))
        .where(_expense_scope(profile_id, start, end, account_id, expense_category_id, paid_by_contains))
        .group_by(FinanceExpense.category)
        .order_by(func.sum(FinanceExpense.amount).desc())
    )
    return [(str(r[0]), float(r[1])) for r in db.execute(stmt).all()]


def expense_by_paid_by_scoped(
    db: Session,
    profile_id: int,
    start: date | None,
    end: date | None,
    *,
    account_id: int | None = None,
    expense_category_id: int | None = None,
    paid_by_contains: str | None = None,
) -> list[tuple[str, float]]:
    stmt = select(FinanceExpense.paid_by, func.sum(FinanceExpense.amount)).where(
        _expense_scope(profile_id, start, end, account_id, expense_category_id, paid_by_contains)
    )
    stmt = stmt.group_by(FinanceExpense.paid_by)
    merged: dict[str, float] = {}
    for pb, total in db.execute(stmt).all():
        label = (pb or '').strip() or '(Unspecified)'
        merged[label] = merged.get(label, 0.0) + float(total)
    return sorted(merged.items(), key=lambda x: -x[1])


def expense_by_account_scoped(
    db: Session,
    profile_id: int,
    start: date | None,
    end: date | None,
    *,
    account_id: int | None = None,
    expense_category_id: int | None = None,
    paid_by_contains: str | None = None,
) -> list[tuple[int | None, str, float]]:
    an = func.coalesce(FinanceAccount.account_name, '(No account)')
    stmt = (
        select(FinanceExpense.account_id, an, func.sum(FinanceExpense.amount))
        .outerjoin(FinanceAccount, FinanceExpense.account_id == FinanceAccount.id)
        .where(_expense_scope(profile_id, start, end, account_id, expense_category_id, paid_by_contains))
        .group_by(FinanceExpense.account_id, an)
        .order_by(func.sum(FinanceExpense.amount).desc())
    )
    return [(r[0], str(r[1]), float(r[2])) for r in db.execute(stmt).all()]


def sum_expense_emi_scoped(
    db: Session,
    profile_id: int,
    start: date | None,
    end: date | None,
    *,
    account_id: int | None = None,
    expense_category_id: int | None = None,
    paid_by_contains: str | None = None,
) -> float:
    emi_exact = ('EMI – Loans', 'EMI – Credit Card')
    stmt = select(func.coalesce(func.sum(FinanceExpense.amount), 0)).where(
        _expense_scope(profile_id, start, end, account_id, expense_category_id, paid_by_contains),
        or_(
            FinanceExpense.category.in_(emi_exact),
            FinanceExpense.category.ilike('%EMI%'),
        ),
    )
    return float(db.scalar(stmt) or 0)


def sum_investments_added_in_range(
    db: Session,
    profile_id: int,
    start: date | None,
    end: date | None,
) -> float:
    stmt = select(func.coalesce(func.sum(FinanceInvestment.invested_amount), 0)).where(
        FinanceInvestment.profile_id == profile_id
    )
    if start is not None:
        stmt = stmt.where(FinanceInvestment.investment_date >= start)
    if end is not None:
        stmt = stmt.where(FinanceInvestment.investment_date <= end)
    return float(db.scalar(stmt) or 0)


def sum_loan_payments_in_range(
    db: Session,
    profile_id: int,
    start: date | None,
    end: date | None,
) -> float:
    stmt = (
        select(func.coalesce(func.sum(LoanPayment.total_paid), 0))
        .join(Loan, LoanPayment.loan_id == Loan.id)
        .where(Loan.profile_id == profile_id)
    )
    if start is not None:
        stmt = stmt.where(LoanPayment.payment_date >= start)
    if end is not None:
        stmt = stmt.where(LoanPayment.payment_date <= end)
    return float(db.scalar(stmt) or 0)


def sum_loan_interest_collected_in_range(
    db: Session,
    profile_id: int,
    start: date | None,
    end: date | None,
) -> float:
    stmt = (
        select(func.coalesce(func.sum(LoanPayment.interest_paid), 0))
        .join(Loan, LoanPayment.loan_id == Loan.id)
        .where(Loan.profile_id == profile_id)
    )
    if start is not None:
        stmt = stmt.where(LoanPayment.payment_date >= start)
    if end is not None:
        stmt = stmt.where(LoanPayment.payment_date <= end)
    return float(db.scalar(stmt) or 0)


def sum_loan_originations_in_range(
    db: Session,
    profile_id: int,
    start: date | None,
    end: date | None,
) -> float:
    """Approximate new lending: loans whose start_date falls in the window (initial principal at booking)."""
    stmt = select(func.coalesce(func.sum(Loan.loan_amount), 0)).where(Loan.profile_id == profile_id)
    if start is not None:
        stmt = stmt.where(Loan.start_date >= start)
    if end is not None:
        stmt = stmt.where(Loan.start_date <= end)
    return float(db.scalar(stmt) or 0)


def sum_liability_cash_paid_in_range(
    db: Session,
    profile_id: int,
    start: date | None,
    end: date | None,
) -> float:
    stmt = (
        select(func.coalesce(func.sum(LiabilityPayment.amount_paid), 0))
        .join(FinanceLiability, LiabilityPayment.liability_id == FinanceLiability.id)
        .where(FinanceLiability.profile_id == profile_id)
    )
    if start is not None:
        stmt = stmt.where(LiabilityPayment.payment_date >= start)
    if end is not None:
        stmt = stmt.where(LiabilityPayment.payment_date <= end)
    return float(db.scalar(stmt) or 0)


def sum_liability_interest_paid_in_range(
    db: Session,
    profile_id: int,
    start: date | None,
    end: date | None,
) -> float:
    stmt = (
        select(func.coalesce(func.sum(LiabilityPayment.interest_paid), 0))
        .join(FinanceLiability, LiabilityPayment.liability_id == FinanceLiability.id)
        .where(FinanceLiability.profile_id == profile_id)
    )
    if start is not None:
        stmt = stmt.where(LiabilityPayment.payment_date >= start)
    if end is not None:
        stmt = stmt.where(LiabilityPayment.payment_date <= end)
    return float(db.scalar(stmt) or 0)


def liability_repayments_by_loan_in_range(
    db: Session,
    profile_id: int,
    start: date | None,
    end: date | None,
) -> list[tuple[str, float]]:
    stmt = (
        select(FinanceLiability.liability_name, func.sum(LiabilityPayment.amount_paid))
        .join(FinanceLiability, LiabilityPayment.liability_id == FinanceLiability.id)
        .where(FinanceLiability.profile_id == profile_id)
    )
    if start is not None:
        stmt = stmt.where(LiabilityPayment.payment_date >= start)
    if end is not None:
        stmt = stmt.where(LiabilityPayment.payment_date <= end)
    stmt = stmt.group_by(FinanceLiability.liability_name).order_by(func.sum(LiabilityPayment.amount_paid).desc())
    return [(str(r[0]), float(r[1])) for r in db.execute(stmt).all()]


def list_loans(
    db: Session,
    profile_id: int,
    *,
    loan_type: str | None = None,
    search: str | None = None,
) -> list[Loan]:
    stmt = select(Loan).where(Loan.profile_id == profile_id)
    if loan_type and str(loan_type).strip().upper() not in ('', 'ALL'):
        stmt = stmt.where(Loan.loan_type == str(loan_type).strip().upper())
    q = (search or '').strip()
    if q:
        stmt = stmt.where(Loan.borrower_name.ilike(f'%{q}%'))
    stmt = stmt.order_by(Loan.start_date.desc())
    return list(db.scalars(stmt).all())


def loan_balance_due_for_loan(db: Session, ln: Loan) -> float:
    if _loan_has_schedule(db, ln.id):
        return _unpaid_schedule_total(db, ln.id)
    if ln.remaining_amount is not None:
        return max(0.0, float(ln.remaining_amount))
    last_bal = db.scalar(
        select(LoanPayment.balance_remaining)
        .where(LoanPayment.loan_id == ln.id)
        .order_by(LoanPayment.payment_date.desc(), LoanPayment.id.desc())
        .limit(1)
    )
    if last_bal is not None:
        return max(0.0, float(last_bal))
    return max(0.0, float(ln.loan_amount))


def loan_overdue_unpaid_emi_sum(db: Session, loan_id: int, *, today: date | None = None) -> float:
    today = today or date.today()
    stmt = select(func.coalesce(func.sum(LoanSchedule.emi_amount), 0)).where(
        LoanSchedule.loan_id == loan_id,
        func.lower(LoanSchedule.payment_status) != 'paid',
        LoanSchedule.due_date < today,
    )
    return float(db.scalar(stmt) or 0)


def count_unpaid_schedule_rows(db: Session, loan_id: int) -> int:
    n = db.scalar(
        select(func.count())
        .select_from(LoanSchedule)
        .where(
            LoanSchedule.loan_id == loan_id,
            func.lower(LoanSchedule.payment_status) != 'paid',
        )
    )
    return int(n or 0)


def profile_overdue_emi_amount(db: Session, profile_id: int, *, today: date | None = None) -> float:
    today = today or date.today()
    stmt = select(func.coalesce(func.sum(LoanSchedule.emi_amount), 0)).select_from(LoanSchedule).join(
        Loan, LoanSchedule.loan_id == Loan.id
    ).where(
        Loan.profile_id == profile_id,
        func.lower(LoanSchedule.payment_status) != 'paid',
        LoanSchedule.due_date < today,
    )
    return float(db.scalar(stmt) or 0)


def interest_paid_by_loan_ids(db: Session, profile_id: int, loan_ids: list[int]) -> dict[int, float]:
    if not loan_ids:
        return {}
    stmt = (
        select(LoanPayment.loan_id, func.coalesce(func.sum(LoanPayment.interest_paid), 0))
        .join(Loan, LoanPayment.loan_id == Loan.id)
        .where(Loan.profile_id == profile_id, LoanPayment.loan_id.in_(loan_ids))
        .group_by(LoanPayment.loan_id)
    )
    return {int(r[0]): float(r[1]) for r in db.execute(stmt).all()}


def upcoming_unpaid_emis_in_range(
    db: Session, profile_id: int, start: date, end: date
) -> list[dict]:
    stmt = (
        select(
            Loan.id,
            Loan.borrower_name,
            LoanSchedule.emi_number,
            LoanSchedule.due_date,
            LoanSchedule.emi_amount,
        )
        .join(Loan, LoanSchedule.loan_id == Loan.id)
        .where(
            Loan.profile_id == profile_id,
            func.lower(LoanSchedule.payment_status) != 'paid',
            LoanSchedule.due_date >= start,
            LoanSchedule.due_date <= end,
        )
        .order_by(LoanSchedule.due_date, Loan.id, LoanSchedule.emi_number)
    )
    return [
        {
            'loan_id': int(r[0]),
            'borrower_name': str(r[1]),
            'emi_number': int(r[2]),
            'due_date': r[3],
            'emi_amount': float(r[4]),
        }
        for r in db.execute(stmt).all()
    ]


def loan_reminder_rows(db: Session, profile_id: int, *, today: date | None = None) -> list[dict]:
    """Overdue unpaid EMIs, due today, due tomorrow (one row per installment)."""
    today = today or date.today()
    tomorrow = today + timedelta(days=1)
    items: list[dict] = []

    overdue_stmt = (
        select(
            Loan.id,
            Loan.borrower_name,
            LoanSchedule.emi_number,
            LoanSchedule.due_date,
            LoanSchedule.emi_amount,
        )
        .join(Loan, LoanSchedule.loan_id == Loan.id)
        .where(
            Loan.profile_id == profile_id,
            func.lower(LoanSchedule.payment_status) != 'paid',
            LoanSchedule.due_date < today,
        )
        .order_by(LoanSchedule.due_date, Loan.id)
    )
    for r in db.execute(overdue_stmt).all():
        items.append(
            {
                'loan_id': int(r[0]),
                'borrower_name': str(r[1]),
                'emi_number': int(r[2]),
                'due_date': r[3],
                'emi_amount': float(r[4]),
                'kind': 'OVERDUE',
            }
        )

    for target, kind in ((today, 'DUE_TODAY'), (tomorrow, 'DUE_TOMORROW')):
        due_stmt = (
            select(
                Loan.id,
                Loan.borrower_name,
                LoanSchedule.emi_number,
                LoanSchedule.due_date,
                LoanSchedule.emi_amount,
            )
            .join(Loan, LoanSchedule.loan_id == Loan.id)
            .where(
                Loan.profile_id == profile_id,
                func.lower(LoanSchedule.payment_status) != 'paid',
                LoanSchedule.due_date == target,
            )
            .order_by(Loan.id, LoanSchedule.emi_number)
        )
        for r in db.execute(due_stmt).all():
            items.append(
                {
                    'loan_id': int(r[0]),
                    'borrower_name': str(r[1]),
                    'emi_number': int(r[2]),
                    'due_date': r[3],
                    'emi_amount': float(r[4]),
                    'kind': kind,
                }
            )
    return items


def get_loan_for_profile(db: Session, loan_id: int, profile_id: int) -> Loan | None:
    ln = db.get(Loan, loan_id)
    if ln is None or ln.profile_id != profile_id:
        return None
    return ln


def _loan_has_schedule(db: Session, loan_id: int) -> bool:
    n = db.scalar(select(func.count()).select_from(LoanSchedule).where(LoanSchedule.loan_id == loan_id))
    return (n or 0) > 0


def loan_has_emi_schedule(db: Session, loan_id: int) -> bool:
    return _loan_has_schedule(db, loan_id)


def loan_ids_with_emi_schedule(db: Session, loan_ids: list[int]) -> set[int]:
    """Which loan IDs have at least one EMI schedule row."""
    if not loan_ids:
        return set()
    stmt = select(LoanSchedule.loan_id).where(LoanSchedule.loan_id.in_(loan_ids)).distinct()
    return {int(x) for x in db.scalars(stmt).all()}


def _unpaid_schedule_total(db: Session, loan_id: int) -> float:
    stmt = select(func.coalesce(func.sum(LoanSchedule.emi_amount), 0)).where(
        LoanSchedule.loan_id == loan_id,
        func.lower(LoanSchedule.payment_status) != 'paid',
    )
    return float(db.scalar(stmt) or 0)


def _insert_schedule_rows(
    db: Session,
    loan_id: int,
    principal: float,
    total_interest: float,
    term_months: int,
    start_date: date,
) -> None:
    n = term_months
    mp = principal / n
    mi = total_interest / n
    emi = mp + mi
    balance = principal
    for i in range(1, n + 1):
        balance -= mp
        due = add_months(start_date, i)
        db.add(
            LoanSchedule(
                loan_id=loan_id,
                emi_number=i,
                due_date=due,
                emi_amount=emi,
                principal_amount=mp,
                interest_amount=mi,
                remaining_balance=max(0.0, balance),
                payment_status='Pending',
            )
        )


def create_loan(db: Session, row: Loan) -> Loan:
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _simple_interest_accrued(principal: float, annual_rate_pct: float, start: date, end: date) -> float:
    """Simple interest: principal * (rate/100) * (days/365). No accrual before start or when end < start."""
    if end < start:
        return 0.0
    days = (end - start).days
    if days <= 0:
        return 0.0
    return float(principal) * (float(annual_rate_pct) / 100.0) * (days / 365.0)


def create_loan_with_schedule_options(
    db: Session,
    row: Loan,
    *,
    term_months: int | None = None,
    commission_percent: float | None = None,
    loan_kind: str = 'emi_schedule',
) -> Loan:
    if loan_kind == 'interest_free':
        row.interest_rate = 0.0
        row.interest_free_days = None
        row.term_months = None
        row.commission_percent = None
        row.commission_amount = None
        row.total_interest = 0.0
        row.total_amount = float(row.loan_amount)
        row.emi_amount = None
        row.remaining_amount = float(row.loan_amount)
        db.add(row)
        db.commit()
        db.refresh(row)
        return row

    if loan_kind == 'simple_accrual':
        principal = float(row.loan_amount)
        rate = float(row.interest_rate or 0)
        today = date.today()
        accrued = _simple_interest_accrued(principal, rate, row.start_date, today)
        accrued_r = round(accrued, 2)
        total_due = round(principal + accrued_r, 2)
        row.interest_free_days = None
        row.term_months = None
        row.commission_percent = None
        row.commission_amount = None
        row.total_interest = accrued_r
        row.total_amount = total_due
        row.emi_amount = None
        row.remaining_amount = total_due
        db.add(row)
        db.commit()
        db.refresh(row)
        return row

    if commission_percent is not None and commission_percent > 0:
        row.commission_percent = commission_percent
        row.commission_amount = float(row.loan_amount) * float(commission_percent) / 100.0
    tm = term_months
    if tm and tm > 0 and row.interest_rate is not None:
        principal = float(row.loan_amount)
        rate = float(row.interest_rate)
        ifd = int(row.interest_free_days or 0)
        # Interest accrues only for the part of the term after the grace period (~30.4375 days/month).
        grace_months = max(0.0, float(ifd) / 30.4375)
        effective_tm = max(0.0, float(tm) - grace_months)
        total_interest = principal * (rate / 100.0) * effective_tm
        total_amount = principal + total_interest
        emi_amount = total_amount / tm
        row.term_months = tm
        row.total_interest = total_interest
        row.total_amount = total_amount
        row.emi_amount = emi_amount
        row.remaining_amount = total_amount
        row.end_date = add_months(row.start_date, tm)
        db.add(row)
        db.flush()
        _insert_schedule_rows(db, row.id, principal, total_interest, tm, row.start_date)
        db.commit()
        db.refresh(row)
        return row
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def list_loan_schedule(db: Session, loan_id: int) -> list[LoanSchedule]:
    stmt = (
        select(LoanSchedule)
        .where(LoanSchedule.loan_id == loan_id)
        .order_by(LoanSchedule.emi_number)
    )
    return list(db.scalars(stmt).all())


def patch_loan_schedule_credit(
    db: Session,
    profile_id: int,
    loan_id: int,
    emi_number: int,
    *,
    credit_as_cash: bool,
    finance_account_id: int | None,
) -> LoanSchedule:
    ln = get_loan_for_profile(db, loan_id, profile_id)
    if ln is None:
        raise ValueError('Loan not found')
    row = db.scalars(
        select(LoanSchedule).where(
            LoanSchedule.loan_id == loan_id,
            LoanSchedule.emi_number == emi_number,
        )
    ).first()
    if row is None:
        raise ValueError('EMI not found')
    if str(row.payment_status).lower() == 'paid':
        raise ValueError('Cannot change payout method on a paid EMI')
    if credit_as_cash:
        row.credit_as_cash = True
        row.finance_account_id = None
    elif finance_account_id is not None:
        if get_account_for_profile(db, finance_account_id, profile_id) is None:
            raise ValueError('Account not found or not in this profile')
        row.credit_as_cash = False
        row.finance_account_id = finance_account_id
    else:
        row.credit_as_cash = False
        row.finance_account_id = None
    db.commit()
    db.refresh(row)
    return row


def delete_loan_for_profile(db: Session, profile_id: int, loan_id: int) -> None:
    ln = get_loan_for_profile(db, loan_id, profile_id)
    if ln is None:
        raise ValueError('Loan not found')
    db.execute(delete(LoanPayment).where(LoanPayment.loan_id == loan_id))
    db.execute(delete(LoanSchedule).where(LoanSchedule.loan_id == loan_id))
    db.delete(ln)
    db.commit()


def mark_emi_paid(
    db: Session,
    profile_id: int,
    loan_id: int,
    emi_number: int,
    payment_date: date | None = None,
    finance_account_id: int | None = None,
) -> LoanSchedule:
    ln = get_loan_for_profile(db, loan_id, profile_id)
    if ln is None:
        raise ValueError('Loan not found')
    row = db.scalars(
        select(LoanSchedule).where(
            LoanSchedule.loan_id == loan_id,
            LoanSchedule.emi_number == emi_number,
        )
    ).first()
    if row is None:
        raise ValueError('EMI not found')
    if str(row.payment_status).lower() == 'paid':
        raise ValueError('EMI already marked paid')
    pay_date = payment_date or date.today()
    if finance_account_id is not None:
        if get_account_for_profile(db, finance_account_id, profile_id) is None:
            raise ValueError('Account not found or not in this profile')
        row.finance_account_id = finance_account_id
        row.credit_as_cash = False
    as_cash = bool(row.credit_as_cash)
    acc_id = None if as_cash else row.finance_account_id
    if acc_id is not None:
        _bump_account_balance(db, profile_id, acc_id, float(row.emi_amount))
    row.payment_status = 'Paid'
    row.payment_date = pay_date
    row.amount_paid = float(row.emi_amount)
    db.add(
        LoanPayment(
            loan_id=loan_id,
            payment_date=pay_date,
            principal_paid=float(row.principal_amount),
            interest_paid=float(row.interest_amount),
            total_paid=float(row.emi_amount),
            balance_remaining=float(row.remaining_balance),
            finance_account_id=acc_id,
            credit_as_cash=as_cash,
        )
    )
    db.flush()
    ln.remaining_amount = _unpaid_schedule_total(db, loan_id)
    if ln.remaining_amount is not None and ln.remaining_amount <= 0.01:
        ln.status = 'CLOSED'
    db.commit()
    db.refresh(row)
    return row


def sum_loan_outstanding(db: Session, profile_id: int) -> float:
    """Receivable: unpaid EMI schedule totals, else remaining_amount / latest payment / principal."""
    loans = list_loans(db, profile_id)
    total = 0.0
    for ln in loans:
        if _loan_has_schedule(db, ln.id):
            total += _unpaid_schedule_total(db, ln.id)
            continue
        if ln.remaining_amount is not None:
            total += float(ln.remaining_amount)
            continue
        stmt = (
            select(LoanPayment.balance_remaining)
            .where(LoanPayment.loan_id == ln.id)
            .order_by(LoanPayment.payment_date.desc(), LoanPayment.id.desc())
            .limit(1)
        )
        last = db.scalar(stmt)
        total += float(last) if last is not None else float(ln.loan_amount)
    return total


def sum_loan_principal_for_profile(db: Session, profile_id: int) -> float:
    stmt = select(func.coalesce(func.sum(Loan.loan_amount), 0)).where(Loan.profile_id == profile_id)
    return float(db.scalar(stmt) or 0)


def sum_loan_total_interest_book(db: Session, profile_id: int) -> float:
    stmt = select(func.coalesce(func.sum(Loan.total_interest), 0)).where(Loan.profile_id == profile_id)
    return float(db.scalar(stmt) or 0)


def sum_loan_total_amount_book(db: Session, profile_id: int) -> float:
    stmt = select(
        func.coalesce(func.sum(func.coalesce(Loan.total_amount, Loan.loan_amount)), 0)
    ).where(Loan.profile_id == profile_id)
    return float(db.scalar(stmt) or 0)


def sum_loan_payments_for_profile(db: Session, profile_id: int) -> float:
    stmt = (
        select(func.coalesce(func.sum(LoanPayment.total_paid), 0))
        .join(Loan, LoanPayment.loan_id == Loan.id)
        .where(Loan.profile_id == profile_id)
    )
    return float(db.scalar(stmt) or 0)


def sum_loan_interest_collected_for_profile(db: Session, profile_id: int) -> float:
    stmt = (
        select(func.coalesce(func.sum(LoanPayment.interest_paid), 0))
        .join(Loan, LoanPayment.loan_id == Loan.id)
        .where(Loan.profile_id == profile_id)
    )
    return float(db.scalar(stmt) or 0)


def sum_loan_payments_this_month(db: Session, profile_id: int, today: date | None = None) -> float:
    today = today or date.today()
    start = date(today.year, today.month, 1)
    last_d = calendar.monthrange(today.year, today.month)[1]
    end = date(today.year, today.month, last_d)
    stmt = (
        select(func.coalesce(func.sum(LoanPayment.total_paid), 0))
        .join(Loan, LoanPayment.loan_id == Loan.id)
        .where(Loan.profile_id == profile_id)
        .where(LoanPayment.payment_date >= start)
        .where(LoanPayment.payment_date <= end)
    )
    return float(db.scalar(stmt) or 0)


def count_loans_status(db: Session, profile_id: int, *, closed: bool) -> int:
    n_closed = db.scalar(
        select(func.count()).select_from(Loan).where(
            Loan.profile_id == profile_id,
            func.upper(Loan.status) == 'CLOSED',
        )
    )
    n_all = db.scalar(select(func.count()).select_from(Loan).where(Loan.profile_id == profile_id))
    if closed:
        return int(n_closed or 0)
    return max(0, int((n_all or 0) - (n_closed or 0)))


def _loan_payments_metric_by_month(
    db: Session,
    profile_id: int,
    year: int,
    column,
) -> list[tuple[str, float]]:
    dialect = db.get_bind().dialect.name
    if dialect == 'postgresql':
        ym = func.to_char(LoanPayment.payment_date, 'YYYY-MM').label('ym')
        yfilt = extract('year', LoanPayment.payment_date) == year
    else:
        ym = func.strftime('%Y-%m', LoanPayment.payment_date).label('ym')
        yfilt = func.strftime('%Y', LoanPayment.payment_date) == str(year)
    stmt = (
        select(ym, func.sum(column))
        .join(Loan, LoanPayment.loan_id == Loan.id)
        .where(Loan.profile_id == profile_id)
        .where(yfilt)
        .group_by(ym)
        .order_by(ym)
    )
    return [(r[0], float(r[1])) for r in db.execute(stmt).all()]


def loan_dashboard_analytics(
    db: Session,
    profile_id: int,
    year: int | None = None,
    *,
    pending_emi_installments_total: float | None = None,
) -> dict:
    y = year or date.today().year
    principal = sum_loan_principal_for_profile(db, profile_id)
    interest_book = sum_loan_total_interest_book(db, profile_id)
    expected = sum_loan_total_amount_book(db, profile_id)
    collected = sum_loan_payments_for_profile(db, profile_id)
    remaining = sum_loan_outstanding(db, profile_id)
    active = count_loans_status(db, profile_id, closed=False)
    closed = count_loans_status(db, profile_id, closed=True)
    this_month = sum_loan_payments_this_month(db, profile_id)
    coll_monthly = _loan_payments_metric_by_month(db, profile_id, y, LoanPayment.total_paid)
    profit_monthly = _loan_payments_metric_by_month(db, profile_id, y, LoanPayment.interest_paid)
    pie = [
        {'name': 'Active', 'value': active},
        {'name': 'Closed', 'value': closed},
    ]
    bar_compare = {
        'given': principal,
        'collected': collected,
        'remaining': remaining,
    }
    today = date.today()
    week_end = today + timedelta(days=7)
    overdue_emi = profile_overdue_emi_amount(db, profile_id, today=today)
    upcoming_week = upcoming_unpaid_emis_in_range(db, profile_id, today, week_end)
    return {
        'year': y,
        'total_loan_given': principal,
        'total_interest_profit': interest_book,
        'total_amount_expected': expected,
        'total_collected': collected,
        'total_remaining_receivable': remaining,
        'pending_emi_installments_total': float(pending_emi_installments_total)
        if pending_emi_installments_total is not None
        else sum_pending_loan_schedule_emis(db, profile_id),
        'active_loans': active,
        'closed_loans': closed,
        'this_month_collection': this_month,
        'interest_collected_lifetime': sum_loan_interest_collected_for_profile(db, profile_id),
        'collections_by_month': [{'month': m, 'amount': v} for m, v in coll_monthly],
        'interest_profit_by_month': [{'month': m, 'amount': v} for m, v in profit_monthly],
        'given_vs_collected_vs_remaining': bar_compare,
        'active_vs_closed_pie': pie,
        'overdue_emi_amount': overdue_emi,
        'upcoming_emis_this_week': upcoming_week,
    }


def list_loan_payments(db: Session, loan_id: int) -> list[LoanPayment]:
    stmt = select(LoanPayment).where(LoanPayment.loan_id == loan_id).order_by(LoanPayment.payment_date.desc())
    return list(db.scalars(stmt).all())


def _current_loan_due_for_manual_payment(db: Session, ln: Loan) -> float:
    """Amount still owed when the loan has no EMI schedule (or schedule unused for this path)."""
    if ln.remaining_amount is not None:
        return max(0.0, float(ln.remaining_amount))
    last_bal = db.scalar(
        select(LoanPayment.balance_remaining)
        .where(LoanPayment.loan_id == ln.id)
        .order_by(LoanPayment.payment_date.desc(), LoanPayment.id.desc())
        .limit(1)
    )
    if last_bal is not None:
        return max(0.0, float(last_bal))
    return max(0.0, float(ln.loan_amount))


def add_loan_principal_disbursement(
    db: Session,
    profile_id: int,
    loan_id: int,
    *,
    disbursement_date: date,
    amount: float,
    finance_account_id: int,
) -> Loan:
    """
    Record an additional principal disbursement (money lent again to the same borrower).
    Debits the selected bank account. Supported only for loans **without** an EMI schedule.
    """
    _ = disbursement_date  # reserved for future audit / transaction rows
    ln = get_loan_for_profile(db, loan_id, profile_id)
    if ln is None:
        raise ValueError('Loan not found')
    if _loan_has_schedule(db, loan_id):
        raise ValueError(
            'Additional principal is not supported for EMI-schedule loans; create a new loan or contact support.'
        )
    if str(ln.status).upper() == 'CLOSED':
        raise ValueError('Loan is closed')
    amt = float(amount)
    if amt <= 0:
        raise ValueError('Amount must be positive')
    if get_account_for_profile(db, finance_account_id, profile_id) is None:
        raise ValueError('Account not found or not in this profile')
    due_before = _current_loan_due_for_manual_payment(db, ln)
    _bump_account_balance(db, profile_id, finance_account_id, -amt)
    ln.loan_amount = float(ln.loan_amount) + amt
    ln.remaining_amount = due_before + amt
    db.commit()
    db.refresh(ln)
    return ln


def close_loan_if_settled(db: Session, profile_id: int, loan_id: int) -> Loan:
    """Set loan status to CLOSED when nothing is outstanding (EMI or manual balance)."""
    ln = get_loan_for_profile(db, loan_id, profile_id)
    if ln is None:
        raise ValueError('Loan not found')
    if str(ln.status).upper() == 'CLOSED':
        raise ValueError('Loan is already closed')
    if _loan_has_schedule(db, loan_id):
        due = _unpaid_schedule_total(db, loan_id)
    else:
        due = _current_loan_due_for_manual_payment(db, ln)
    if due > 0.01:
        raise ValueError('Outstanding balance remains — collect payments before closing')
    ln.status = 'CLOSED'
    if ln.remaining_amount is not None:
        ln.remaining_amount = 0.0
    db.commit()
    db.refresh(ln)
    return ln


def record_manual_loan_payment(
    db: Session,
    profile_id: int,
    loan_id: int,
    *,
    payment_date: date,
    total_paid: float,
    principal_paid: float,
    interest_paid: float,
    credit_as_cash: bool,
    finance_account_id: int | None,
) -> LoanPayment:
    """
    Record a repayment for loans **without** an EMI schedule. Credits a bank account when applicable.
    """
    ln = get_loan_for_profile(db, loan_id, profile_id)
    if ln is None:
        raise ValueError('Loan not found')
    if _loan_has_schedule(db, loan_id):
        raise ValueError(
            'This loan has an EMI schedule — use “Mark paid” on each installment above instead of manual payment.'
        )
    if str(ln.status).upper() == 'CLOSED':
        raise ValueError('Loan is already closed')
    due = _current_loan_due_for_manual_payment(db, ln)
    if due <= 0:
        raise ValueError('Nothing due on this loan')
    total = float(total_paid)
    if total <= 0:
        raise ValueError('Payment amount must be positive')
    if total > due + 0.02:
        raise ValueError('Payment exceeds amount due')
    pp = float(principal_paid)
    ip = float(interest_paid)
    if abs((pp + ip) - total) > 0.02:
        raise ValueError('Principal and interest must add up to the total paid')
    acc_id: int | None = None
    if credit_as_cash:
        if finance_account_id is not None:
            raise ValueError('Do not set a bank account when receiving as cash')
    else:
        if finance_account_id is None:
            raise ValueError('Select a bank account, or receive as cash')
        if get_account_for_profile(db, finance_account_id, profile_id) is None:
            raise ValueError('Account not found or not in this profile')
        acc_id = finance_account_id
        _bump_account_balance(db, profile_id, acc_id, total)
    new_bal = max(0.0, due - total)
    row = LoanPayment(
        loan_id=loan_id,
        payment_date=payment_date,
        principal_paid=pp,
        interest_paid=ip,
        total_paid=total,
        balance_remaining=new_bal,
        finance_account_id=acc_id,
        credit_as_cash=bool(credit_as_cash),
    )
    db.add(row)
    ln.remaining_amount = new_bal
    if new_bal <= 0.01:
        ln.status = 'CLOSED'
    db.commit()
    db.refresh(row)
    return row


def create_loan_payment(db: Session, row: LoanPayment) -> LoanPayment:
    db.add(row)
    db.commit()
    db.refresh(row)
    return row
