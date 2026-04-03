from decimal import Decimal

from fastapi import APIRouter, HTTPException, Query, status

from fastapi_service.core.dependencies import ActiveProfileId, CurrentUser, DbSession, Pagination
from fastapi_service.models_extended import CreditCard, FinanceExpense, PfExpenseCategory
from fastapi_service.repositories import pf_credit_card_repo
from fastapi_service.schemas_extended import (
    CreditCardBillGenerate,
    CreditCardBillOut,
    CreditCardBillPay,
    CreditCardCreate,
    CreditCardOut,
    CreditCardUpdate,
    CreditCardStandaloneTx,
    CreditCardTransactionOut,
    FinanceExpenseOut,
    finance_expense_to_out,
)
from fastapi_service.services import pf_profile_service
from fastapi_service.services.rbac_service import FinanceParticipant

router = APIRouter(prefix='/credit-cards', tags=['personal-finance-credit-cards'])


def _bill_out(b) -> CreditCardBillOut:
    rem = max(Decimal('0'), Decimal(str(b.total_amount)) - Decimal(str(b.amount_paid)))
    return CreditCardBillOut(
        id=b.id,
        card_id=b.card_id,
        bill_start_date=b.bill_start_date,
        bill_end_date=b.bill_end_date,
        total_amount=Decimal(str(b.total_amount)),
        due_date=b.due_date,
        status=b.status,
        liability_id=b.liability_id,
        amount_paid=Decimal(str(b.amount_paid)),
        minimum_due=Decimal(str(getattr(b, 'minimum_due', 0) or 0)),
        interest=Decimal(str(getattr(b, 'interest', 0) or 0)),
        late_fee=Decimal(str(getattr(b, 'late_fee', 0) or 0)),
        created_at=b.created_at,
        remaining=rem,
    )


