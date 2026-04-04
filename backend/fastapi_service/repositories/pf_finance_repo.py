import calendar
from datetime import date, timedelta

from sqlalchemy import and_, delete, extract, func, or_, select, update
from sqlalchemy.sql.expression import false
from sqlalchemy.orm import Session, selectinload

from fastapi_service.models_extended import (
    AccountMovement,
    AccountTransaction,
    FinanceAccount,
    FinanceAsset,
    FinanceExpense,
    FinanceIncome,
    FinanceInvestment,
    FinanceInvestmentTransaction,
    FinanceLiability,
    LiabilityPayment,
    LiabilitySchedule,
    Loan,
    LoanPayment,
    LoanSchedule,
    PfExpenseCategory,
    PfIncomeCategory,
    PfPaymentInstrument,
)

MOVEMENT_INTERNAL = 'internal_transfer'
MOVEMENT_EXTERNAL_DEPOSIT = 'external_deposit'
MOVEMENT_EXTERNAL_WITHDRAWAL = 'external_withdrawal'
MOVEMENT_CREDIT_CARD_PAYMENT = 'credit_card_payment'
MOVEMENT_LOAN_DISBURSEMENT = 'loan_disbursement'
MOVEMENT_LOAN_EMI_PAYMENT = 'loan_emi_payment'


def add_months(d: date, months: int) -> date:
    m = d.month - 1 + months
    y = d.year + m // 12
    m = m % 12 + 1
    day = min(d.day, calendar.monthrange(y, m)[1])
    return date(y, m, day)


