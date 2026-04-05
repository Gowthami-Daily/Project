"""Chit funds: contribution → asset build (bank txn); auction → discount (loss) + cash + payable; post-auction pay → liability."""

from __future__ import annotations

from datetime import date

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from fastapi_service.models_extended import (
    AccountTransaction,
    ChitFund,
    ChitFundContribution,
    FinanceExpense,
    FinanceIncome,
    FinanceLiability,
)
from fastapi_service.repositories.pf_finance_repo import (
    _bump_account_balance,
    _effective_account_id_for_cash,
    _expense_adjusts_account_balance,
    get_account_for_profile,
    get_liability_for_profile,
    record_liability_payment,
)

CHIT_TX_CONTRIBUTION = 'CHIT_CONTRIBUTION'
CHIT_TX_AUCTION_RECEIPT = 'CHIT_AUCTION_RECEIPT'
CHIT_EXP_COMMISSION = 'Chit Foreman Commission'
CHIT_EXP_DISCOUNT = 'Chit Fund Discount (Loss)'
CHIT_INC_DIVIDEND = 'Chit Dividend'


def get_chit_for_profile(db: Session, chit_id: int, profile_id: int) -> ChitFund | None:
    row = db.get(ChitFund, chit_id)
    if row is None or row.profile_id != profile_id:
        return None
    return row


def list_chits(db: Session, profile_id: int, skip: int = 0, limit: int = 200) -> list[ChitFund]:
    stmt = (
        select(ChitFund)
        .where(ChitFund.profile_id == profile_id)
        .order_by(ChitFund.start_date.desc(), ChitFund.id.desc())
        .offset(skip)
        .limit(limit)
    )
    return list(db.scalars(stmt).all())


def count_contributions(db: Session, chit_fund_id: int) -> int:
    n = db.scalar(
        select(func.count()).select_from(ChitFundContribution).where(ChitFundContribution.chit_fund_id == chit_fund_id)
    )
    return int(n or 0)


def computed_discount(chit: ChitFund) -> float:
    """discount = total_chit_value − amount_received (when auction); else manual discount_amount if any."""
    if not chit.auction_taken:
        return 0.0
    ar = chit.amount_received
    if ar is not None:
        tv = float(chit.total_value or 0)
        return max(0.0, round(tv - float(ar), 2))
    return max(0.0, float(chit.discount_amount or 0))


def remaining_payable(chit: ChitFund) -> float:
    """Installments still owed after auction: total_value − total_paid."""
    if not chit.auction_taken:
        return 0.0
    tv = float(chit.total_value or 0)
    tp = max(0.0, float(chit.total_paid or 0))
    return max(0.0, round(tv - tp, 2))


def liability_book_value(db: Session, chit: ChitFund) -> float:
    if not chit.auction_taken:
        return 0.0
    if chit.linked_liability_id:
        ln = get_liability_for_profile(db, int(chit.linked_liability_id), chit.profile_id)
        if ln is not None:
            return max(0.0, round(float(ln.outstanding_amount or 0), 2))
    return remaining_payable(chit)


def net_asset_value(chit: ChitFund) -> float:
    """Book chit asset: total_paid, or after auction max(0, total_paid − amount_received)."""
    paid = max(0.0, float(chit.total_paid or 0))
    if chit.auction_taken and chit.amount_received is not None:
        return max(0.0, round(paid - float(chit.amount_received), 2))
    return round(paid, 2)


def total_cash_received(chit: ChitFund) -> float:
    if not chit.auction_taken:
        return 0.0
    return max(0.0, float(chit.amount_received or 0))


def net_gain(chit: ChitFund) -> float:
    """dividend − foreman_commission − discount (economic P/L on the chit)."""
    div = max(0.0, float(chit.dividend_received or 0))
    com = max(0.0, float(chit.foreman_commission or 0))
    disc = computed_discount(chit)
    return round(div - com - disc, 2)


def profit_loss(chit: ChitFund) -> float:
    """Alias for dashboards / API (net economic result)."""
    return net_gain(chit)


def remaining_months(db: Session, chit: ChitFund) -> int:
    dur = int(chit.duration_months or 0)
    if dur <= 0:
        return 0
    paid_n = count_contributions(db, chit.id)
    return max(0, dur - paid_n)


def sum_net_asset_value_profile(db: Session, profile_id: int) -> float:
    rows = list_chits(db, profile_id, 0, 5000)
    return round(sum(net_asset_value(r) for r in rows), 2)