@router.post('', response_model=CreditCardOut, status_code=201)
def add_credit_card(
    _: FinanceParticipant,
    body: CreditCardCreate,
    user: CurrentUser,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> CreditCard:
    pf_profile_service.assert_can_write(db, user.id, profile_id)
    row = CreditCard(
        profile_id=profile_id,
        card_name=body.card_name.strip(),
        bank_name=(body.bank_name or '').strip() or None,
        card_limit=body.card_limit,
        billing_cycle_start=body.billing_cycle_start,
        billing_cycle_end=body.billing_cycle_end,
        due_days=body.due_days,
        closing_day=body.closing_day,
        due_day=body.due_day,
        interest_rate=body.interest_rate,
        annual_fee=body.annual_fee,
        card_network=(body.card_network or '').strip() or None,
        card_type=(body.card_type or '').strip() or None,
        currency=(body.currency or 'INR').strip().upper()[:8] or 'INR',
        is_active=body.is_active,
    )
    return pf_credit_card_repo.create_card(db, row)


@router.get('', response_model=list[CreditCardOut])
def list_credit_cards(
    _: FinanceParticipant,
    db: DbSession,
    profile_id: ActiveProfileId,
    page: Pagination,
) -> list[CreditCard]:
    return pf_credit_card_repo.list_cards(db, profile_id, page.skip, page.limit)


@router.get('/dashboard-summary')
def credit_card_dashboard_summary(
    _: FinanceParticipant,
    db: DbSession,
    profile_id: ActiveProfileId,
    period_year: int = Query(..., ge=2000, le=2100),
    period_month: int = Query(..., ge=1, le=12),
) -> dict:
    return pf_credit_card_repo.dashboard_summary(
        db, profile_id, period_year=period_year, period_month=period_month
    )


@router.get('/analytics/yearly-spend')
def credit_card_yearly_spend(
    _: FinanceParticipant,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> list[dict]:
    """Yearly spend per card for the active profile."""
    return pf_credit_card_repo.yearly_spend_per_card(db, profile_id)


@router.get('/analytics/monthly-spend')
def credit_card_monthly_spend(
    _: FinanceParticipant,
    db: DbSession,
    profile_id: ActiveProfileId,
    card_id: int = Query(..., ge=1),
    year: int = Query(..., ge=2000, le=2100),
    category_id: int | None = Query(None),
) -> list[dict]:
    """Month-wise spend for a given card and year."""
    # Optional: ensure card belongs to profile (reuses existing helper)
    if pf_credit_card_repo.get_card_for_profile(db, card_id, profile_id) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Credit card not found')
    return pf_credit_card_repo.monthly_spend_for_card(
        db, profile_id, card_id=card_id, year=year, category_id=category_id
    )


@router.get('/analytics/spend-by-category')
def credit_card_spend_by_category(
    _: FinanceParticipant,
    db: DbSession,
    profile_id: ActiveProfileId,
    year: int = Query(..., ge=2000, le=2100),
) -> list[dict]:
    return pf_credit_card_repo.spend_by_category_year(db, profile_id, year)


@router.get('/analytics/card-utilization')
def credit_card_utilization(
    _: FinanceParticipant,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> list[dict]:
    return pf_credit_card_repo.card_utilization_rows(db, profile_id)


@router.get('/analytics/billed-vs-paid')
def credit_card_billed_vs_paid(
    _: FinanceParticipant,
    db: DbSession,
    profile_id: ActiveProfileId,
    period_year: int = Query(..., ge=2000, le=2100),
    period_month: int = Query(..., ge=1, le=12),
    months: int = Query(12, ge=1, le=24),
) -> list[dict]:
    return pf_credit_card_repo.billed_vs_paid_monthly(
        db, profile_id, end_year=period_year, end_month=period_month, months=months
    )


@router.get('/transactions', response_model=list[CreditCardTransactionOut])
def list_cc_transactions(
    _: FinanceParticipant,
    db: DbSession,
    profile_id: ActiveProfileId,
    card_id: int | None = Query(None),
    unbilled_only: bool = Query(False),
    page: Pagination = None,
):
    pg = page or Pagination(skip=0, limit=200)
    rows = pf_credit_card_repo.list_transactions(
        db, profile_id, card_id=card_id, unbilled_only=unbilled_only, skip=pg.skip, limit=pg.limit
    )
    return [
        CreditCardTransactionOut(
            id=r.id,
            card_id=r.card_id,
            amount=Decimal(str(r.amount)),
            transaction_date=r.transaction_date,
            category_id=r.category_id,
            description=r.description,
            expense_id=r.expense_id,
            bill_id=r.bill_id,
            created_at=r.created_at,
        )
        for r in rows
    ]


@router.post('/transactions', response_model=FinanceExpenseOut, status_code=201)
def add_cc_transaction_standalone(
    _: FinanceParticipant,
    body: CreditCardStandaloneTx,
    user: CurrentUser,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> FinanceExpenseOut:
    """Create expense + swipe line (payment_method = credit_card) without debiting bank."""
    pf_profile_service.assert_can_write(db, user.id, profile_id)
    if pf_credit_card_repo.get_card_for_profile(db, body.card_id, profile_id) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Credit card not found')
    cat = (body.category or 'general').strip() or 'general'
    ecid = body.expense_category_id
    if ecid is not None:
        pc = db.get(PfExpenseCategory, ecid)
        if pc:
            cat = pc.name
    row = FinanceExpense(
        profile_id=profile_id,
        account_id=None,
        amount=body.amount,
        category=cat,
        entry_date=body.transaction_date,
        description=body.description,
        expense_category_id=ecid,
        paid_by=body.paid_by,
        payment_method='credit_card',
        payment_instrument_id=None,
        credit_card_id=body.card_id,
        is_recurring=False,
        payment_status='PAID',
    )
    from fastapi_service.repositories import pf_finance_repo

    saved = pf_finance_repo.create_expense(db, row)
    pf_credit_card_repo.create_transaction_from_expense(db, saved, int(body.card_id))
    saved2 = pf_finance_repo.get_expense_for_profile(db, saved.id, profile_id)
    assert saved2 is not None
    return finance_expense_to_out(saved2)


@router.get('/bills', response_model=list[CreditCardBillOut])
def list_cc_bills(
    _: FinanceParticipant,
    db: DbSession,
    profile_id: ActiveProfileId,
    page: Pagination,
    card_id: int | None = Query(None),
) -> list[CreditCardBillOut]:
    rows = pf_credit_card_repo.list_bills(db, profile_id, card_id, page.skip, page.limit)
    return [_bill_out(b) for b in rows]


@router.post('/generate-bill', response_model=CreditCardBillOut, status_code=201)
def generate_cc_bill(
    _: FinanceParticipant,
    body: CreditCardBillGenerate,
    user: CurrentUser,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> CreditCardBillOut:
    pf_profile_service.assert_can_write(db, user.id, profile_id)
    try:
        bill = pf_credit_card_repo.generate_bill(
            db,
            profile_id,
            card_id=body.card_id,
            bill_start_date=body.bill_start_date,
            bill_end_date=body.bill_end_date,
        )
        return _bill_out(bill)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


@router.post('/pay-bill', status_code=201)
def pay_cc_bill(
    _: FinanceParticipant,
    body: CreditCardBillPay,
    user: CurrentUser,
    db: DbSession,
    profile_id: ActiveProfileId,
):
    pf_profile_service.assert_can_write(db, user.id, profile_id)
    try:
        pay = pf_credit_card_repo.pay_bill(
            db,
            profile_id,
            user.id,
            bill_id=body.bill_id,
            amount=body.amount,
            payment_date=body.payment_date,
            from_account_id=body.from_account_id,
            reference_number=body.reference_number,
        )
        return {'id': pay.id, 'bill_id': pay.bill_id, 'amount': float(pay.amount)}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


@router.get('/outstanding')
def cc_outstanding(
    _: FinanceParticipant,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> dict:
    unbilled = pf_credit_card_repo.sum_unbilled_for_profile(db, profile_id)
    billed = pf_credit_card_repo.sum_billed_outstanding_for_profile(db, profile_id)
    return {
        'unbilled_charges': round(unbilled, 2),
        'billed_outstanding': round(billed, 2),
        'total': round(unbilled + billed, 2),
    }


@router.patch('/{card_id}', response_model=CreditCardOut)
def patch_credit_card(
    _: FinanceParticipant,
    card_id: int,
    body: CreditCardUpdate,
    user: CurrentUser,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> CreditCard:
    pf_profile_service.assert_can_write(db, user.id, profile_id)
    row = pf_credit_card_repo.get_card_for_profile(db, card_id, profile_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Credit card not found')
    data = body.model_dump(exclude_unset=True)
    if 'card_name' in data and data['card_name'] is not None:
        data['card_name'] = data['card_name'].strip()
    if 'bank_name' in data:
        data['bank_name'] = (data['bank_name'] or '').strip() or None
    if 'card_network' in data:
        data['card_network'] = (data['card_network'] or '').strip() or None
    if 'card_type' in data:
        data['card_type'] = (data['card_type'] or '').strip() or None
    if 'currency' in data and data['currency'] is not None:
        data['currency'] = data['currency'].strip().upper()[:8] or 'INR'
    return pf_credit_card_repo.patch_credit_card_row(db, row, data)


@router.delete('/{card_id}', status_code=204)
def delete_credit_card(
    _: FinanceParticipant,
    card_id: int,
    user: CurrentUser,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> None:
    pf_profile_service.assert_can_write(db, user.id, profile_id)
    ok = pf_credit_card_repo.delete_card_for_profile(db, card_id, profile_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Credit card not found')