def investment_allocation_by_type(db: Session, profile_id: int) -> list[dict]:
    """By **market / book** value: COALESCE(current_value, invested_amount) per type."""
    cv = func.coalesce(FinanceInvestment.current_value, FinanceInvestment.invested_amount)
    stmt = (
        select(FinanceInvestment.investment_type, func.sum(cv))
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


def count_investment_transactions(db: Session, investment_id: int) -> int:
    stmt = select(func.count()).select_from(FinanceInvestmentTransaction).where(
        FinanceInvestmentTransaction.investment_id == investment_id
    )
    return int(db.scalar(stmt) or 0)


def list_investment_transactions_for_profile(
    db: Session, investment_id: int, profile_id: int
) -> list[FinanceInvestmentTransaction]:
    inv = get_investment_for_profile(db, investment_id, profile_id)
    if inv is None:
        return []
    stmt = (
        select(FinanceInvestmentTransaction)
        .where(FinanceInvestmentTransaction.investment_id == investment_id)
        .order_by(FinanceInvestmentTransaction.txn_date.asc(), FinanceInvestmentTransaction.id.asc())
    )
    return list(db.scalars(stmt).all())


def get_investment_transaction_for_profile(
    db: Session, transaction_id: int, investment_id: int, profile_id: int
) -> FinanceInvestmentTransaction | None:
    inv = get_investment_for_profile(db, investment_id, profile_id)
    if inv is None:
        return None
    row = db.get(FinanceInvestmentTransaction, transaction_id)
    if row is None or row.investment_id != investment_id:
        return None
    return row


def create_investment_transaction(
    db: Session, row: FinanceInvestmentTransaction
) -> FinanceInvestmentTransaction:
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def delete_investment_transaction(db: Session, row: FinanceInvestmentTransaction) -> None:
    db.delete(row)
    db.commit()


def investment_monthly_purchase_flow(
    db: Session, profile_id: int, year: int
) -> list[dict]:
    """Sum SIP + lump sum + top-up amounts per calendar month for a year."""
    purchase_types = ('sip', 'lumpsum', 'topup')
    stmt = (
        select(
            extract('month', FinanceInvestmentTransaction.txn_date).label('m'),
            func.coalesce(func.sum(FinanceInvestmentTransaction.amount), 0).label('total'),
        )
        .join(FinanceInvestment, FinanceInvestment.id == FinanceInvestmentTransaction.investment_id)
        .where(
            FinanceInvestment.profile_id == profile_id,
            extract('year', FinanceInvestmentTransaction.txn_date) == year,
            func.lower(FinanceInvestmentTransaction.txn_type).in_(purchase_types),
            FinanceInvestmentTransaction.amount > 0,
        )
        .group_by(extract('month', FinanceInvestmentTransaction.txn_date))
        .order_by(extract('month', FinanceInvestmentTransaction.txn_date))
    )
    rows = db.execute(stmt).all()
    return [{'month': int(r.m), 'invested': float(r.total)} for r in rows]


def seed_investment_opening_transaction_if_missing(db: Session, inv: FinanceInvestment) -> None:
    """Create a single lumpsum row from the holding when the ledger is empty (new API creates)."""
    if count_investment_transactions(db, inv.id) > 0:
        return
    tv = inv.current_value if inv.current_value is not None else inv.invested_amount
    row = FinanceInvestmentTransaction(
        investment_id=inv.id,
        txn_date=inv.investment_date,
        txn_type='lumpsum',
        amount=float(inv.invested_amount),
        units=None,
        nav=None,
        total_value=float(tv) if tv is not None else None,
        notes='Opening balance',
        attachment_url=None,
    )
    db.add(row)
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


def _insert_liability_flat_schedule_rows(
    db: Session,
    liability_id: int,
    principal: float,
    total_interest: float,
    term_months: int,
    start_date: date,
) -> None:
    n = int(term_months)
    if n <= 0:
        return
    mp = principal / n
    mi = total_interest / n
    emi = round(mp + mi, 2)
    mp_r, mi_r = round(mp, 2), round(mi, 2)
    balance = principal
    for i in range(1, n + 1):
        balance -= mp
        due = add_months(start_date, i)
        db.add(
            LiabilitySchedule(
                liability_id=liability_id,
                emi_number=i,
                due_date=due,
                emi_amount=emi,
                principal_amount=mp_r,
                interest_amount=mi_r,
                remaining_balance=max(0.0, round(balance, 2)),
                payment_status='Pending',
            )
        )


def _insert_liability_reducing_schedule_rows(
    db: Session,
    liability_id: int,
    principal: float,
    annual_rate_pct: float,
    term_months: int,
    start_date: date,
) -> tuple[float, float, float]:
    n = int(term_months)
    p = round(float(principal), 2)
    if n <= 0:
        return 0.0, p, 0.0
    r = (float(annual_rate_pct) / 100.0) / 12.0
    total_interest_acc = 0.0
    if r <= 0:
        emi = round(p / n, 2)
        balance = p
        for i in range(1, n + 1):
            princ = emi if i < n else round(balance, 2)
            intr = 0.0
            emi_i = round(princ + intr, 2)
            balance = round(balance - princ, 2)
            due = add_months(start_date, i)
            db.add(
                LiabilitySchedule(
                    liability_id=liability_id,
                    emi_number=i,
                    due_date=due,
                    emi_amount=emi_i,
                    principal_amount=princ,
                    interest_amount=intr,
                    remaining_balance=max(0.0, balance),
                    payment_status='Pending',
                )
            )
        return 0.0, p, emi

    pow_term = (1 + r) ** n
    emi = round(p * r * pow_term / (pow_term - 1), 2)
    balance = p
    for i in range(1, n):
        interest = round(balance * r, 2)
        princ = round(emi - interest, 2)
        if princ > balance:
            princ = round(balance, 2)
        emi_i = round(princ + interest, 2)
        balance = round(balance - princ, 2)
        total_interest_acc += interest
        due = add_months(start_date, i)
        db.add(
            LiabilitySchedule(
                liability_id=liability_id,
                emi_number=i,
                due_date=due,
                emi_amount=emi_i,
                principal_amount=princ,
                interest_amount=interest,
                remaining_balance=balance,
                payment_status='Pending',
            )
        )
    interest = round(balance * r, 2)
    princ = round(balance, 2)
    emi_last = round(princ + interest, 2)
    total_interest_acc += interest
    due = add_months(start_date, n)
    db.add(
        LiabilitySchedule(
            liability_id=liability_id,
            emi_number=n,
            due_date=due,
            emi_amount=emi_last,
            principal_amount=princ,
            interest_amount=interest,
            remaining_balance=0.0,
            payment_status='Pending',
        )
    )
    total_repay = round(p + total_interest_acc, 2)
    return round(total_interest_acc, 2), total_repay, emi


def create_liability_with_emi_schedule(
    db: Session,
    row: FinanceLiability,
    *,
    term_months: int,
    emi_start_date: date,
    emi_interest_method: str = 'FLAT',
    interest_free_days: int | None = None,
) -> FinanceLiability:
    """Persist liability and build flat, simple-interest, or reducing EMI rows. Principal = opening outstanding."""
    principal = float(row.outstanding_amount)
    tm = int(term_months)
    rate = float(row.interest_rate or 0)
    if tm < 1 or rate <= 0:
        raise ValueError('EMI schedule requires term_months and interest_rate')
    method = str(emi_interest_method or 'FLAT').strip().upper()
    if method not in ('FLAT', 'REDUCING_BALANCE', 'SIMPLE_INTEREST'):
        method = 'FLAT'
    row.emi_interest_method = method
    row.term_months = tm
    row.emi_schedule_start_date = emi_start_date
    row.total_amount = max(float(row.total_amount), principal)

    if method == 'REDUCING_BALANCE':
        db.add(row)
        db.flush()
        _total_i, total_repay, emi_rep = _insert_liability_reducing_schedule_rows(
            db, row.id, principal, rate, tm, emi_start_date
        )
        row.installment_amount = emi_rep
        row.outstanding_amount = total_repay
    else:
        # FLAT: optional interest-free days reduce the interest-bearing fraction of the term.
        # SIMPLE_INTEREST: interest on full principal for the full term (no grace); matches P×r×(term/12).
        if method == 'SIMPLE_INTEREST':
            row.interest_free_days = None
            ifd = 0
        else:
            ifd = int(interest_free_days or 0)
            row.interest_free_days = int(interest_free_days) if interest_free_days else None
        grace_months = max(0.0, float(ifd) / 30.4375)
        effective_months = max(0.0, float(tm) - grace_months)
        years = effective_months / 12.0
        total_interest = principal * (rate / 100.0) * years
        total_amount = principal + total_interest
        emi_amount = total_amount / tm
        row.installment_amount = round(emi_amount, 2)
        row.outstanding_amount = round(total_amount, 2)
        db.add(row)
        db.flush()
        _insert_liability_flat_schedule_rows(db, row.id, principal, total_interest, tm, emi_start_date)

    d = db.scalar(
        select(func.min(LiabilitySchedule.due_date)).where(LiabilitySchedule.liability_id == row.id)
    )
    row.due_date = d
    db.commit()
    db.refresh(row)
    return row


def liability_has_emi_schedule(db: Session, liability_id: int) -> bool:
    stmt = select(LiabilitySchedule.id).where(LiabilitySchedule.liability_id == liability_id).limit(1)
    return db.scalar(stmt) is not None


def _unpaid_liability_schedule_total(db: Session, liability_id: int) -> float:
    stmt = select(func.coalesce(func.sum(LiabilitySchedule.emi_amount), 0)).where(
        LiabilitySchedule.liability_id == liability_id,
        func.lower(LiabilitySchedule.payment_status) != 'paid',
    )
    return float(db.scalar(stmt) or 0)


def next_pending_liability_emi(db: Session, liability_id: int) -> tuple[date, float] | None:
    stmt = (
        select(LiabilitySchedule.due_date, LiabilitySchedule.emi_amount)
        .where(
            LiabilitySchedule.liability_id == liability_id,
            func.lower(LiabilitySchedule.payment_status) != 'paid',
        )
        .order_by(LiabilitySchedule.due_date, LiabilitySchedule.emi_number)
        .limit(1)
    )
    r = db.execute(stmt).first()
    if not r:
        return None
    return (r[0], float(r[1]))


def list_liability_schedule(db: Session, liability_id: int) -> list[LiabilitySchedule]:
    stmt = (
        select(LiabilitySchedule)
        .where(LiabilitySchedule.liability_id == liability_id)
        .order_by(LiabilitySchedule.emi_number)
    )
    return list(db.scalars(stmt).all())


def list_pending_liability_emis(db: Session, profile_id: int) -> list[dict]:
    stmt = (
        select(LiabilitySchedule, FinanceLiability)
        .join(FinanceLiability, FinanceLiability.id == LiabilitySchedule.liability_id)
        .where(FinanceLiability.profile_id == profile_id)
        .where(func.lower(LiabilitySchedule.payment_status) != 'paid')
        .order_by(LiabilitySchedule.due_date, FinanceLiability.id, LiabilitySchedule.emi_number)
    )
    out: list[dict] = []
    for sch, ln in db.execute(stmt).all():
        out.append(
            {
                'schedule_id': int(sch.id),
                'liability_id': int(ln.id),
                'liability_name': str(ln.liability_name),
                'emi_number': int(sch.emi_number),
                'due_date': sch.due_date,
                'emi_amount': float(sch.emi_amount),
            }
        )
    return out


def patch_liability_schedule_credit(
    db: Session,
    profile_id: int,
    liability_id: int,
    emi_number: int,
    *,
    credit_as_cash: bool,
    finance_account_id: int | None,
) -> LiabilitySchedule:
    ln = get_liability_for_profile(db, liability_id, profile_id)
    if ln is None:
        raise ValueError('Liability not found')
    row = db.scalars(
        select(LiabilitySchedule).where(
            LiabilitySchedule.liability_id == liability_id,
            LiabilitySchedule.emi_number == emi_number,
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


def mark_liability_emi_paid(
    db: Session,
    profile_id: int,
    liability_id: int,
    emi_number: int,
    payment_date: date | None = None,
    finance_account_id: int | None = None,
    movement_id: int | None = None,
) -> LiabilitySchedule:
    """Pay an EMI: expense + bank debit (or cash expense only), update outstanding and schedule."""
    ln = get_liability_for_profile(db, liability_id, profile_id)
    if ln is None:
        raise ValueError('Liability not found')
    if str(ln.status).upper() == 'CLOSED':
        raise ValueError('Liability is closed')
    row = db.scalars(
        select(LiabilitySchedule).where(
            LiabilitySchedule.liability_id == liability_id,
            LiabilitySchedule.emi_number == emi_number,
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
    db.add(
        FinanceExpense(
            profile_id=profile_id,
            account_id=acc_id,
            amount=float(row.emi_amount),
            category='EMI – Loans',
            entry_date=pay_date,
            description=f'Liability EMI #{emi_number} — {ln.liability_name}',
            payment_method='CASH' if as_cash else 'BANK',
        )
    )
    if not as_cash:
        if acc_id is None:
            raise ValueError('Select a bank account for this EMI (or mark installment as cash)')
        _bump_account_balance(db, profile_id, acc_id, -float(row.emi_amount))
        db.add(
            AccountTransaction(
                profile_id=profile_id,
                account_id=acc_id,
                transaction_type='LOAN_EMI_PAYMENT',
                amount=float(row.emi_amount),
                movement_id=movement_id,
                entry_date=pay_date,
                reference_number=None,
                notes=f'Liability EMI #{emi_number} — {ln.liability_name}',
                created_by=None,
            )
        )
    mode = 'CASH' if as_cash else 'BANK'
    row.payment_status = 'Paid'
    row.payment_date = pay_date
    row.amount_paid = float(row.emi_amount)
    db.add(
        LiabilityPayment(
            liability_id=liability_id,
            payment_date=pay_date,
            amount_paid=float(row.emi_amount),
            interest_paid=float(row.interest_amount),
            payment_mode=mode,
            finance_account_id=acc_id,
            notes=None,
        )
    )
    db.flush()
    ln.outstanding_amount = _unpaid_liability_schedule_total(db, liability_id)
    nxt = next_pending_liability_emi(db, liability_id)
    ln.due_date = nxt[0] if nxt else None
    if ln.outstanding_amount <= 0.01:
        ln.outstanding_amount = 0.0
        ln.status = 'CLOSED'
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
    db.execute(delete(LiabilityPayment).where(LiabilityPayment.liability_id == liability_id))
    db.execute(delete(LiabilitySchedule).where(LiabilitySchedule.liability_id == liability_id))
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
    movement_id: int | None = None,
) -> LiabilityPayment:
    ln = get_liability_for_profile(db, liability_id, profile_id)
    if ln is None:
        raise ValueError('Liability not found')
    if str(ln.status).upper() == 'CLOSED':
        raise ValueError('Liability is closed')
    if liability_has_emi_schedule(db, liability_id):
        raise ValueError(
            'This liability has an EMI schedule — mark each installment paid from the schedule instead.'
        )
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
        db.add(
            AccountTransaction(
                profile_id=profile_id,
                account_id=acc_id,
                transaction_type='LOAN_LIABILITY_PAYMENT',
                amount=ap,
                movement_id=movement_id,
                entry_date=payment_date,
                reference_number=None,
                notes=(notes.strip() or None) if notes else None,
                created_by=None,
            )
        )
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


def add_liability_principal_draw(
    db: Session,
    profile_id: int,
    liability_id: int,
    *,
    disbursement_date: date,
    amount: float,
    finance_account_id: int,
) -> FinanceLiability:
    """
    Record additional borrowing on the same liability (proceeds credited to bank).
    Only for liabilities **without** an EMI schedule. Mirrors lent-loan add-amount, inverted.
    """
    _ = disbursement_date
    ln = get_liability_for_profile(db, liability_id, profile_id)
    if ln is None:
        raise ValueError('Liability not found')
    if liability_has_emi_schedule(db, liability_id):
        raise ValueError(
            'Additional principal is not supported for EMI-schedule liabilities; create a new liability or contact support.'
        )
    if str(ln.status or '').upper() != 'ACTIVE':
        raise ValueError('Liability is not active')
    lt = (ln.liability_type or '').upper()
    if lt == 'CREDIT_CARD_STATEMENT':
        raise ValueError('Use credit card bill flows for card statement balances')
    if lt == 'CREDIT_CARD':
        raise ValueError('Use expenses or card billing to change credit card balances')
    amt = float(amount)
    if amt <= 0:
        raise ValueError('Amount must be positive')
    if get_account_for_profile(db, finance_account_id, profile_id) is None:
        raise ValueError('Account not found or not in this profile')
    _bump_account_balance(db, profile_id, finance_account_id, amt)
    ln.total_amount = float(ln.total_amount or 0) + amt
    ln.outstanding_amount = float(ln.outstanding_amount or 0) + amt
    db.commit()
    db.refresh(ln)
    return ln


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
    inc = list_income(db, profile_id, 0, fetch_n, start, end, account_id, None)
    exp = list_expenses(db, profile_id, 0, fetch_n, start, end, account_id, None)
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
    from fastapi_service.constants.finance_account_types import normalize_finance_account_type

    row.account_type = normalize_finance_account_type(row.account_type)
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


def patch_finance_account(
    db: Session,
    row: FinanceAccount,
    *,
    balance: float | None = None,
    account_type: str | None = None,
    account_name: str | None = None,
    include_in_networth: bool | None = None,
    include_in_liquid: bool | None = None,
) -> FinanceAccount:
    from fastapi_service.constants.finance_account_types import normalize_finance_account_type

    if balance is not None:
        row.balance = balance
    if account_type is not None:
        row.account_type = normalize_finance_account_type(account_type)
    if account_name is not None:
        row.account_name = account_name.strip()[:200]
    if include_in_networth is not None:
        row.include_in_networth = include_in_networth
    if include_in_liquid is not None:
        row.include_in_liquid = include_in_liquid
    db.commit()
    db.refresh(row)
    return row


def delete_account(db: Session, profile_id: int, account_id: int) -> None:
    row = get_account_for_profile(db, account_id, profile_id)
    if row is None:
        raise ValueError('Account not found')
    xfer_cnt = db.scalar(
        select(func.count())
        .select_from(AccountMovement)
        .where(AccountMovement.profile_id == profile_id)
        .where(
            or_(
                AccountMovement.from_account_id == account_id,
                AccountMovement.to_account_id == account_id,
            )
        )
    )
    if xfer_cnt and int(xfer_cnt) > 0:
        raise ValueError('Cannot delete an account that has transfer history')
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


def _expense_adjusts_account_balance(row: FinanceExpense) -> bool:
    """PAID card/UPI/bank expenses debit an account; credit_card (statement) does not."""
    if not _expense_balance_applies(row):
        return False
    m = (row.payment_method or '').strip().lower()
    if m == 'credit_card':
        return False
    return True


def delete_expense(db: Session, profile_id: int, row: FinanceExpense) -> None:
    from fastapi_service.repositories import pf_credit_card_repo

    pf_credit_card_repo.delete_transactions_for_expense(db, row.id)
    if _expense_adjusts_account_balance(row) and row.account_id is not None:
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
    old_applies = _expense_adjusts_account_balance(row)
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
    if 'credit_card_id' in patch:
        cid = patch['credit_card_id']
        row.credit_card_id = int(cid) if cid is not None else None
    if 'is_recurring' in patch:
        row.is_recurring = bool(patch['is_recurring'])
    if 'recurring_type' in patch:
        row.recurring_type = patch['recurring_type']
    if 'payment_status' in patch:
        ps = patch['payment_status']
        row.payment_status = str(ps or 'PAID').strip().upper() or 'PAID'

    new_applies = _expense_adjusts_account_balance(row)
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
    category: str | None = None,
) -> list[FinanceIncome]:
    stmt = (
        select(FinanceIncome)
        .where(FinanceIncome.profile_id == profile_id)
        .options(selectinload(FinanceIncome.income_category_rel))
    )
    if account_id is not None:
        stmt = stmt.where(FinanceIncome.account_id == account_id)
    if category is not None and str(category).strip():
        stmt = stmt.where(FinanceIncome.category == str(category).strip())
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
    category: str | None = None,
) -> list[FinanceExpense]:
    stmt = (
        select(FinanceExpense)
        .where(FinanceExpense.profile_id == profile_id)
        .options(
            selectinload(FinanceExpense.expense_category_rel),
            selectinload(FinanceExpense.payment_instrument_rel),
            selectinload(FinanceExpense.credit_card_rel),
        )
    )
    if account_id is not None:
        stmt = stmt.where(FinanceExpense.account_id == account_id)
    if category is not None and str(category).strip():
        stmt = stmt.where(FinanceExpense.category == str(category).strip())
    if start:
        stmt = stmt.where(FinanceExpense.entry_date >= start)
    if end:
        stmt = stmt.where(FinanceExpense.entry_date <= end)
    stmt = stmt.order_by(FinanceExpense.entry_date.desc()).offset(skip).limit(limit)
    return list(db.scalars(stmt).all())


def create_expense(db: Session, row: FinanceExpense, *, adjust_account_balance: bool = True) -> FinanceExpense:
    if adjust_account_balance and _expense_adjusts_account_balance(row):
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


def sum_expense_credit_card_statement(
    db: Session, profile_id: int, start: date | None, end: date | None
) -> float:
    """Expenses with ``payment_method = credit_card`` (recognized on swipe / entry date for P&L)."""
    stmt = select(func.coalesce(func.sum(FinanceExpense.amount), 0)).where(
        FinanceExpense.profile_id == profile_id,
        FinanceExpense.payment_method.is_not(None),
        func.lower(FinanceExpense.payment_method) == 'credit_card',
    )
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


def sum_liabilities_cc_statement_outstanding(db: Session, profile_id: int) -> float:
    stmt = select(func.coalesce(func.sum(FinanceLiability.outstanding_amount), 0)).where(
        FinanceLiability.profile_id == profile_id,
        func.upper(FinanceLiability.status) == 'ACTIVE',
        FinanceLiability.liability_type == 'CREDIT_CARD_STATEMENT',
    )
    return float(db.scalar(stmt) or 0)


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


def income_by_category(
    db: Session,
    profile_id: int,
    start: date | None,
    end: date | None,
    account_id: int | None = None,
) -> list[tuple[str, float]]:
    stmt = select(FinanceIncome.category, func.sum(FinanceIncome.amount)).where(
        FinanceIncome.profile_id == profile_id
    )
    if account_id is not None:
        stmt = stmt.where(FinanceIncome.account_id == account_id)
    if start:
        stmt = stmt.where(FinanceIncome.entry_date >= start)
    if end:
        stmt = stmt.where(FinanceIncome.entry_date <= end)
    stmt = stmt.group_by(FinanceIncome.category)
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
    """Return instrument id for card/upi; clear for cash/bank_transfer / credit_card."""
    m = (payment_method or '').strip().lower()
    if m == 'credit_card':
        return None
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
    if m == 'credit_card':
        return None, None
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
    """Backward-compatible buckets: bank = BANK; cash bucket = CASH + WALLET (historical UX)."""
    liq = sum_liquid_balances_detailed(db, profile_id)
    bank = liq['BANK']
    cash_bucket = liq['CASH'] + liq['WALLET']
    return {'cash': cash_bucket, 'bank': bank, 'total': cash_bucket + bank}


def canonical_account_type(a: FinanceAccount) -> str:
    from fastapi_service.constants.finance_account_types import normalize_finance_account_type

    return normalize_finance_account_type(a.account_type)


def _canon_type_row(a: FinanceAccount) -> str:
    return canonical_account_type(a)


def sum_liquid_balances_detailed(db: Session, profile_id: int) -> dict[str, float]:
    """BANK / CASH / WALLET sums (only rows with include_in_liquid=True when column exists)."""
    rows = list_accounts(db, profile_id, 0, 500)
    out = {'BANK': 0.0, 'CASH': 0.0, 'WALLET': 0.0}
    for a in rows:
        liq = getattr(a, 'include_in_liquid', True)
        if liq is False:
            continue
        ct = _canon_type_row(a)
        if ct == 'BANK':
            out['BANK'] += float(a.balance)
        elif ct == 'CASH':
            out['CASH'] += float(a.balance)
        elif ct == 'WALLET':
            out['WALLET'] += float(a.balance)
    return out


def sum_balances_by_account_type(db: Session, profile_id: int) -> dict[str, float]:
    """Totals per canonical account_type (include_in_networth only for asset-side display; include all for completeness)."""
    rows = list_accounts(db, profile_id, 0, 500)
    buckets: dict[str, float] = {}
    for a in rows:
        ct = _canon_type_row(a)
        buckets[ct] = buckets.get(ct, 0.0) + float(a.balance)
    return buckets


def net_worth_from_finance_accounts_only(db: Session, profile_id: int) -> float | None:
    """
    NW = asset-type account balances − liability-type account balances (include_in_networth only).
    Excludes investments/assets/loans outside finance_accounts; use dashboard net_worth for full picture.
    """
    rows = list_accounts(db, profile_id, 0, 500)
    asset_types = frozenset({'BANK', 'CASH', 'WALLET', 'INVESTMENT', 'LOAN_GIVEN', 'ASSET'})
    liab_types = frozenset({'CREDIT_CARD', 'LOAN_TAKEN'})
    assets = 0.0
    liabs = 0.0
    for a in rows:
        if getattr(a, 'include_in_networth', True) is False:
            continue
        ct = _canon_type_row(a)
        b = float(a.balance)
        if ct in asset_types:
            assets += b
        elif ct in liab_types:
            liabs += b
    return assets - liabs


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
    db: Session,
    profile_id: int,
    start: date | None,
    end: date | None,
    account_id: int | None = None,
) -> float:
    emi_exact = ('EMI – Loans', 'EMI – Credit Card')
    stmt = select(func.coalesce(func.sum(FinanceExpense.amount), 0)).where(
        FinanceExpense.profile_id == profile_id,
        or_(
            FinanceExpense.category.in_(emi_exact),
            FinanceExpense.category.ilike('%EMI%'),
        ),
    )
    if account_id is not None:
        stmt = stmt.where(FinanceExpense.account_id == account_id)
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


def resolve_expense_account_type_sql_filter(
    db: Session, profile_id: int, raw: str | None
) -> dict | None:
    """Narrow expenses by linked account's canonical type, or UNLINKED (no account). None = no filter."""
    if raw is None or not str(raw).strip():
        return None
    s = str(raw).strip()
    if s.upper() == 'UNLINKED':
        return {'unlinked': True}
    from fastapi_service.constants.finance_account_types import normalize_finance_account_type

    t = normalize_finance_account_type(s)
    ids = [
        a.id for a in list_accounts(db, profile_id, 0, 500) if canonical_account_type(a) == t
    ]
    return {'ids': ids}


def _expense_scope(
    profile_id: int,
    start: date | None,
    end: date | None,
    account_id: int | None = None,
    expense_category_id: int | None = None,
    paid_by_contains: str | None = None,
    *,
    expense_type_filter: dict | None = None,
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
    if expense_type_filter:
        if expense_type_filter.get('unlinked'):
            conds.append(FinanceExpense.account_id.is_(None))
        elif 'ids' in expense_type_filter:
            ids = expense_type_filter['ids']
            if not ids:
                conds.append(false())
            else:
                conds.append(FinanceExpense.account_id.in_(ids))
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
    expense_type_filter: dict | None = None,
) -> float:
    stmt = select(func.coalesce(func.sum(FinanceExpense.amount), 0)).where(
        _expense_scope(
            profile_id,
            start,
            end,
            account_id,
            expense_category_id,
            paid_by_contains,
            expense_type_filter=expense_type_filter,
        )
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
    expense_type_filter: dict | None = None,
) -> list[tuple[str, float]]:
    stmt = (
        select(FinanceExpense.category, func.sum(FinanceExpense.amount))
        .where(
            _expense_scope(
                profile_id,
                start,
                end,
                account_id,
                expense_category_id,
                paid_by_contains,
                expense_type_filter=expense_type_filter,
            )
        )
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
    expense_type_filter: dict | None = None,
) -> list[tuple[str, float]]:
    stmt = select(FinanceExpense.paid_by, func.sum(FinanceExpense.amount)).where(
        _expense_scope(
            profile_id,
            start,
            end,
            account_id,
            expense_category_id,
            paid_by_contains,
            expense_type_filter=expense_type_filter,
        )
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
    expense_type_filter: dict | None = None,
) -> list[tuple[int | None, str, float]]:
    an = func.coalesce(FinanceAccount.account_name, '(No account)')
    stmt = (
        select(FinanceExpense.account_id, an, func.sum(FinanceExpense.amount))
        .outerjoin(FinanceAccount, FinanceExpense.account_id == FinanceAccount.id)
        .where(
            _expense_scope(
                profile_id,
                start,
                end,
                account_id,
                expense_category_id,
                paid_by_contains,
                expense_type_filter=expense_type_filter,
            )
        )
        .group_by(FinanceExpense.account_id, an)
        .order_by(func.sum(FinanceExpense.amount).desc())
    )
    return [(r[0], str(r[1]), float(r[2])) for r in db.execute(stmt).all()]


def expense_totals_by_account_type_scoped(
    db: Session,
    profile_id: int,
    start: date | None,
    end: date | None,
    *,
    account_id: int | None = None,
    expense_category_id: int | None = None,
    paid_by_contains: str | None = None,
    expense_type_filter: dict | None = None,
) -> list[dict]:
    """Expense sums grouped by canonical finance account type (UNLINKED when no account)."""
    from fastapi_service.constants.finance_account_types import normalize_finance_account_type

    stmt = (
        select(FinanceAccount.account_type, func.sum(FinanceExpense.amount))
        .select_from(FinanceExpense)
        .outerjoin(FinanceAccount, FinanceExpense.account_id == FinanceAccount.id)
        .where(
            _expense_scope(
                profile_id,
                start,
                end,
                account_id,
                expense_category_id,
                paid_by_contains,
                expense_type_filter=expense_type_filter,
            )
        )
        .group_by(FinanceAccount.account_type)
    )
    merged: dict[str, float] = {}
    for raw_type, total in db.execute(stmt).all():
        key = 'UNLINKED' if raw_type is None else normalize_finance_account_type(str(raw_type))
        merged[key] = merged.get(key, 0.0) + float(total)
    return [
        {'account_type': k, 'amount': round(v, 2)}
        for k, v in sorted(merged.items(), key=lambda x: -x[1])
    ]


def income_by_day_scoped(
    db: Session,
    profile_id: int,
    start: date,
    end: date,
    *,
    account_id: int | None = None,
    income_category_id: int | None = None,
    person_contains: str | None = None,
) -> list[tuple[date, float]]:
    stmt = (
        select(FinanceIncome.entry_date, func.sum(FinanceIncome.amount))
        .where(_income_scope(profile_id, start, end, account_id, income_category_id, person_contains))
        .group_by(FinanceIncome.entry_date)
        .order_by(FinanceIncome.entry_date)
    )
    return [(r[0], float(r[1])) for r in db.execute(stmt).all()]


def expense_by_day_scoped(
    db: Session,
    profile_id: int,
    start: date,
    end: date,
    *,
    account_id: int | None = None,
    expense_category_id: int | None = None,
    paid_by_contains: str | None = None,
    expense_type_filter: dict | None = None,
) -> list[tuple[date, float]]:
    stmt = (
        select(FinanceExpense.entry_date, func.sum(FinanceExpense.amount))
        .where(
            _expense_scope(
                profile_id,
                start,
                end,
                account_id,
                expense_category_id,
                paid_by_contains,
                expense_type_filter=expense_type_filter,
            )
        )
        .group_by(FinanceExpense.entry_date)
        .order_by(FinanceExpense.entry_date)
    )
    return [(r[0], float(r[1])) for r in db.execute(stmt).all()]


def sum_expense_emi_scoped(
    db: Session,
    profile_id: int,
    start: date | None,
    end: date | None,
    *,
    account_id: int | None = None,
    expense_category_id: int | None = None,
    paid_by_contains: str | None = None,
    expense_type_filter: dict | None = None,
) -> float:
    emi_exact = ('EMI – Loans', 'EMI – Credit Card')
    stmt = select(func.coalesce(func.sum(FinanceExpense.amount), 0)).where(
        _expense_scope(
            profile_id,
            start,
            end,
            account_id,
            expense_category_id,
            paid_by_contains,
            expense_type_filter=expense_type_filter,
        ),
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


def _insert_flat_schedule_rows(
    db: Session,
    loan_id: int,
    principal: float,
    total_interest: float,
    term_months: int,
    start_date: date,
) -> None:
    """
    Flat interest (full principal × annual rate × years), then EMI = (P + interest) / n.

    Matches: total_interest = P * (r/100) * t with t = tenure in years (here from effective months / 12);
    each month: constant principal slice and constant interest slice; rows store principal_component,
    interest_component, balance_principal (as principal_amount, interest_amount, remaining_balance).
    """
    n = int(term_months)
    if n <= 0:
        return
    mp = principal / n
    mi = total_interest / n
    emi = round(mp + mi, 2)
    mp_r, mi_r = round(mp, 2), round(mi, 2)
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
                principal_amount=mp_r,
                interest_amount=mi_r,
                remaining_balance=max(0.0, round(balance, 2)),
                payment_status='Pending',
            )
        )


