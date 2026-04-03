from datetime import date
from decimal import Decimal

from fastapi import APIRouter, HTTPException, Path, Query, status

from fastapi_service.core.dependencies import ActiveProfileId, CurrentUser, DbSession, Pagination
from fastapi_service.models_extended import CreditCard, PfExpenseCategory
from fastapi_service.repositories import pf_credit_card_repo, pf_finance_repo
from fastapi_service.schemas_extended import (
    CreditCardBillGenerate,
    CreditCardBillLineOut,
    CreditCardBillOut,
    CreditCardBillPay,
    CreditCardBillPreviewOut,
    CreditCardBillStatementOut,
    CreditCardCreate,
    CreditCardLedgerPageOut,
    CreditCardLedgerSummaryOut,
    CreditCardOut,
    CreditCardStandaloneTx,
    CreditCardTransactionLedgerRow,
    CreditCardTransactionUpdate,
    CreditCardTxAssignBill,
    CreditCardUpdate,
)
from fastapi_service.services import pf_profile_service
from fastapi_service.services.rbac_service import FinanceParticipant

router = APIRouter(prefix='/credit-cards', tags=['personal-finance-credit-cards'])


def _bill_display_label(b: object, *, today: date) -> str:
    rem_f = max(0.0, float(getattr(b, 'total_amount', 0) or 0) - float(getattr(b, 'amount_paid', 0) or 0))
    if rem_f <= 0.01:
        return 'Paid'
    st = (getattr(b, 'status', None) or '').upper()
    due: date = getattr(b, 'due_date')
    if st == 'PAID':
        return 'Paid'
    if due < today and rem_f > 0.01:
        return 'Overdue'
    if st == 'OVERDUE':
        return 'Overdue'
    if st == 'PARTIAL':
        return 'Partial'
    if st in ('PENDING', 'BILLED'):
        return 'Billed'
    return st.title() if st else 'Billed'


def _bill_out(b: object, *, today: date) -> CreditCardBillOut:
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
        opening_balance=Decimal(str(getattr(b, 'opening_balance', 0) or 0)),
        minimum_due=Decimal(str(getattr(b, 'minimum_due', 0) or 0)),
        interest=Decimal(str(getattr(b, 'interest', 0) or 0)),
        late_fee=Decimal(str(getattr(b, 'late_fee', 0) or 0)),
        created_at=b.created_at,
        remaining=rem,
        display_status=_bill_display_label(b, today=today),
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


@router.get('/transactions', response_model=CreditCardLedgerPageOut)
def list_cc_transactions(
    _: FinanceParticipant,
    db: DbSession,
    profile_id: ActiveProfileId,
    page: Pagination,
    card_id: int | None = Query(None),
    category_id: int | None = Query(None),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    status: str | None = Query(
        None,
        description='Filter: unbilled | billed | paid | overdue | refunded | emi (omit = all)',
    ),
    unbilled_only: bool = Query(False),
) -> CreditCardLedgerPageOut:
    pg = page
    sf = None if not status or str(status).strip().lower() in ('all', '') else str(status).strip().lower()
    data = pf_credit_card_repo.build_ledger_page(
        db,
        profile_id,
        card_id=card_id,
        category_id=category_id,
        date_from=date_from,
        date_to=date_to,
        unbilled_only=unbilled_only,
        status_filter=sf,
        skip=pg.skip,
        limit=min(pg.limit, 500),
    )
    return CreditCardLedgerPageOut(
        summary=CreditCardLedgerSummaryOut(**data['summary']),
        transactions=[CreditCardTransactionLedgerRow(**r) for r in data['transactions']],
    )