def aggregate_chit_metrics(db: Session, profile_id: int) -> dict:
    rows = list_chits(db, profile_id, 0, 5000)
    tot_tv = 0.0
    tot_paid = 0.0
    tot_rec = 0.0
    tot_div = 0.0
    tot_com = 0.0
    tot_disc = 0.0
    tot_rem_mo = 0
    tot_asset = 0.0
    tot_liab = 0.0
    tot_net = 0.0
    for r in rows:
        tot_tv += float(r.total_value or 0)
        tot_paid += float(r.total_paid or 0)
        if r.auction_taken:
            tot_rec += float(r.amount_received or 0)
        tot_div += float(r.dividend_received or 0)
        tot_com += float(r.foreman_commission or 0)
        tot_disc += computed_discount(r)
        tot_rem_mo += remaining_months(db, r)
        tot_asset += net_asset_value(r)
        tot_liab += liability_book_value(db, r)
        tot_net += net_gain(r)
    return {
        'total_chit_value': round(tot_tv, 2),
        'total_paid': round(tot_paid, 2),
        'total_amount_received': round(tot_rec, 2),
        'total_dividend': round(tot_div, 2),
        'total_commission': round(tot_com, 2),
        'total_discount': round(tot_disc, 2),
        'net_profit_loss': round(tot_net, 2),
        'total_remaining_months': int(tot_rem_mo),
        'total_asset_value': round(tot_asset, 2),
        'total_liability_value': round(tot_liab, 2),
        'net_balance_sheet': round(tot_asset - tot_liab, 2),
    }


def ensure_chit_liability(db: Session, profile_id: int, chit: ChitFund) -> None:
    """CHIT_FUND_PAYABLE: outstanding = total_value − total_paid (remaining installments)."""
    if not chit.auction_taken:
        return
    payable = remaining_payable(chit)
    if payable <= 0.01:
        if chit.linked_liability_id:
            ln = get_liability_for_profile(db, int(chit.linked_liability_id), profile_id)
            if ln is not None:
                ln.outstanding_amount = 0.0
                ln.status = 'CLOSED'
        return
    tv = float(chit.total_value or 0)
    if chit.linked_liability_id:
        ln = get_liability_for_profile(db, int(chit.linked_liability_id), profile_id)
        if ln is None:
            chit.linked_liability_id = None
        else:
            ln.liability_type = 'CHIT_FUND_PAYABLE'
            ln.total_amount = max(float(ln.total_amount or 0), tv, payable)
            ln.outstanding_amount = payable
            if str(ln.status).upper() == 'CLOSED':
                ln.status = 'ACTIVE'
            return
    ln = FinanceLiability(
        profile_id=profile_id,
        liability_name=f'Chit Fund Payable · {chit.chit_name}',
        liability_type='CHIT_FUND_PAYABLE',
        total_amount=max(tv, payable),
        outstanding_amount=payable,
        status='ACTIVE',
        notes=f'Linked chit_fund_id={chit.id}',
    )
    db.add(ln)
    db.flush()
    chit.linked_liability_id = ln.id


def maybe_post_auction_ledger(
    db: Session,
    profile_id: int,
    chit: ChitFund,
    *,
    receipt_account_id: int | None,
    booking_date: date | None,
) -> None:
    """One-time: Dr cash (optional), Dr discount (loss), Cr liability is implicit via ensure_chit_liability."""
    if not chit.auction_taken or chit.auction_ledger_posted:
        return
    if chit.amount_received is None:
        return
    ar = float(chit.amount_received or 0)
    if ar < 0:
        return
    bdate = booking_date or chit.start_date
    disc = computed_discount(chit)
    if disc > 0.01:
        db.add(
            FinanceExpense(
                profile_id=profile_id,
                account_id=None,
                amount=disc,
                category=CHIT_EXP_DISCOUNT,
                entry_date=bdate,
                description=f'Chit auction discount (loss): {chit.chit_name}',
                payment_method='BOOK',
                payment_status='PENDING',
            )
        )
    if receipt_account_id is not None and ar > 0.01:
        if get_account_for_profile(db, int(receipt_account_id), profile_id) is None:
            raise ValueError('Auction receipt account not found')
        _bump_account_balance(db, profile_id, int(receipt_account_id), ar)
        db.add(
            AccountTransaction(
                profile_id=profile_id,
                account_id=int(receipt_account_id),
                transaction_type=CHIT_TX_AUCTION_RECEIPT,
                amount=ar,
                entry_date=bdate,
                reference_number=None,
                notes=f'Chit auction receipt — {chit.chit_name}',
                created_by=None,
            )
        )
    chit.discount_amount = disc
    chit.auction_ledger_posted = True
    db.flush()