def _insert_reducing_schedule_rows(
    db: Session,
    loan_id: int,
    principal: float,
    annual_rate_pct: float,
    term_months: int,
    start_date: date,
) -> tuple[float, float, float]:
    """
    Reducing balance: monthly r = (annual % / 100) / 12, EMI = P*r*(1+r)^n / ((1+r)^n - 1).

    Schedule rows carry principal_component, interest_component, balance_principal per period.
    Returns (total_interest, total_repayable, representative_emi — first installments' EMI).
    """
    n = int(term_months)
    p = round(float(principal), 2)
    if n <= 0:
        return 0.0, p, 0.0
    r = (float(annual_rate_pct) / 100.0) / 12.0
    total_interest_acc = 0.0
    if r <= 0:
        emi = round(p / n, 2)
        balance = p
        for i in range(1, n + 1):
            princ = emi if i < n else round(balance, 2)
            intr = 0.0
            emi_i = round(princ + intr, 2)
            balance = round(balance - princ, 2)
            due = add_months(start_date, i)
            db.add(
                LoanSchedule(
                    loan_id=loan_id,
                    emi_number=i,
                    due_date=due,
                    emi_amount=emi_i,
                    principal_amount=princ,
                    interest_amount=intr,
                    remaining_balance=max(0.0, balance),
                    payment_status='Pending',
                )
            )
        return 0.0, p, emi

    pow_term = (1 + r) ** n
    emi = round(p * r * pow_term / (pow_term - 1), 2)
    balance = p
    for i in range(1, n):
        interest = round(balance * r, 2)
        princ = round(emi - interest, 2)
        if princ > balance:
            princ = round(balance, 2)
        emi_i = round(princ + interest, 2)
        balance = round(balance - princ, 2)
        total_interest_acc += interest
        due = add_months(start_date, i)
        db.add(
            LoanSchedule(
                loan_id=loan_id,
                emi_number=i,
                due_date=due,
                emi_amount=emi_i,
                principal_amount=princ,
                interest_amount=interest,
                remaining_balance=balance,
                payment_status='Pending',
            )
        )
    interest = round(balance * r, 2)
    princ = round(balance, 2)
    emi_last = round(princ + interest, 2)
    total_interest_acc += interest
    due = add_months(start_date, n)
    db.add(
        LoanSchedule(
            loan_id=loan_id,
            emi_number=n,
            due_date=due,
            emi_amount=emi_last,
            principal_amount=princ,
            interest_amount=interest,
            remaining_balance=0.0,
            payment_status='Pending',
        )
    )
    total_repay = round(p + total_interest_acc, 2)
    return round(total_interest_acc, 2), total_repay, emi


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
    emi_interest_method: str = 'FLAT',
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
    method = str(emi_interest_method or getattr(row, 'emi_interest_method', None) or 'FLAT').strip().upper()
    if method not in ('FLAT', 'REDUCING_BALANCE', 'SIMPLE_INTEREST'):
        method = 'FLAT'
    row.emi_interest_method = method
    if tm and tm > 0 and row.interest_rate is not None:
        principal = float(row.loan_amount)
        rate = float(row.interest_rate)
        ifd = int(row.interest_free_days or 0)
        grace_months = max(0.0, float(ifd) / 30.4375)
        effective_months = max(0.0, float(tm) - grace_months)
        if method == 'REDUCING_BALANCE':
            row.term_months = tm
            row.end_date = add_months(row.start_date, tm)
            db.add(row)
            db.flush()
            total_interest, total_amount, emi_amount = _insert_reducing_schedule_rows(
                db, row.id, principal, rate, tm, row.start_date
            )
            row.total_interest = total_interest
            row.total_amount = total_amount
            row.emi_amount = emi_amount
            row.remaining_amount = total_amount
            db.commit()
            db.refresh(row)
            return row
        if method == 'SIMPLE_INTEREST':
            row.interest_free_days = None
            effective_months = float(tm)
        years = effective_months / 12.0
        total_interest = principal * (rate / 100.0) * years
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
        _insert_flat_schedule_rows(db, row.id, principal, total_interest, tm, row.start_date)
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