@router.post('/transactions', response_model=CreditCardTransactionLedgerRow, status_code=201)
def add_cc_transaction_standalone(
    _: FinanceParticipant,
    body: CreditCardStandaloneTx,
    user: CurrentUser,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> CreditCardTransactionLedgerRow:
    """Create a credit card ledger line (and linked expense when type is swipe, refund, or emi)."""
    pf_profile_service.assert_can_write(db, user.id, profile_id)
    try:
        tx = pf_credit_card_repo.create_standalone_cc_ledger_row(
            db,
            profile_id,
            card_id=int(body.card_id),
            transaction_type=body.transaction_type,
            amount_in=float(body.amount),
            transaction_date=body.transaction_date,
            expense_category_id=body.expense_category_id,
            category_label=body.category,
            description=body.description,
            merchant=body.merchant,
            notes=body.notes,
            attachment_url=body.attachment_url,
            is_emi=body.is_emi,
            paid_by=body.paid_by,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    row = pf_credit_card_repo.single_ledger_row_dict(db, profile_id, tx.id)
    if row is None:
        raise HTTPException(status_code=500, detail='Could not load transaction')
    return CreditCardTransactionLedgerRow(**row)


@router.patch('/transactions/{tx_id}', response_model=CreditCardTransactionLedgerRow)
def patch_cc_transaction_route(
    _: FinanceParticipant,
    tx_id: int,
    body: CreditCardTransactionUpdate,
    user: CurrentUser,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> CreditCardTransactionLedgerRow:
    pf_profile_service.assert_can_write(db, user.id, profile_id)
    tx = pf_credit_card_repo.get_cc_transaction_for_profile(db, tx_id, profile_id)
    if tx is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Transaction not found')
    if tx.bill_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Cannot edit a transaction that is already on a statement',
        )
    patch_data = body.model_dump(exclude_unset=True)
    if 'merchant' in patch_data and patch_data['merchant'] is not None:
        patch_data['merchant'] = patch_data['merchant'].strip()[:200] or None
    if 'notes' in patch_data and patch_data['notes'] is not None:
        patch_data['notes'] = patch_data['notes'].strip() or None
    if 'attachment_url' in patch_data and patch_data['attachment_url'] is not None:
        patch_data['attachment_url'] = patch_data['attachment_url'].strip() or None
    if 'transaction_type' in patch_data and patch_data['transaction_type']:
        t = patch_data['transaction_type'].strip().lower()
        if t not in ('swipe', 'refund', 'fee', 'interest', 'emi'):
            raise HTTPException(status_code=400, detail='Invalid transaction_type')
        patch_data['transaction_type'] = t[:20]
    eff_type = (
        patch_data.get('transaction_type')
        or (getattr(tx, 'transaction_type', None) or 'swipe')
    ).lower()
    if 'amount' in patch_data and patch_data['amount'] is not None:
        patch_data['amount'] = (
            -abs(float(patch_data['amount'])) if eff_type == 'refund' else float(patch_data['amount'])
        )
        if eff_type != 'refund':
            patch_data['amount'] = abs(float(patch_data['amount']))
    pf_credit_card_repo.patch_cc_transaction(db, tx, patch_data)
    tx2 = pf_credit_card_repo.get_cc_transaction_for_profile(db, tx_id, profile_id)
    if tx2 and tx2.expense_id is not None:
        ex = pf_finance_repo.get_expense_for_profile(db, tx2.expense_id, profile_id)
        if ex is not None:
            eup: dict = {}
            if 'amount' in patch_data or 'transaction_date' in patch_data:
                eup['amount'] = float(tx2.amount)
                eup['entry_date'] = tx2.transaction_date
            if 'category_id' in patch_data:
                eup['expense_category_id'] = tx2.category_id
            if 'description' in patch_data:
                eup['description'] = tx2.description
            if eup:
                pf_finance_repo.update_expense(db, profile_id, ex, eup)
    row = pf_credit_card_repo.single_ledger_row_dict(db, profile_id, tx_id)
    if row is None:
        raise HTTPException(status_code=500, detail='Could not load transaction')
    return CreditCardTransactionLedgerRow(**row)


@router.delete('/transactions/{tx_id}', status_code=204)
def delete_cc_transaction_route(
    _: FinanceParticipant,
    tx_id: int,
    user: CurrentUser,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> None:
    pf_profile_service.assert_can_write(db, user.id, profile_id)
    try:
        ok = pf_credit_card_repo.delete_cc_transaction(db, profile_id, tx_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Transaction not found')


@router.post('/transactions/{tx_id}/assign-bill', response_model=CreditCardTransactionLedgerRow)
def assign_cc_tx_to_bill(
    _: FinanceParticipant,
    tx_id: int,
    body: CreditCardTxAssignBill,
    user: CurrentUser,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> CreditCardTransactionLedgerRow:
    pf_profile_service.assert_can_write(db, user.id, profile_id)
    try:
        pf_credit_card_repo.attach_transaction_to_bill(db, profile_id, tx_id, body.bill_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    row = pf_credit_card_repo.single_ledger_row_dict(db, profile_id, tx_id)
    if row is None:
        raise HTTPException(status_code=500, detail='Could not load transaction')
    return CreditCardTransactionLedgerRow(**row)


@router.get('/bills', response_model=list[CreditCardBillOut])
def list_cc_bills(
    _: FinanceParticipant,
    db: DbSession,
    profile_id: ActiveProfileId,
    page: Pagination,
    card_id: int | None = Query(None),
) -> list[CreditCardBillOut]:
    rows = pf_credit_card_repo.list_bills(db, profile_id, card_id, page.skip, page.limit)
    today = date.today()
    return [_bill_out(b, today=today) for b in rows]


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
        return _bill_out(bill, today=date.today())
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


@router.get('/bill-preview', response_model=CreditCardBillPreviewOut)
def preview_cc_bill(
    _: FinanceParticipant,
    db: DbSession,
    profile_id: ActiveProfileId,
    card_id: int = Query(..., ge=1),
    bill_start_date: date = Query(...),
    bill_end_date: date = Query(...),
) -> CreditCardBillPreviewOut:
    try:
        data = pf_credit_card_repo.preview_statement_for_card(
            db,
            profile_id,
            card_id=card_id,
            bill_start_date=bill_start_date,
            bill_end_date=bill_end_date,
        )
        return CreditCardBillPreviewOut(**data)
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
            payment_type=body.payment_type,
            notes=body.notes,
        )
        return {
            'id': pay.id,
            'bill_id': pay.bill_id,
            'amount': float(pay.amount),
            'payment_type': body.payment_type,
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


@router.get('/bills/{bill_id}/statement', response_model=CreditCardBillStatementOut)
def get_cc_bill_statement(
    _: FinanceParticipant,
    db: DbSession,
    profile_id: ActiveProfileId,
    bill_id: int = Path(..., ge=1),
) -> CreditCardBillStatementOut:
    data = pf_credit_card_repo.statement_detail_for_bill(db, profile_id, bill_id)
    if data is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Bill not found')
    return CreditCardBillStatementOut(
        bill=data['bill'],
        lines=[CreditCardBillLineOut(**row) for row in data['lines']],
    )


@router.post('/bills/{bill_id}/mark-overdue', response_model=CreditCardBillOut)
def mark_cc_bill_overdue(
    _: FinanceParticipant,
    user: CurrentUser,
    db: DbSession,
    profile_id: ActiveProfileId,
    bill_id: int = Path(..., ge=1),
    late_fee: float = Query(500.0, ge=0, le=50000),
) -> CreditCardBillOut:
    pf_profile_service.assert_can_write(db, user.id, profile_id)
    try:
        bill = pf_credit_card_repo.mark_bill_overdue_with_late_fee(
            db, profile_id, bill_id=bill_id, late_fee_amount=late_fee
        )
        return _bill_out(bill, today=date.today())
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


@router.get('/analytics/outstanding-trend')
def credit_card_outstanding_trend(
    _: FinanceParticipant,
    db: DbSession,
    profile_id: ActiveProfileId,
    period_year: int = Query(..., ge=2000, le=2100),
    period_month: int = Query(..., ge=1, le=12),
    months: int = Query(12, ge=1, le=36),
) -> list[dict]:
    return pf_credit_card_repo.outstanding_balance_trend(
        db, profile_id, end_year=period_year, end_month=period_month, months=months
    )


@router.get('/analytics/interest-trend')
def credit_card_interest_trend(
    _: FinanceParticipant,
    db: DbSession,
    profile_id: ActiveProfileId,
    period_year: int = Query(..., ge=2000, le=2100),
    period_month: int = Query(..., ge=1, le=12),
    months: int = Query(12, ge=1, le=36),
) -> list[dict]:
    return pf_credit_card_repo.interest_charges_by_bill_month(
        db, profile_id, end_year=period_year, end_month=period_month, months=months
    )


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