def create_chit(
    db: Session,
    row: ChitFund,
    *,
    auction_receipt_finance_account_id: int | None = None,
    auction_booking_date: date | None = None,
) -> ChitFund:
    db.add(row)
    db.flush()
    maybe_post_auction_ledger(
        db,
        row.profile_id,
        row,
        receipt_account_id=auction_receipt_finance_account_id,
        booking_date=auction_booking_date,
    )
    ensure_chit_liability(db, row.profile_id, row)
    db.commit()
    db.refresh(row)
    return row


def update_chit_row(
    db: Session,
    chit: ChitFund,
    *,
    auction_receipt_finance_account_id: int | None = None,
    auction_booking_date: date | None = None,
) -> ChitFund:
    db.flush()
    maybe_post_auction_ledger(
        db,
        chit.profile_id,
        chit,
        receipt_account_id=auction_receipt_finance_account_id,
        booking_date=auction_booking_date,
    )
    ensure_chit_liability(db, chit.profile_id, chit)
    if chit.auction_taken and chit.amount_received is not None:
        chit.discount_amount = computed_discount(chit)
    db.commit()
    db.refresh(chit)
    return chit


def delete_chit_for_profile(db: Session, profile_id: int, chit_id: int) -> None:
    row = get_chit_for_profile(db, chit_id, profile_id)
    if row is None:
        raise ValueError('Chit fund not found')
    db.execute(delete(ChitFundContribution).where(ChitFundContribution.chit_fund_id == chit_id))
    db.delete(row)
    db.commit()


def _post_contribution_pre_auction(
    db: Session,
    profile_id: int,
    chit: ChitFund,
    *,
    contribution_date: date,
    amount: float,
    payment_mode: str,
    finance_account_id: int | None,
) -> None:
    """Dr Chit fund asset (tracked on chit row) / Cr cash: bank movement + CHIT_CONTRIBUTION txn only."""
    mode = str(payment_mode or 'BANK').strip().upper()
    acc_id: int | None = None
    if mode == 'BANK':
        if finance_account_id is None:
            raise ValueError('Select a bank account for BANK mode')
        if get_account_for_profile(db, int(finance_account_id), profile_id) is None:
            raise ValueError('Account not found')
        acc_id = int(finance_account_id)
    elif mode != 'CASH':
        raise ValueError('payment_mode must be BANK or CASH')
    else:
        # CASH: optional explicit wallet — required when the profile has more than one finance account
        if finance_account_id is not None:
            if get_account_for_profile(db, int(finance_account_id), profile_id) is None:
                raise ValueError('Account not found')
            acc_id = int(finance_account_id)
    eff = _effective_account_id_for_cash(db, profile_id, acc_id)
    if eff is None:
        raise ValueError(
            'Select which cash/bank account to pay from (needed when you have more than one account)'
        )
    _bump_account_balance(db, profile_id, eff, -amount)
    db.add(
        AccountTransaction(
            profile_id=profile_id,
            account_id=eff,
            transaction_type=CHIT_TX_CONTRIBUTION,
            amount=amount,
            entry_date=contribution_date,
            reference_number=None,
            notes=f'Chit fund contribution — {chit.chit_name}',
            created_by=None,
        )
    )