def list_pending_loan_emis(db: Session, profile_id: int) -> list[dict]:
    """All unpaid EMI schedule installments for the profile (due date order)."""
    stmt = (
        select(LoanSchedule, Loan)
        .join(Loan, Loan.id == LoanSchedule.loan_id)
        .where(Loan.profile_id == profile_id)
        .where(func.lower(LoanSchedule.payment_status) != 'paid')
        .order_by(LoanSchedule.due_date, Loan.id, LoanSchedule.emi_number)
    )
    out: list[dict] = []
    for sch, ln in db.execute(stmt).all():
        out.append(
            {
                'schedule_id': int(sch.id),
                'loan_id': int(ln.id),
                'borrower_name': str(ln.borrower_name),
                'emi_settlement': str(getattr(ln, 'emi_settlement', None) or 'RECEIPT'),
                'emi_number': int(sch.emi_number),
                'due_date': sch.due_date,
                'emi_amount': float(sch.emi_amount),
            }
        )
    return out


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
    settlement = str(getattr(ln, 'emi_settlement', None) or 'RECEIPT').strip().upper()
    if settlement == 'PAYMENT':
        db.add(
            FinanceExpense(
                profile_id=profile_id,
                account_id=acc_id,
                amount=float(row.emi_amount),
                category='EMI – Loans',
                entry_date=pay_date,
                description=f'EMI #{emi_number} — {ln.borrower_name}',
                payment_method='CASH' if as_cash else 'BANK',
            )
        )
        if not as_cash:
            if acc_id is None:
                raise ValueError('Select a bank account for this EMI payment (or mark installment as cash)')
            _bump_account_balance(db, profile_id, acc_id, -float(row.emi_amount))
    elif acc_id is not None:
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


def sum_loan_principal_collected_for_profile(db: Session, profile_id: int) -> float:
    """Lifetime principal component recovered (from EMI / payment rows)."""
    stmt = (
        select(func.coalesce(func.sum(LoanPayment.principal_paid), 0))
        .join(Loan, LoanPayment.loan_id == Loan.id)
        .where(Loan.profile_id == profile_id)
    )
    return float(db.scalar(stmt) or 0)


def sum_unpaid_loan_emi_due_in_calendar_month(
    db: Session, profile_id: int, year: int, month: int
) -> float:
    """Sum of unpaid scheduled EMIs with due_date in the given calendar month (for dashboard 'EMI this month')."""
    ms = date(year, month, 1)
    last_d = calendar.monthrange(year, month)[1]
    me = date(year, month, last_d)
    stmt = (
        select(func.coalesce(func.sum(LoanSchedule.emi_amount), 0))
        .select_from(LoanSchedule)
        .join(Loan, LoanSchedule.loan_id == Loan.id)
        .where(
            Loan.profile_id == profile_id,
            func.lower(LoanSchedule.payment_status) != 'paid',
            LoanSchedule.due_date >= ms,
            LoanSchedule.due_date <= me,
        )
    )
    return float(db.scalar(stmt) or 0)


def emis_due_in_calendar_month_detail(
    db: Session, profile_id: int, year: int, month: int
) -> dict:
    """
    All unpaid EMI installments (lend + borrow) with due_date in the calendar month.
    Used for dashboard cash planning; see ``pf_accounting_policy``.
    """
    ms = date(year, month, 1)
    last_d = calendar.monthrange(year, month)[1]
    me = date(year, month, last_d)

    lend_stmt = (
        select(
            Loan.id,
            Loan.borrower_name,
            LoanSchedule.emi_number,
            LoanSchedule.due_date,
            LoanSchedule.emi_amount,
        )
        .select_from(LoanSchedule)
        .join(Loan, LoanSchedule.loan_id == Loan.id)
        .where(
            Loan.profile_id == profile_id,
            func.lower(LoanSchedule.payment_status) != 'paid',
            LoanSchedule.due_date >= ms,
            LoanSchedule.due_date <= me,
        )
        .order_by(LoanSchedule.due_date, Loan.borrower_name, LoanSchedule.emi_number)
    )
    borrow_stmt = (
        select(
            FinanceLiability.id,
            FinanceLiability.liability_name,
            LiabilitySchedule.emi_number,
            LiabilitySchedule.due_date,
            LiabilitySchedule.emi_amount,
        )
        .select_from(LiabilitySchedule)
        .join(FinanceLiability, LiabilitySchedule.liability_id == FinanceLiability.id)
        .where(
            FinanceLiability.profile_id == profile_id,
            func.lower(LiabilitySchedule.payment_status) != 'paid',
            LiabilitySchedule.due_date >= ms,
            LiabilitySchedule.due_date <= me,
        )
        .order_by(LiabilitySchedule.due_date, FinanceLiability.liability_name, LiabilitySchedule.emi_number)
    )
    lend_items: list[dict] = []
    borrow_items: list[dict] = []
    lend_total = 0.0
    borrow_total = 0.0
    for r in db.execute(lend_stmt).all():
        amt = float(r[4])
        lend_total += amt
        lend_items.append(
            {
                'side': 'lend',
                'entity_id': int(r[0]),
                'name': str(r[1]),
                'emi_number': int(r[2]),
                'due_date': r[3].isoformat() if r[3] else None,
                'amount': round(amt, 2),
            }
        )
    for r in db.execute(borrow_stmt).all():
        amt = float(r[4])
        borrow_total += amt
        borrow_items.append(
            {
                'side': 'borrow',
                'entity_id': int(r[0]),
                'name': str(r[1]),
                'emi_number': int(r[2]),
                'due_date': r[3].isoformat() if r[3] else None,
                'amount': round(amt, 2),
            }
        )
    items = [*lend_items, *borrow_items]
    items.sort(key=lambda x: (x.get('due_date') or '', x['side'], x['name'], x['emi_number']))
    return {
        'year': year,
        'month': month,
        'lend_due_total': round(lend_total, 2),
        'borrow_due_total': round(borrow_total, 2),
        'combined_due_total': round(lend_total + borrow_total, 2),
        'lend_count': len(lend_items),
        'borrow_count': len(borrow_items),
        'items': items,
    }


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
    interest_lifetime = sum_loan_interest_collected_for_profile(db, profile_id)
    principal_lifetime = sum_loan_principal_collected_for_profile(db, profile_id)
    emi_due_this_month = sum_unpaid_loan_emi_due_in_calendar_month(db, profile_id, today.year, today.month)
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
        'interest_collected_lifetime': interest_lifetime,
        'principal_collected_lifetime': principal_lifetime,
        'emi_due_this_month': emi_due_this_month,
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