def record_contribution(
    db: Session,
    profile_id: int,
    chit_fund_id: int,
    *,
    contribution_date: date,
    amount: float,
    payment_mode: str,
    finance_account_id: int | None,
    notes: str | None,
) -> ChitFundContribution:
    chit = get_chit_for_profile(db, chit_fund_id, profile_id)
    if chit is None:
        raise ValueError('Chit fund not found')
    if str(chit.status).upper() == 'COMPLETED':
        raise ValueError('Chit is completed')
    amt = float(amount)
    if amt <= 0:
        raise ValueError('Amount must be positive')
    mode = str(payment_mode or 'BANK').strip().upper()

    if chit.auction_taken:
        db.refresh(chit)
        ensure_chit_liability(db, profile_id, chit)
        if not chit.linked_liability_id:
            rp = remaining_payable(chit)
            raise ValueError(
                'No chit installment payable on record (total paid has reached or exceeded pot value). '
                f'Pot ₹{float(chit.total_value or 0):,.2f}, paid ₹{float(chit.total_paid or 0):,.2f}, remaining ₹{rp:,.2f}.'
            )
        ln = get_liability_for_profile(db, int(chit.linked_liability_id), profile_id)
        if ln is None:
            raise ValueError('Linked chit liability missing')
        due = max(0.0, float(ln.outstanding_amount or 0))
        if due <= 0.01:
            rp = remaining_payable(chit)
            raise ValueError(
                'Chit installment liability is already settled (₹0 outstanding). '
                f'Pot ₹{float(chit.total_value or 0):,.2f}, paid ₹{float(chit.total_paid or 0):,.2f}, remaining ₹{rp:,.2f}.'
            )
        pay_amt = min(amt, due)
        record_liability_payment(
            db,
            profile_id,
            int(chit.linked_liability_id),
            payment_date=contribution_date,
            amount_paid=pay_amt,
            interest_paid=0.0,
            payment_mode=mode,
            finance_account_id=finance_account_id if mode == 'BANK' else None,
            notes=(notes or '').strip() or f'Chit installment — {chit.chit_name}',
            autocommit=False,
        )
        ensure_chit_liability(db, profile_id, chit)
    else:
        _post_contribution_pre_auction(
            db,
            profile_id,
            chit,
            contribution_date=contribution_date,
            amount=amt,
            payment_mode=mode,
            finance_account_id=finance_account_id,
        )

    row = ChitFundContribution(
        chit_fund_id=chit_fund_id,
        contribution_date=contribution_date,
        amount=amt,
        payment_mode=mode,
        finance_account_id=int(finance_account_id) if finance_account_id is not None else None,
        notes=(notes or '').strip() or None,
    )
    db.add(row)
    chit.total_paid = round(float(chit.total_paid or 0) + amt, 2)
    ensure_chit_liability(db, profile_id, chit)
    db.flush()
    db.commit()
    db.refresh(row)
    return row


def record_dividend(
    db: Session,
    profile_id: int,
    chit_fund_id: int,
    *,
    entry_date: date,
    amount: float,
    finance_account_id: int | None,
    notes: str | None,
) -> FinanceIncome:
    chit = get_chit_for_profile(db, chit_fund_id, profile_id)
    if chit is None:
        raise ValueError('Chit fund not found')
    amt = float(amount)
    if amt <= 0:
        raise ValueError('Amount must be positive')
    inc = FinanceIncome(
        profile_id=profile_id,
        account_id=finance_account_id,
        amount=amt,
        category=CHIT_INC_DIVIDEND,
        income_type='other',
        entry_date=entry_date,
        description=f'Chit dividend: {chit.chit_name}',
        payment_method='BANK' if finance_account_id else 'CASH',
    )
    eff = _effective_account_id_for_cash(db, profile_id, inc.account_id)
    if eff is not None:
        _bump_account_balance(db, profile_id, eff, amt)
        inc.account_id = eff
    db.add(inc)
    db.flush()
    saved = inc
    chit.dividend_received = round(float(chit.dividend_received or 0) + amt, 2)
    db.commit()
    db.refresh(saved)
    db.refresh(chit)
    return saved


def record_foreman_commission(
    db: Session,
    profile_id: int,
    chit_fund_id: int,
    *,
    entry_date: date,
    amount: float,
    finance_account_id: int | None,
    notes: str | None,
) -> FinanceExpense:
    chit = get_chit_for_profile(db, chit_fund_id, profile_id)
    if chit is None:
        raise ValueError('Chit fund not found')
    amt = float(amount)
    if amt <= 0:
        raise ValueError('Amount must be positive')
    mode = 'BANK' if finance_account_id else 'CASH'
    if mode == 'BANK' and get_account_for_profile(db, int(finance_account_id), profile_id) is None:
        raise ValueError('Account not found')
    exp = FinanceExpense(
        profile_id=profile_id,
        account_id=finance_account_id,
        amount=amt,
        category=CHIT_EXP_COMMISSION,
        entry_date=entry_date,
        description=f'Chit foreman commission: {chit.chit_name}',
        payment_method=mode,
        payment_status='PAID',
    )
    if _expense_adjusts_account_balance(exp):
        eff = _effective_account_id_for_cash(db, profile_id, exp.account_id)
        if eff is not None:
            _bump_account_balance(db, profile_id, eff, -amt)
            exp.account_id = eff
    db.add(exp)
    db.flush()
    saved = exp
    chit.foreman_commission = round(float(chit.foreman_commission or 0) + amt, 2)
    db.commit()
    db.refresh(saved)
    db.refresh(chit)
    return saved


def list_contributions(db: Session, chit_fund_id: int) -> list[ChitFundContribution]:
    stmt = (
        select(ChitFundContribution)
        .where(ChitFundContribution.chit_fund_id == chit_fund_id)
        .order_by(ChitFundContribution.contribution_date.desc(), ChitFundContribution.id.desc())
    )
    return list(db.scalars(stmt).all())