def create_account_transfer(
    db: Session,
    profile_id: int,
    user_id: int | None,
    *,
    from_account_id: int,
    to_account_id: int,
    amount: float,
    transfer_date: date,
    transfer_method: str,
    reference_number: str | None,
    notes: str | None,
    attachment_url: str | None,
) -> AccountMovement:
    chan = (transfer_method or 'INTERNAL').strip()
    extra = (
        f'[{chan}] '
        if chan.upper() not in ('INTERNAL', 'INTERNAL_TRANSFER', '')
        else ''
    )
    base = (notes or '').strip()
    notes2 = f'{extra}{base}'.strip() or None
    return create_account_movement(
        db,
        profile_id,
        user_id,
        movement_type=MOVEMENT_INTERNAL,
        amount=amount,
        movement_date=transfer_date,
        from_account_id=from_account_id,
        to_account_id=to_account_id,
        reference_number=reference_number,
        notes=notes2,
        attachment_url=attachment_url,
    )


def create_account_movement(
    db: Session,
    profile_id: int,
    user_id: int | None,
    *,
    movement_type: str,
    amount: float,
    movement_date: date,
    from_account_id: int | None = None,
    to_account_id: int | None = None,
    liability_id: int | None = None,
    loan_id: int | None = None,
    credit_card_id: int | None = None,
    credit_card_bill_id: int | None = None,
    external_counterparty: str | None = None,
    reference_number: str | None = None,
    notes: str | None = None,
    attachment_url: str | None = None,
    create_linked_income: bool = False,
    create_linked_expense: bool = False,
    income_category: str | None = None,
    expense_category: str | None = None,
    emi_number: int | None = None,
    liability_interest_paid: float = 0.0,
) -> AccountMovement:
    """Create one movement row, update balances / liabilities, ledger lines as needed."""
    mtype = (movement_type or '').strip().lower().replace('-', '_')
    if mtype in ('internal', 'internal transfer'):
        mtype = MOVEMENT_INTERNAL
    if mtype in ('emi', 'loan_emi'):
        mtype = MOVEMENT_LOAN_EMI_PAYMENT
    amt = float(amount)
    if amt <= 0:
        raise ValueError('Amount must be positive')
    ref = (reference_number or '').strip()[:128] or None
    note = (notes or '').strip() or None
    ext = (external_counterparty or '').strip()[:120] or None

    if mtype == MOVEMENT_INTERNAL:
        if not from_account_id or not to_account_id:
            raise ValueError('Internal transfer requires from and to accounts')
        if from_account_id == to_account_id:
            raise ValueError('From and to accounts must be different')
        from_acc = get_account_for_profile(db, from_account_id, profile_id)
        to_acc = get_account_for_profile(db, to_account_id, profile_id)
        if from_acc is None or to_acc is None:
            raise ValueError('Account not found or not in this profile')
        if float(from_acc.balance) + 0.005 < amt:
            raise ValueError('Insufficient balance in the source account')
        mv = AccountMovement(
            profile_id=profile_id,
            movement_type=mtype,
            from_account_id=from_account_id,
            to_account_id=to_account_id,
            liability_id=None,
            loan_id=None,
            credit_card_id=None,
            credit_card_bill_id=None,
            amount=amt,
            movement_date=movement_date,
            reference_number=ref,
            notes=note,
            external_counterparty=ext,
            attachment_url=attachment_url,
            created_by=user_id,
        )
        db.add(mv)
        db.flush()
        _bump_account_balance(db, profile_id, from_account_id, -amt)
        _bump_account_balance(db, profile_id, to_account_id, amt)
        db.add(
            AccountTransaction(
                profile_id=profile_id,
                account_id=from_account_id,
                transaction_type='TRANSFER_OUT',
                amount=amt,
                movement_id=mv.id,
                entry_date=movement_date,
                reference_number=ref,
                notes=note,
                created_by=user_id,
            )
        )
        db.add(
            AccountTransaction(
                profile_id=profile_id,
                account_id=to_account_id,
                transaction_type='TRANSFER_IN',
                amount=amt,
                movement_id=mv.id,
                entry_date=movement_date,
                reference_number=ref,
                notes=note,
                created_by=user_id,
            )
        )
        db.commit()
        db.refresh(mv)
        return mv

    if mtype == MOVEMENT_EXTERNAL_DEPOSIT:
        if not to_account_id:
            raise ValueError('Select account to deposit into')
        if get_account_for_profile(db, to_account_id, profile_id) is None:
            raise ValueError('Account not found')
        mv = AccountMovement(
            profile_id=profile_id,
            movement_type=mtype,
            from_account_id=None,
            to_account_id=to_account_id,
            liability_id=None,
            loan_id=loan_id,
            credit_card_id=None,
            credit_card_bill_id=None,
            amount=amt,
            movement_date=movement_date,
            reference_number=ref,
            notes=note,
            external_counterparty=ext,
            attachment_url=attachment_url,
            created_by=user_id,
        )
        db.add(mv)
        db.flush()
        _bump_account_balance(db, profile_id, to_account_id, amt)
        db.add(
            AccountTransaction(
                profile_id=profile_id,
                account_id=to_account_id,
                transaction_type='EXTERNAL_DEPOSIT',
                amount=amt,
                movement_id=mv.id,
                entry_date=movement_date,
                reference_number=ref,
                notes=note or ext,
                created_by=user_id,
            )
        )
        if create_linked_income:
            icat = (income_category or 'external_deposit').strip()[:120] or 'external_deposit'
            db.add(
                FinanceIncome(
                    profile_id=profile_id,
                    account_id=to_account_id,
                    amount=amt,
                    category=icat,
                    income_type='other',
                    entry_date=movement_date,
                    description=note,
                    received_from=ext,
                    payment_method='BANK',
                )
            )
        db.commit()
        db.refresh(mv)
        return mv

    if mtype == MOVEMENT_EXTERNAL_WITHDRAWAL:
        if not from_account_id:
            raise ValueError('Select account to withdraw from')
        acc = get_account_for_profile(db, from_account_id, profile_id)
        if acc is None:
            raise ValueError('Account not found')
        if float(acc.balance) + 0.005 < amt:
            raise ValueError('Insufficient balance in the source account')
        mv = AccountMovement(
            profile_id=profile_id,
            movement_type=mtype,
            from_account_id=from_account_id,
            to_account_id=None,
            liability_id=None,
            loan_id=loan_id,
            credit_card_id=None,
            credit_card_bill_id=None,
            amount=amt,
            movement_date=movement_date,
            reference_number=ref,
            notes=note,
            external_counterparty=ext,
            attachment_url=attachment_url,
            created_by=user_id,
        )
        db.add(mv)
        db.flush()
        _bump_account_balance(db, profile_id, from_account_id, -amt)
        db.add(
            AccountTransaction(
                profile_id=profile_id,
                account_id=from_account_id,
                transaction_type='EXTERNAL_WITHDRAWAL',
                amount=amt,
                movement_id=mv.id,
                entry_date=movement_date,
                reference_number=ref,
                notes=note or ext,
                created_by=user_id,
            )
        )
        if create_linked_expense:
            xcat = (expense_category or 'external_withdrawal').strip()[:120] or 'external_withdrawal'
            db.add(
                FinanceExpense(
                    profile_id=profile_id,
                    account_id=from_account_id,
                    amount=amt,
                    category=xcat,
                    entry_date=movement_date,
                    description=note,
                    paid_by=ext,
                    payment_method='BANK',
                )
            )
        db.commit()
        db.refresh(mv)
        return mv

    if mtype == MOVEMENT_CREDIT_CARD_PAYMENT:
        if not from_account_id or not credit_card_bill_id:
            raise ValueError('Credit card payment requires bank account and bill')
        from fastapi_service.repositories import pf_credit_card_repo

        bill_row = pf_credit_card_repo.get_bill_for_profile(db, credit_card_bill_id, profile_id)
        if bill_row is None:
            raise ValueError('Bill not found')
        card_rid = credit_card_id if credit_card_id is not None else bill_row.card_id

        mv = AccountMovement(
            profile_id=profile_id,
            movement_type=mtype,
            from_account_id=from_account_id,
            to_account_id=None,
            liability_id=None,
            loan_id=None,
            credit_card_id=card_rid,
            credit_card_bill_id=credit_card_bill_id,
            amount=amt,
            movement_date=movement_date,
            reference_number=ref,
            notes=note,
            external_counterparty=ext,
            attachment_url=attachment_url,
            created_by=user_id,
        )
        db.add(mv)
        db.flush()
        pf_credit_card_repo.pay_bill(
            db,
            profile_id,
            user_id,
            bill_id=credit_card_bill_id,
            amount=amt,
            payment_date=movement_date,
            from_account_id=from_account_id,
            reference_number=ref,
            movement_id=mv.id,
        )
        db.refresh(mv)
        return mv

    if mtype == MOVEMENT_LOAN_DISBURSEMENT:
        if not liability_id or not to_account_id:
            raise ValueError('Loan disbursement requires liability and deposit account')
        ln = get_liability_for_profile(db, liability_id, profile_id)
        if ln is None:
            raise ValueError('Liability not found')
        lt = (ln.liability_type or '').upper()
        if lt == 'CREDIT_CARD_STATEMENT':
            raise ValueError('Use credit card bill payment for card statements')
        if get_account_for_profile(db, to_account_id, profile_id) is None:
            raise ValueError('Account not found')
        mv = AccountMovement(
            profile_id=profile_id,
            movement_type=mtype,
            from_account_id=None,
            to_account_id=to_account_id,
            liability_id=liability_id,
            loan_id=None,
            credit_card_id=None,
            credit_card_bill_id=None,
            amount=amt,
            movement_date=movement_date,
            reference_number=ref,
            notes=note,
            external_counterparty=ext,
            attachment_url=attachment_url,
            created_by=user_id,
        )
        db.add(mv)
        db.flush()
        _bump_account_balance(db, profile_id, to_account_id, amt)
        ln.total_amount = float(ln.total_amount or 0) + amt
        ln.outstanding_amount = float(ln.outstanding_amount or 0) + amt
        if str(ln.status).upper() == 'CLOSED':
            ln.status = 'ACTIVE'
        db.add(
            AccountTransaction(
                profile_id=profile_id,
                account_id=to_account_id,
                transaction_type='LOAN_DISBURSEMENT',
                amount=amt,
                movement_id=mv.id,
                entry_date=movement_date,
                reference_number=ref,
                notes=note or f'Loan proceeds — {ln.liability_name}',
                created_by=user_id,
            )
        )
        db.commit()
        db.refresh(mv)
        return mv

    if mtype == MOVEMENT_LOAN_EMI_PAYMENT:
        if not liability_id or not from_account_id:
            raise ValueError('Loan EMI payment requires liability and bank account')
        ln = get_liability_for_profile(db, liability_id, profile_id)
        if ln is None:
            raise ValueError('Liability not found')
        if liability_has_emi_schedule(db, liability_id):
            if emi_number is None:
                raise ValueError('Select EMI installment to pay')
            row = db.scalars(
                select(LiabilitySchedule).where(
                    LiabilitySchedule.liability_id == liability_id,
                    LiabilitySchedule.emi_number == emi_number,
                )
            ).first()
            if row is None:
                raise ValueError('EMI not found')
            if str(row.payment_status).lower() == 'paid':
                raise ValueError('This EMI is already marked paid')
            due_amt = float(row.emi_amount)
            if abs(due_amt - amt) > 0.02:
                raise ValueError('Amount must match the scheduled EMI for this installment')
            mv = AccountMovement(
                profile_id=profile_id,
                movement_type=mtype,
                from_account_id=from_account_id,
                to_account_id=None,
                liability_id=liability_id,
                loan_id=None,
                credit_card_id=None,
                credit_card_bill_id=None,
                amount=due_amt,
                movement_date=movement_date,
                reference_number=ref,
                notes=note,
                external_counterparty=ext,
                attachment_url=attachment_url,
                created_by=user_id,
            )
            db.add(mv)
            db.flush()
            mark_liability_emi_paid(
                db,
                profile_id,
                liability_id,
                emi_number,
                movement_date,
                from_account_id,
                movement_id=mv.id,
            )
            db.refresh(mv)
            return mv
        mv = AccountMovement(
            profile_id=profile_id,
            movement_type=mtype,
            from_account_id=from_account_id,
            to_account_id=None,
            liability_id=liability_id,
            loan_id=None,
            credit_card_id=None,
            credit_card_bill_id=None,
            amount=amt,
            movement_date=movement_date,
            reference_number=ref,
            notes=note,
            external_counterparty=ext,
            attachment_url=attachment_url,
            created_by=user_id,
        )
        db.add(mv)
        db.flush()
        record_liability_payment(
            db,
            profile_id,
            liability_id,
            payment_date=movement_date,
            amount_paid=amt,
            interest_paid=float(liability_interest_paid),
            payment_mode='BANK',
            finance_account_id=from_account_id,
            notes=note,
            movement_id=mv.id,
        )
        db.refresh(mv)
        return mv

    raise ValueError('Unknown movement_type')


def count_account_movements(db: Session, profile_id: int) -> int:
    stmt = select(func.count()).select_from(AccountMovement).where(AccountMovement.profile_id == profile_id)
    return int(db.scalar(stmt) or 0)


def list_account_movements(
    db: Session, profile_id: int, skip: int, limit: int
) -> list[AccountMovement]:
    stmt = (
        select(AccountMovement)
        .where(AccountMovement.profile_id == profile_id)
        .order_by(AccountMovement.movement_date.desc(), AccountMovement.id.desc())
        .offset(skip)
        .limit(limit)
    )
    return list(db.scalars(stmt).all())


# Ledger lines commonly used for cash-movement KPIs (amount is magnitude; type = economic meaning).
LEDGER_CASHFLOW_SUMMARY_TYPES: tuple[str, ...] = (
    'EXTERNAL_DEPOSIT',
    'EXTERNAL_WITHDRAWAL',
    'TRANSFER_IN',
    'TRANSFER_OUT',
    'CC_BILL_PAYMENT',
    'LOAN_DISBURSEMENT',
    'LOAN_LIABILITY_PAYMENT',
    'LOAN_EMI_PAYMENT',
)


def sum_account_transaction_amounts_by_type(
    db: Session,
    profile_id: int,
    start: date,
    end: date,
    transaction_types: tuple[str, ...] | None = None,
) -> dict[str, float]:
    types = transaction_types or LEDGER_CASHFLOW_SUMMARY_TYPES
    stmt = (
        select(AccountTransaction.transaction_type, func.coalesce(func.sum(AccountTransaction.amount), 0))
        .where(
            AccountTransaction.profile_id == profile_id,
            AccountTransaction.entry_date >= start,
            AccountTransaction.entry_date <= end,
            AccountTransaction.transaction_type.in_(types),
        )
        .group_by(AccountTransaction.transaction_type)
    )
    return {str(t): float(a) for t, a in db.execute(stmt).all()}


def account_movements_period_summary(
    db: Session,
    profile_id: int,
    start: date,
    end: date,
) -> dict:
    """Counts and amounts from ``account_movements`` plus ledger-type tallies (same date window)."""
    stmt = (
        select(
            AccountMovement.movement_type,
            func.count(AccountMovement.id),
            func.coalesce(func.sum(AccountMovement.amount), 0),
        )
        .where(
            AccountMovement.profile_id == profile_id,
            AccountMovement.movement_date >= start,
            AccountMovement.movement_date <= end,
        )
        .group_by(AccountMovement.movement_type)
    )
    by_movement: dict[str, dict[str, float | int]] = {}
    for mt, cnt, total in db.execute(stmt).all():
        by_movement[str(mt)] = {
            'count': int(cnt),
            'total_amount': round(float(total), 2),
        }
    ledger = sum_account_transaction_amounts_by_type(
        db, profile_id, start, end, LEDGER_CASHFLOW_SUMMARY_TYPES
    )
    ledger_out = {k: round(v, 2) for k, v in sorted(ledger.items())}
    return {
        'period_start': start.isoformat(),
        'period_end': end.isoformat(),
        'by_movement_type': dict(sorted(by_movement.items())),
        'ledger_totals_by_transaction_type': ledger_out,
    }


def list_account_transfers(
    db: Session, profile_id: int, skip: int, limit: int
) -> list[AccountMovement]:
    return list_account_movements(db, profile_id, skip, limit)


def list_account_statement_lines(
    db: Session,
    profile_id: int,
    account_id: int,
    start: date | None,
    end: date | None,
    skip: int,
    limit: int,
) -> list[AccountTransaction]:
    if get_account_for_profile(db, account_id, profile_id) is None:
        raise ValueError('Account not found')
    stmt = (
        select(AccountTransaction)
        .where(
            AccountTransaction.profile_id == profile_id,
            AccountTransaction.account_id == account_id,
        )
        .order_by(AccountTransaction.entry_date.desc(), AccountTransaction.id.desc())
    )
    if start:
        stmt = stmt.where(AccountTransaction.entry_date >= start)
    if end:
        stmt = stmt.where(AccountTransaction.entry_date <= end)
    stmt = stmt.offset(skip).limit(limit)
    return list(db.scalars(stmt).all())
