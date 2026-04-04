from calendar import monthrange
from datetime import date as date_type
from decimal import Decimal

from fastapi import APIRouter, File, Form, HTTPException, Query, Response, UploadFile, status

from fastapi_service.core.dependencies import ActiveProfileId, CurrentUser, DbSession, Pagination
from fastapi_service.models_extended import (
    FinanceAccount,
    FinanceAsset,
    FinanceExpense,
    FinanceIncome,
    FinanceInvestment,
    FinanceInvestmentTransaction,
    FinanceLiability,
    Loan,
    LoanPayment,
    PfExpenseCategory,
    PfIncomeCategory,
    PfPaymentInstrument,
)
from fastapi_service.repositories import pf_credit_card_repo, pf_finance_repo
from fastapi_service.services import pf_investment_ledger_service
from fastapi_service.schemas_extended import (
    AccountBalanceSummaryOut,
    AccountMovementCreate,
    AccountMovementOut,
    AccountTransactionOut,
    AccountTransferOut,
    AssetsPageSummaryOut,
    FinanceAccountCreate,
    FinanceAccountOut,
    FinanceAccountPatch,
    FinanceAssetCreate,
    FinanceAssetOut,
    FinanceAssetUpdate,
    FinanceExpenseCreate,
    FinanceExpenseOut,
    FinanceExpenseUpdate,
    FinanceIncomeCreate,
    FinanceIncomeOut,
    FinanceIncomeUpdate,
    FinanceInvestmentCreate,
    FinanceInvestmentLedgerOut,
    FinanceInvestmentOut,
    FinanceInvestmentTransactionCreate,
    FinanceInvestmentTransactionOut,
    FinanceInvestmentUpdate,
    InvestmentMonthlyFlowRow,
    FinanceLiabilityCreate,
    FinanceLiabilityOut,
    FinanceLiabilityUpdate,
    LiabilitiesPageSummaryOut,
    LiabilityEmiPayBody,
    LiabilityPaymentCreate,
    LiabilityPaymentOut,
    LiabilityAddPrincipalBody,
    LiabilityPendingEmiOut,
    LiabilityScheduleOut,
    LoanAddPrincipalBody,
    LoanCreate,
    LoanOut,
    LoanPatch,
    LoansPageSummaryOut,
    LoanPaymentCreate,
    LoanPaymentOut,
    LoanEmiPayBody,
    LoanPendingEmiOut,
    LoanScheduleCreditUpdate,
    LoanScheduleOut,
    PfMasterCategoryOut,
    PfPaymentInstrumentCreate,
    PfPaymentInstrumentOut,
    finance_expense_to_out,
    finance_income_to_out,
)
from fastapi_service.services import (
    pf_asset_ui_service,
    pf_liability_ui_service,
    pf_loan_ui_service,
    pf_profile_service,
    pf_transfer_attachment,
)
from fastapi_service.services.rbac_service import FinanceParticipant

router = APIRouter()


def _loan_for_profile(db, loan_id: int, profile_id: int) -> Loan:
    ln = db.get(Loan, loan_id)
    if ln is None or ln.profile_id != profile_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Loan not found')
    return ln


def _liability_for_profile(db, liability_id: int, profile_id: int) -> FinanceLiability:
    ln = db.get(FinanceLiability, liability_id)
    if ln is None or ln.profile_id != profile_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Liability not found')
    return ln


def _loan_out_fresh(db: DbSession, profile_id: int, row: Loan) -> LoanOut:
    has_s = pf_finance_repo.loan_has_emi_schedule(db, row.id)
    next_emi = pf_finance_repo.next_pending_emi_by_loan(db, profile_id)
    imap = pf_finance_repo.interest_paid_by_loan_ids(db, profile_id, [row.id])
    return pf_loan_ui_service.build_loan_out(
        db,
        row,
        has_emi_schedule=has_s,
        next_emi=next_emi.get(row.id),
        interest_collected=imap.get(row.id, 0.0),
    )


@router.get('/accounts', response_model=list[FinanceAccountOut])
def list_accounts(
    _: FinanceParticipant,
    db: DbSession,
    profile_id: ActiveProfileId,
    page: Pagination,
) -> list[FinanceAccount]:
    return pf_finance_repo.list_accounts(db, profile_id, page.skip, page.limit)


@router.post('/accounts', response_model=FinanceAccountOut, status_code=201)
def create_account(
    _: FinanceParticipant,
    body: FinanceAccountCreate,
    user: CurrentUser,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> FinanceAccount:
    pf_profile_service.assert_can_write(db, user.id, profile_id)
    row = FinanceAccount(
        profile_id=profile_id,
        account_name=body.account_name,
        account_type=body.account_type,
        balance=body.balance,
        include_in_networth=body.include_in_networth,
        include_in_liquid=body.include_in_liquid,
    )
    return pf_finance_repo.create_account(db, row)


@router.patch('/accounts/{account_id}', response_model=FinanceAccountOut)
def patch_account(
    account_id: int,
    _: FinanceParticipant,
    body: FinanceAccountPatch,
    user: CurrentUser,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> FinanceAccount:
    pf_profile_service.assert_can_write(db, user.id, profile_id)
    row = pf_finance_repo.get_account_for_profile(db, account_id, profile_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Account not found')
    return pf_finance_repo.patch_finance_account(
        db,
        row,
        balance=body.balance,
        account_type=body.account_type,
        account_name=body.account_name,
        include_in_networth=body.include_in_networth,
        include_in_liquid=body.include_in_liquid,
    )


@router.delete('/accounts/{account_id}', status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    account_id: int,
    _: FinanceParticipant,
    user: CurrentUser,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> Response:
    pf_profile_service.assert_can_write(db, user.id, profile_id)
    try:
        pf_finance_repo.delete_account(db, profile_id, account_id)
    except ValueError as e:
        msg = str(e)
        code = (
            status.HTTP_400_BAD_REQUEST
            if 'transfer history' in msg.lower()
            else status.HTTP_404_NOT_FOUND
        )
        raise HTTPException(status_code=code, detail=msg) from e
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post('/accounts/movements', response_model=AccountMovementOut, status_code=201)
def create_account_movement_route(
    _: FinanceParticipant,
    user: CurrentUser,
    db: DbSession,
    profile_id: ActiveProfileId,
    body: AccountMovementCreate,
):
    pf_profile_service.assert_can_write(db, user.id, profile_id)
    try:
        return pf_finance_repo.create_account_movement(
            db,
            profile_id,
            user.id,
            movement_type=body.movement_type,
            amount=body.amount,
            movement_date=body.movement_date,
            from_account_id=body.from_account_id,
            to_account_id=body.to_account_id,
            liability_id=body.liability_id,
            loan_id=body.loan_id,
            credit_card_id=body.credit_card_id,
            credit_card_bill_id=body.credit_card_bill_id,
            external_counterparty=body.external_counterparty,
            reference_number=body.reference_number,
            notes=body.notes,
            attachment_url=None,
            create_linked_income=body.create_linked_income,
            create_linked_expense=body.create_linked_expense,
            income_category=body.income_category,
            expense_category=body.expense_category,
            emi_number=body.emi_number,
            liability_interest_paid=body.liability_interest_paid,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


@router.post('/accounts/transfer', response_model=AccountTransferOut, status_code=201)
def create_account_transfer(
    _: FinanceParticipant,
    user: CurrentUser,
    db: DbSession,
    profile_id: ActiveProfileId,
    from_account_id: int = Form(...),
    to_account_id: int = Form(...),
    amount: float = Form(...),
    transfer_date: date_type = Form(...),
    transfer_method: str = Form('INTERNAL'),
    reference_number: str | None = Form(None),
    notes: str | None = Form(None),
    attachment: UploadFile | None = File(None),
):
    pf_profile_service.assert_can_write(db, user.id, profile_id)
    attachment_url = None
    if attachment is not None and (attachment.filename or '').strip():
        try:
            attachment_url = pf_transfer_attachment.save_transfer_attachment(profile_id, attachment)
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    try:
        return pf_finance_repo.create_account_transfer(
            db,
            profile_id,
            user.id,
            from_account_id=from_account_id,
            to_account_id=to_account_id,
            amount=amount,
            transfer_date=transfer_date,
            transfer_method=transfer_method,
            reference_number=reference_number,
            notes=notes,
            attachment_url=attachment_url,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


@router.get('/accounts/movements', response_model=list[AccountMovementOut])
@router.get('/accounts/transfer-history', response_model=list[AccountTransferOut])
def list_transfer_history(
    _: FinanceParticipant,
    response: Response,
    db: DbSession,
    profile_id: ActiveProfileId,
    page: Pagination,
) -> list:
    total = pf_finance_repo.count_account_movements(db, profile_id)
    response.headers['X-Total-Count'] = str(total)
    return pf_finance_repo.list_account_movements(db, profile_id, page.skip, page.limit)


@router.get('/accounts/movements/summary')
def account_movements_summary(
    _: FinanceParticipant,
    db: DbSession,
    profile_id: ActiveProfileId,
    year: int | None = Query(None, ge=2000, le=2100, description='Calendar year (use with month)'),
    month: int | None = Query(None, ge=1, le=12, description='Calendar month (use with year)'),
    start_date: date_type | None = Query(None),
    end_date: date_type | None = Query(None),
) -> dict:
    if start_date is not None and end_date is not None:
        if start_date > end_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail='start_date must be on or before end_date',
            )
        start, end = start_date, end_date
    elif year is not None and month is not None:
        start = date_type(year, month, 1)
        end = date_type(year, month, monthrange(year, month)[1])
    elif year is None and month is None and start_date is None and end_date is None:
        today = date_type.today()
        start = date_type(today.year, today.month, 1)
        end = date_type(today.year, today.month, monthrange(today.year, today.month)[1])
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Provide both year and month, or both start_date and end_date, or neither for the current month.',
        )
    return pf_finance_repo.account_movements_period_summary(db, profile_id, start, end)


@router.get('/accounts/{account_id}/statement', response_model=list[AccountTransactionOut])
def get_account_statement(
    account_id: int,
    _: FinanceParticipant,
    db: DbSession,
    profile_id: ActiveProfileId,
    page: Pagination,
    start_date: date_type | None = Query(None),
    end_date: date_type | None = Query(None),
):
    try:
        return pf_finance_repo.list_account_statement_lines(
            db,
            profile_id,
            account_id,
            start_date,
            end_date,
            page.skip,
            page.limit,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e


@router.get('/accounts/balance-summary', response_model=AccountBalanceSummaryOut)
def get_balance_summary(
    _: FinanceParticipant,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> AccountBalanceSummaryOut:
    split = pf_finance_repo.sum_account_balances_cash_vs_bank(db, profile_id)
    rows = pf_finance_repo.list_accounts(db, profile_id, 0, 500)
    accounts = [
        {
            'id': a.id,
            'account_name': a.account_name,
            'account_type': a.account_type or '',
            'balance': float(a.balance),
        }
        for a in rows
    ]
    return AccountBalanceSummaryOut(
        cash_balance=split['cash'],
        bank_balance=split['bank'],
        total_balance=split['total'],
        accounts=accounts,
    )


@router.get('/expense-categories', response_model=list[PfMasterCategoryOut])
def list_expense_categories(
    _: FinanceParticipant,
    db: DbSession,
) -> list[PfExpenseCategory]:
    return pf_finance_repo.list_pf_expense_categories(db)


@router.get('/income-categories', response_model=list[PfMasterCategoryOut])
def list_income_categories(
    _: FinanceParticipant,
    db: DbSession,
) -> list[PfIncomeCategory]:
    return pf_finance_repo.list_pf_income_categories(db)


@router.get('/payment-instruments', response_model=list[PfPaymentInstrumentOut])
def list_payment_instruments(
    _: FinanceParticipant,
    db: DbSession,
    profile_id: ActiveProfileId,
    kind: str | None = Query(None, description='Filter: card or upi'),
) -> list[PfPaymentInstrument]:
    return pf_finance_repo.list_pf_payment_instruments(db, profile_id, kind)


@router.post('/payment-instruments', response_model=PfPaymentInstrumentOut, status_code=201)
def create_payment_instrument(
    _: FinanceParticipant,
    body: PfPaymentInstrumentCreate,
    user: CurrentUser,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> PfPaymentInstrument:
    pf_profile_service.assert_can_write(db, user.id, profile_id)
    acc = pf_finance_repo.get_account_for_profile(db, body.finance_account_id, profile_id)
    if acc is None:
        raise HTTPException(status_code=400, detail='finance_account_id must be an account in this profile')
    row = PfPaymentInstrument(
        profile_id=profile_id,
        kind=body.kind,
        label=body.label.strip(),
        finance_account_id=body.finance_account_id,
    )
    return pf_finance_repo.create_pf_payment_instrument(db, row)


@router.delete('/payment-instruments/{instrument_id}', status_code=status.HTTP_204_NO_CONTENT)
def delete_payment_instrument(
    instrument_id: int,
    _: FinanceParticipant,
    user: CurrentUser,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> Response:
    pf_profile_service.assert_can_write(db, user.id, profile_id)
    try:
        pf_finance_repo.delete_pf_payment_instrument(db, profile_id, instrument_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get('/income', response_model=list[FinanceIncomeOut])
def list_income(
    _: FinanceParticipant,
    db: DbSession,
    profile_id: ActiveProfileId,
    page: Pagination,
    date_from: date_type | None = Query(None),
    date_to: date_type | None = Query(None),
    account_id: int | None = Query(None, ge=1),
    category: str | None = Query(None, max_length=120),
) -> list[FinanceIncomeOut]:
    rows = pf_finance_repo.list_income(
        db, profile_id, page.skip, page.limit, date_from, date_to, account_id, category
    )
    return [finance_income_to_out(r) for r in rows]


@router.post('/income', response_model=FinanceIncomeOut, status_code=201)
def create_income(
    _: FinanceParticipant,
    body: FinanceIncomeCreate,
    user: CurrentUser,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> FinanceIncomeOut:
    pf_profile_service.assert_can_write(db, user.id, profile_id)
    cat = body.category.strip() or 'general'
    icid = body.income_category_id
    if icid is not None:
        ic = db.get(PfIncomeCategory, icid)
        if ic:
            cat = ic.name
    row = FinanceIncome(
        profile_id=profile_id,
        account_id=body.account_id,
        amount=body.amount,
        category=cat,
        income_type=body.income_type,
        entry_date=body.entry_date,
        description=body.description,
        income_category_id=icid,
        received_from=body.received_from,
        payment_method=body.payment_method,
        receipt_image_url=body.receipt_image_url,
        is_recurring=body.is_recurring,
        recurring_type=body.recurring_type,
    )
    try:
        saved = pf_finance_repo.create_income(db, row)
        return finance_income_to_out(saved)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


@router.patch('/income/{income_id}', response_model=FinanceIncomeOut)
def patch_income(
    income_id: int,
    _: FinanceParticipant,
    body: FinanceIncomeUpdate,
    user: CurrentUser,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> FinanceIncomeOut:
    pf_profile_service.assert_can_write(db, user.id, profile_id)
    row = pf_finance_repo.get_income_for_profile(db, income_id, profile_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Income entry not found')
    patch = body.model_dump(exclude_unset=True)
    if not patch:
        return finance_income_to_out(row)
    try:
        updated = pf_finance_repo.update_income(db, profile_id, row, patch)
        return finance_income_to_out(updated)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


@router.delete('/income/{income_id}', status_code=status.HTTP_204_NO_CONTENT)
def delete_income(
    income_id: int,
    _: FinanceParticipant,
    user: CurrentUser,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> Response:
    pf_profile_service.assert_can_write(db, user.id, profile_id)
    row = pf_finance_repo.get_income_for_profile(db, income_id, profile_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Income entry not found')
    pf_finance_repo.delete_income(db, profile_id, row)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get('/expenses', response_model=list[FinanceExpenseOut])
def list_expenses(
    _: FinanceParticipant,
    db: DbSession,
    profile_id: ActiveProfileId,
    page: Pagination,
    date_from: date_type | None = Query(None),
    date_to: date_type | None = Query(None),
    account_id: int | None = Query(None, ge=1),
    category: str | None = Query(None, max_length=120),
) -> list[FinanceExpenseOut]:
    rows = pf_finance_repo.list_expenses(
        db, profile_id, page.skip, page.limit, date_from, date_to, account_id, category
    )
    return [finance_expense_to_out(r) for r in rows]


@router.post('/expenses', response_model=FinanceExpenseOut, status_code=201)
def create_expense(
    _: FinanceParticipant,
    body: FinanceExpenseCreate,
    user: CurrentUser,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> FinanceExpenseOut:
    pf_profile_service.assert_can_write(db, user.id, profile_id)
    cat = (body.category or 'general').strip() or 'general'
    ecid = body.expense_category_id
    if ecid is not None:
        pc = db.get(PfExpenseCategory, ecid)
        if pc:
            cat = pc.name
    ps = (body.payment_status or 'PAID').strip().upper()
    pm_low = (body.payment_method or '').strip().lower()
    if pm_low == 'credit_card':
        if body.credit_card_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail='credit_card_id is required when payment_method is credit_card',
            )
        if pf_credit_card_repo.get_card_for_profile(db, int(body.credit_card_id), profile_id) is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Credit card not found')
    try:
        acc_id, inst_id = pf_finance_repo.resolve_expense_payment_fields(
            db, profile_id, ps, body.payment_method, body.account_id, body.payment_instrument_id
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    cc_id = int(body.credit_card_id) if pm_low == 'credit_card' and body.credit_card_id is not None else None
    row = FinanceExpense(
        profile_id=profile_id,
        account_id=acc_id,
        amount=body.amount,
        category=cat,
        entry_date=body.entry_date,
        description=body.description,
        expense_category_id=ecid,
        paid_by=body.paid_by,
        payment_method=body.payment_method,
        payment_instrument_id=inst_id,
        credit_card_id=cc_id,
        is_recurring=body.is_recurring,
        recurring_type=body.recurring_type,
        payment_status=ps,
    )
    try:
        saved = pf_finance_repo.create_expense(db, row)
        if pm_low == 'credit_card':
            pf_credit_card_repo.create_transaction_from_expense(db, saved, int(body.credit_card_id))
            saved = pf_finance_repo.get_expense_for_profile(db, saved.id, profile_id) or saved
        return finance_expense_to_out(saved)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


@router.patch('/expenses/{expense_id}', response_model=FinanceExpenseOut)
def patch_expense(
    expense_id: int,
    _: FinanceParticipant,
    body: FinanceExpenseUpdate,
    user: CurrentUser,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> FinanceExpenseOut:
    pf_profile_service.assert_can_write(db, user.id, profile_id)
    row = pf_finance_repo.get_expense_for_profile(db, expense_id, profile_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Expense entry not found')
    patch = body.model_dump(exclude_unset=True)
    if 'payment_status' in patch and patch['payment_status'] is not None:
        patch['payment_status'] = str(patch['payment_status']).strip().upper()
    if not patch:
        return finance_expense_to_out(row)
    if any(
        k in patch
        for k in (
            'payment_method',
            'payment_instrument_id',
            'account_id',
            'payment_status',
            'credit_card_id',
        )
    ):
        merged_ps = patch.get('payment_status', row.payment_status)
        merged_pm = patch.get('payment_method', row.payment_method)
        merged_acc = patch['account_id'] if 'account_id' in patch else row.account_id
        merged_inst = (
            patch['payment_instrument_id']
            if 'payment_instrument_id' in patch
            else row.payment_instrument_id
        )
        try:
            ra, ri = pf_finance_repo.resolve_expense_payment_fields(
                db, profile_id, merged_ps, merged_pm, merged_acc, merged_inst
            )
            patch['account_id'] = ra
            patch['payment_instrument_id'] = ri
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    try:
        updated = pf_finance_repo.update_expense(db, profile_id, row, patch)
        pm_after = (updated.payment_method or '').strip().lower()
        if pm_after == 'credit_card':
            if updated.credit_card_id is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail='credit_card_id is required when payment_method is credit_card',
                )
            pf_credit_card_repo.sync_expense_cc_transaction(
                db, profile_id, updated, int(updated.credit_card_id)
            )
            updated = pf_finance_repo.get_expense_for_profile(db, updated.id, profile_id) or updated
        else:
            pf_credit_card_repo.sync_expense_cc_transaction(db, profile_id, updated, None)
            updated = pf_finance_repo.get_expense_for_profile(db, updated.id, profile_id) or updated
        return finance_expense_to_out(updated)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


@router.delete('/expenses/{expense_id}', status_code=status.HTTP_204_NO_CONTENT)
def delete_expense(
    expense_id: int,
    _: FinanceParticipant,
    user: CurrentUser,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> Response:
    pf_profile_service.assert_can_write(db, user.id, profile_id)
    row = pf_finance_repo.get_expense_for_profile(db, expense_id, profile_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Expense entry not found')
    try:
        pf_finance_repo.delete_expense(db, profile_id, row)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get('/investments', response_model=list[FinanceInvestmentOut])
def list_investments(
    _: FinanceParticipant,
    db: DbSession,
    profile_id: ActiveProfileId,
    page: Pagination,
) -> list[FinanceInvestment]:
    return pf_finance_repo.list_investments(db, profile_id, page.skip, page.limit)


@router.get('/investments/monthly-flow', response_model=list[InvestmentMonthlyFlowRow])
def investment_monthly_flow(
    _: FinanceParticipant,
    db: DbSession,
    profile_id: ActiveProfileId,
    year: int = Query(..., ge=2000, le=2100),
) -> list[InvestmentMonthlyFlowRow]:
    raw = pf_finance_repo.investment_monthly_purchase_flow(db, profile_id, year)
    by_m = {int(r['month']): r['invested'] for r in raw}
    out: list[InvestmentMonthlyFlowRow] = []
    for m in range(1, 13):
        label = date_type(year, m, 1).strftime('%b %Y')
        out.append(
            InvestmentMonthlyFlowRow(
                month=m,
                month_label=label,
                invested=Decimal(str(by_m.get(m, 0.0))),
            )
        )
    return out


@router.post('/investments', response_model=FinanceInvestmentOut, status_code=201)
def create_investment(
    _: FinanceParticipant,
    body: FinanceInvestmentCreate,
    user: CurrentUser,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> FinanceInvestment:
    pf_profile_service.assert_can_write(db, user.id, profile_id)
    sf = (body.sip_frequency or 'MONTHLY').strip().upper()[:24] or 'MONTHLY'
    row = FinanceInvestment(
        profile_id=profile_id,
        investment_type=body.investment_type,
        name=body.name,
        invested_amount=body.invested_amount,
        current_value=body.current_value,
        sip_monthly_amount=body.sip_monthly_amount,
        sip_start_date=body.sip_start_date,
        sip_day_of_month=body.sip_day_of_month,
        sip_frequency=sf,
        sip_auto_create=body.sip_auto_create,
        investment_date=body.investment_date,
        platform=(body.platform.strip() or None) if body.platform is not None else None,
        notes=(body.notes.strip() or None) if body.notes is not None else None,
    )
    inv = pf_finance_repo.create_investment(db, row)
    pf_finance_repo.seed_investment_opening_transaction_if_missing(db, inv)
    inv2 = pf_finance_repo.get_investment_for_profile(db, inv.id, profile_id)
    assert inv2 is not None
    return pf_investment_ledger_service.recompute_investment_aggregates(db, inv2)


@router.get('/investments/{investment_id}/ledger', response_model=FinanceInvestmentLedgerOut)
def get_investment_ledger(
    investment_id: int,
    _: FinanceParticipant,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> FinanceInvestmentLedgerOut:
    out = pf_investment_ledger_service.build_ledger_out(db, investment_id, profile_id)
    if out is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Investment not found')
    return out


@router.post(
    '/investments/{investment_id}/transactions',
    response_model=FinanceInvestmentTransactionOut,
    status_code=status.HTTP_201_CREATED,
)
def create_investment_transaction(
    investment_id: int,
    _: FinanceParticipant,
    body: FinanceInvestmentTransactionCreate,
    user: CurrentUser,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> FinanceInvestmentTransaction:
    pf_profile_service.assert_can_write(db, user.id, profile_id)
    inv = pf_finance_repo.get_investment_for_profile(db, investment_id, profile_id)
    if inv is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Investment not found')
    row = pf_investment_ledger_service.add_transaction(db, inv, body)
    return row


@router.delete(
    '/investments/{investment_id}/transactions/{transaction_id}',
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_investment_transaction(
    investment_id: int,
    transaction_id: int,
    _: FinanceParticipant,
    user: CurrentUser,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> Response:
    pf_profile_service.assert_can_write(db, user.id, profile_id)
    inv = pf_finance_repo.get_investment_for_profile(db, investment_id, profile_id)
    if inv is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Investment not found')
    txn = pf_finance_repo.get_investment_transaction_for_profile(
        db, transaction_id, investment_id, profile_id
    )
    if txn is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Transaction not found')
    pf_investment_ledger_service.delete_transaction_and_recompute(db, inv, txn)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put('/investments/{investment_id}', response_model=FinanceInvestmentOut)
def update_investment(
    investment_id: int,
    _: FinanceParticipant,
    body: FinanceInvestmentUpdate,
    user: CurrentUser,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> FinanceInvestment:
    pf_profile_service.assert_can_write(db, user.id, profile_id)
    row = pf_finance_repo.get_investment_for_profile(db, investment_id, profile_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Investment not found')
    txn_count = pf_finance_repo.count_investment_transactions(db, investment_id)
    sf = (body.sip_frequency or 'MONTHLY').strip().upper()[:24] or 'MONTHLY'
    row.investment_type = body.investment_type
    row.name = body.name
    row.sip_monthly_amount = body.sip_monthly_amount
    row.sip_start_date = body.sip_start_date
    row.sip_day_of_month = body.sip_day_of_month
    row.sip_frequency = sf
    row.sip_auto_create = body.sip_auto_create
    row.platform = (body.platform.strip() or None) if body.platform is not None else None
    row.notes = (body.notes.strip() or None) if body.notes is not None else None
    if txn_count == 0:
        row.invested_amount = body.invested_amount
        row.current_value = body.current_value
        row.investment_date = body.investment_date
    pf_finance_repo.update_investment(db, row)
    row2 = pf_finance_repo.get_investment_for_profile(db, investment_id, profile_id)
    assert row2 is not None
    if pf_finance_repo.count_investment_transactions(db, investment_id) > 0:
        return pf_investment_ledger_service.recompute_investment_aggregates(db, row2)
    return row2


@router.delete('/investments/{investment_id}', status_code=status.HTTP_204_NO_CONTENT)
def delete_investment(
    investment_id: int,
    _: FinanceParticipant,
    user: CurrentUser,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> Response:
    pf_profile_service.assert_can_write(db, user.id, profile_id)
    row = pf_finance_repo.get_investment_for_profile(db, investment_id, profile_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Investment not found')
    pf_finance_repo.delete_investment(db, row)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get('/assets/summary', response_model=AssetsPageSummaryOut)
def assets_summary(
    _: FinanceParticipant,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> AssetsPageSummaryOut:
    return pf_asset_ui_service.assets_page_summary(db, profile_id)


@router.get('/assets', response_model=list[FinanceAssetOut])
def list_assets(
    _: FinanceParticipant,
    db: DbSession,
    profile_id: ActiveProfileId,
    asset_type: str | None = Query(None),
    location: str | None = Query(None, description='Filter by location (substring match)'),
    search: str | None = Query(None, description='Search asset name'),
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=2000),
) -> list[FinanceAssetOut]:
    at = asset_type.strip().upper() if asset_type else None
    if at in ('ALL', ''):
        at = None
    return pf_asset_ui_service.list_enriched_assets(
        db,
        profile_id,
        skip,
        limit,
        asset_type=at,
        location_q=location,
        search=search,
    )


@router.get('/assets/{asset_id}', response_model=FinanceAssetOut)
def get_asset(
    _: FinanceParticipant,
    db: DbSession,
    profile_id: ActiveProfileId,
    asset_id: int,
) -> FinanceAssetOut:
    out = pf_asset_ui_service.get_enriched_asset(db, profile_id, asset_id)
    if out is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Asset not found')
    return out


@router.post('/assets', response_model=FinanceAssetOut, status_code=201)
def create_asset(
    _: FinanceParticipant,
    body: FinanceAssetCreate,
    user: CurrentUser,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> FinanceAssetOut:
    pf_profile_service.assert_can_write(db, user.id, profile_id)
    if body.linked_liability_id is not None:
        _liability_for_profile(db, body.linked_liability_id, profile_id)
    row = FinanceAsset(
        profile_id=profile_id,
        asset_name=body.asset_name,
        asset_type=body.asset_type,
        purchase_value=body.purchase_value,
        current_value=body.current_value if body.current_value is not None else body.purchase_value,
        purchase_date=body.purchase_date,
        depreciation_rate=body.depreciation_rate,
        location=(body.location or '').strip() or None,
        linked_liability_id=body.linked_liability_id,
        notes=body.notes,
    )
    pf_finance_repo.create_asset(db, row)
    out = pf_asset_ui_service.get_enriched_asset(db, profile_id, row.id)
    assert out is not None
    return out


@router.patch('/assets/{asset_id}', response_model=FinanceAssetOut)
def patch_asset(
    _: FinanceParticipant,
    asset_id: int,
    body: FinanceAssetUpdate,
    user: CurrentUser,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> FinanceAssetOut:
    pf_profile_service.assert_can_write(db, user.id, profile_id)
    row = pf_finance_repo.get_asset_for_profile(db, asset_id, profile_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Asset not found')
    data = body.model_dump(exclude_unset=True)
    if 'linked_liability_id' in data and data['linked_liability_id'] is not None:
        _liability_for_profile(db, int(data['linked_liability_id']), profile_id)
    if 'location' in data and data['location'] is not None:
        data['location'] = str(data['location']).strip() or None
    pf_finance_repo.update_asset(db, row, data)
    out = pf_asset_ui_service.get_enriched_asset(db, profile_id, asset_id)
    assert out is not None
    return out


@router.delete('/assets/{asset_id}', status_code=status.HTTP_204_NO_CONTENT)
def delete_asset(
    _: FinanceParticipant,
    asset_id: int,
    user: CurrentUser,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> Response:
    pf_profile_service.assert_can_write(db, user.id, profile_id)
    row = pf_finance_repo.get_asset_for_profile(db, asset_id, profile_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Asset not found')
    pf_finance_repo.delete_asset(db, row)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get('/liabilities/summary', response_model=LiabilitiesPageSummaryOut)
def liabilities_summary(
    _: FinanceParticipant,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> LiabilitiesPageSummaryOut:
    return pf_liability_ui_service.liabilities_page_summary(db, profile_id)


@router.get('/liabilities', response_model=list[FinanceLiabilityOut])
def list_liabilities(
    _: FinanceParticipant,
    db: DbSession,
    profile_id: ActiveProfileId,
    liability_type: str | None = Query(None),
    status: str | None = Query(None, description='ACTIVE | CLOSED | OVERDUE | PAID | ALL'),
    due_this_month: bool | None = Query(None),
    search: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(500, ge=1, le=2000),
) -> list[FinanceLiabilityOut]:
    lt = liability_type.strip().upper() if liability_type else None
    if lt in ('ALL', ''):
        lt = None
    st = status.strip().upper() if status else None
    if st in ('ALL', ''):
        st = None
    return pf_liability_ui_service.list_enriched_liabilities(
        db,
        profile_id,
        skip=skip,
        limit=limit,
        liability_type=lt,
        status_filter=st,
        due_this_month=due_this_month,
        search=search,
    )


@router.get('/liabilities/pending-emi', response_model=list[LiabilityPendingEmiOut])
def list_pending_liability_emis_api(
    _: FinanceParticipant,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> list[LiabilityPendingEmiOut]:
    rows = pf_finance_repo.list_pending_liability_emis(db, profile_id)
    return [
        LiabilityPendingEmiOut(
            schedule_id=r['schedule_id'],
            liability_id=r['liability_id'],
            liability_name=r['liability_name'],
            emi_number=r['emi_number'],
            due_date=r['due_date'],
            emi_amount=Decimal(str(round(r['emi_amount'], 2))),
        )
        for r in rows
    ]


@router.post('/liabilities', response_model=FinanceLiabilityOut, status_code=201)
@router.post('/liabilities/add', response_model=FinanceLiabilityOut, status_code=201)
def create_liability(
    _: FinanceParticipant,
    body: FinanceLiabilityCreate,
    user: CurrentUser,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> FinanceLiabilityOut:
    pf_profile_service.assert_can_write(db, user.id, profile_id)
    ost = float(body.outstanding_amount if body.outstanding_amount is not None else body.total_amount)
    row = FinanceLiability(
        profile_id=profile_id,
        liability_name=body.liability_name.strip(),
        liability_type=body.liability_type,
        total_amount=body.total_amount,
        outstanding_amount=ost,
        interest_rate=body.interest_rate,
        minimum_due=body.minimum_due,
        installment_amount=None if body.build_emi_schedule else body.installment_amount,
        due_date=None if body.build_emi_schedule else body.due_date,
        billing_cycle_day=body.billing_cycle_day,
        lender_name=(body.lender_name.strip() or None) if body.lender_name else None,
        notes=(body.notes.strip() or None) if body.notes else None,
        status=(body.status or 'ACTIVE').strip().upper(),
    )
    if body.build_emi_schedule:
        row = pf_finance_repo.create_liability_with_emi_schedule(
            db,
            row,
            term_months=int(body.term_months or 0),
            emi_start_date=body.emi_schedule_start_date,  # required when build_emi_schedule (validator)
            emi_interest_method=pf_loan_ui_service.normalize_emi_interest_method(body.emi_interest_method),
            interest_free_days=body.interest_free_days,
        )
    else:
        row = pf_finance_repo.create_liability(db, row)
    return pf_liability_ui_service.enrich_liability(db, row)


@router.patch('/liabilities/{liability_id}', response_model=FinanceLiabilityOut)
def patch_liability(
    liability_id: int,
    _: FinanceParticipant,
    body: FinanceLiabilityUpdate,
    user: CurrentUser,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> FinanceLiabilityOut:
    pf_profile_service.assert_can_write(db, user.id, profile_id)
    ln = _liability_for_profile(db, liability_id, profile_id)
    patch = body.model_dump(exclude_unset=True)
    if 'liability_name' in patch and patch['liability_name'] is not None:
        ln.liability_name = str(patch['liability_name']).strip()
    if 'liability_type' in patch:
        ln.liability_type = patch['liability_type']
    if 'total_amount' in patch and patch['total_amount'] is not None:
        ln.total_amount = float(patch['total_amount'])
    if 'outstanding_amount' in patch and patch['outstanding_amount'] is not None:
        ln.outstanding_amount = float(patch['outstanding_amount'])
    if 'interest_rate' in patch:
        ln.interest_rate = patch['interest_rate']
    if 'minimum_due' in patch:
        ln.minimum_due = patch['minimum_due']
    if 'installment_amount' in patch:
        ln.installment_amount = patch['installment_amount']
    if 'due_date' in patch:
        ln.due_date = patch['due_date']
    if 'billing_cycle_day' in patch:
        ln.billing_cycle_day = patch['billing_cycle_day']
    if 'lender_name' in patch:
        v = patch['lender_name']
        ln.lender_name = None if v is None else (str(v).strip() or None)
    if 'notes' in patch:
        v = patch['notes']
        ln.notes = None if v is None else (str(v).strip() or None)
    if 'status' in patch and patch['status'] is not None:
        ln.status = str(patch['status']).strip().upper()
    ln = pf_finance_repo.update_liability_row(db, ln)
    return pf_liability_ui_service.enrich_liability(db, ln)


@router.delete('/liabilities/{liability_id}', status_code=status.HTTP_204_NO_CONTENT)
def delete_liability(
    liability_id: int,
    _: FinanceParticipant,
    user: CurrentUser,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> Response:
    pf_profile_service.assert_can_write(db, user.id, profile_id)
    try:
        pf_finance_repo.delete_liability_for_profile(db, profile_id, liability_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get('/liabilities/{liability_id}', response_model=FinanceLiabilityOut)
def get_liability(
    liability_id: int,
    _: FinanceParticipant,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> FinanceLiabilityOut:
    ln = _liability_for_profile(db, liability_id, profile_id)
    return pf_liability_ui_service.enrich_liability(db, ln)


@router.get('/liabilities/{liability_id}/schedule', response_model=list[LiabilityScheduleOut])
def get_liability_schedule(
    _: FinanceParticipant,
    liability_id: int,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> list[LiabilityScheduleOut]:
    _liability_for_profile(db, liability_id, profile_id)
    return pf_finance_repo.list_liability_schedule(db, liability_id)


@router.patch('/liabilities/{liability_id}/schedule/{emi_number}/credit', response_model=LiabilityScheduleOut)
def patch_liability_schedule_credit(
    _: FinanceParticipant,
    liability_id: int,
    emi_number: int,
    body: LoanScheduleCreditUpdate,
    user: CurrentUser,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> LiabilityScheduleOut:
    pf_profile_service.assert_can_write(db, user.id, profile_id)
    _liability_for_profile(db, liability_id, profile_id)
    try:
        return pf_finance_repo.patch_liability_schedule_credit(
            db,
            profile_id,
            liability_id,
            emi_number,
            credit_as_cash=body.credit_as_cash,
            finance_account_id=body.finance_account_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


@router.post('/liabilities/{liability_id}/emi/{emi_number}/pay', response_model=LiabilityScheduleOut)
def pay_liability_emi(
    _: FinanceParticipant,
    liability_id: int,
    emi_number: int,
    user: CurrentUser,
    db: DbSession,
    profile_id: ActiveProfileId,
    payment_date: date_type | None = Query(default=None, description='Defaults to today if omitted.'),
    finance_account_id: int | None = Query(
        default=None,
        description='Bank account debited (optional; uses EMI row assignment if omitted).',
    ),
) -> LiabilityScheduleOut:
    pf_profile_service.assert_can_write(db, user.id, profile_id)
    _liability_for_profile(db, liability_id, profile_id)
    try:
        return pf_finance_repo.mark_liability_emi_paid(
            db,
            profile_id,
            liability_id,
            emi_number,
            payment_date,
            finance_account_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


@router.post('/liabilities/emi/pay', response_model=LiabilityScheduleOut)
@router.post('/liabilities/emis/pay', response_model=LiabilityScheduleOut)
def pay_liability_emi_json(
    _: FinanceParticipant,
    body: LiabilityEmiPayBody,
    user: CurrentUser,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> LiabilityScheduleOut:
    pf_profile_service.assert_can_write(db, user.id, profile_id)
    _liability_for_profile(db, body.liability_id, profile_id)
    try:
        return pf_finance_repo.mark_liability_emi_paid(
            db,
            profile_id,
            body.liability_id,
            body.emi_number,
            body.payment_date,
            body.finance_account_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


@router.get('/liabilities/{liability_id}/payments', response_model=list[LiabilityPaymentOut])
def list_liability_payments_api(
    _: FinanceParticipant,
    liability_id: int,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> list[LiabilityPaymentOut]:
    _liability_for_profile(db, liability_id, profile_id)
    return pf_finance_repo.list_liability_payments(db, liability_id)


@router.post('/liabilities/{liability_id}/payments', response_model=LiabilityPaymentOut, status_code=201)
def create_liability_payment_api(
    liability_id: int,
    _: FinanceParticipant,
    body: LiabilityPaymentCreate,
    user: CurrentUser,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> LiabilityPaymentOut:
    pf_profile_service.assert_can_write(db, user.id, profile_id)
    _liability_for_profile(db, liability_id, profile_id)
    try:
        return pf_finance_repo.record_liability_payment(
            db,
            profile_id,
            liability_id,
            payment_date=body.payment_date,
            amount_paid=body.amount_paid,
            interest_paid=body.interest_paid,
            payment_mode=body.payment_mode,
            finance_account_id=body.finance_account_id,
            notes=body.notes,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


@router.post('/liabilities/{liability_id}/close', response_model=FinanceLiabilityOut)
def close_liability_api(
    liability_id: int,
    _: FinanceParticipant,
    user: CurrentUser,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> FinanceLiabilityOut:
    pf_profile_service.assert_can_write(db, user.id, profile_id)
    _liability_for_profile(db, liability_id, profile_id)
    try:
        row = pf_finance_repo.close_liability_if_zero(db, profile_id, liability_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    return pf_liability_ui_service.enrich_liability(db, row)


@router.post('/liabilities/{liability_id}/add-amount', response_model=FinanceLiabilityOut)
def add_liability_principal_amount(
    liability_id: int,
    body: LiabilityAddPrincipalBody,
    _: FinanceParticipant,
    user: CurrentUser,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> FinanceLiabilityOut:
    pf_profile_service.assert_can_write(db, user.id, profile_id)
    _liability_for_profile(db, liability_id, profile_id)
    try:
        row = pf_finance_repo.add_liability_principal_draw(
            db,
            profile_id,
            liability_id,
            disbursement_date=body.disbursement_date,
            amount=body.amount,
            finance_account_id=body.finance_account_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    return pf_liability_ui_service.enrich_liability(db, row)


@router.get('/loans', response_model=list[LoanOut])
@router.get('/loans/list', response_model=list[LoanOut])
def list_loans(
    _: FinanceParticipant,
    db: DbSession,
    profile_id: ActiveProfileId,
    loan_type: str | None = Query(
        None,
        description='EMI | INTEREST_FREE | SIMPLE_INTEREST (omit or ALL for any)',
    ),
    status: str | None = Query(
        None,
        description='ACTIVE | CLOSED | OVERDUE | COMPLETED | ALL',
    ),
    search: str | None = Query(None, description='Borrower name contains (case-insensitive)'),
) -> list[LoanOut]:
    lt = loan_type.strip().upper() if loan_type else None
    if lt in ('ALL', ''):
        lt = None
    st = status.strip().upper() if status else None
    if st in ('ALL', ''):
        st = None
    return pf_loan_ui_service.list_enriched_loans(
        db,
        profile_id,
        loan_type=lt,
        status=st,
        search=search,
    )


@router.get('/loans/summary', response_model=LoansPageSummaryOut)
def loans_page_summary(
    _: FinanceParticipant,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> LoansPageSummaryOut:
    return pf_loan_ui_service.loans_page_summary(db, profile_id)


@router.get('/loans/pending-emi', response_model=list[LoanPendingEmiOut])
def list_pending_loan_emis(
    _: FinanceParticipant,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> list[LoanPendingEmiOut]:
    rows = pf_finance_repo.list_pending_loan_emis(db, profile_id)
    return [
        LoanPendingEmiOut(
            schedule_id=r['schedule_id'],
            loan_id=r['loan_id'],
            borrower_name=r['borrower_name'],
            emi_number=r['emi_number'],
            due_date=r['due_date'],
            emi_amount=Decimal(str(round(r['emi_amount'], 2))),
            emi_settlement=r['emi_settlement'],
        )
        for r in rows
    ]


@router.post('/loans', response_model=LoanOut, status_code=201)
@router.post('/loans/add', response_model=LoanOut, status_code=201)
def create_loan(
    _: FinanceParticipant,
    body: LoanCreate,
    user: CurrentUser,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> LoanOut:
    pf_profile_service.assert_can_write(db, user.id, profile_id)
    row = Loan(
        profile_id=profile_id,
        borrower_name=body.borrower_name,
        loan_type=pf_loan_ui_service.loan_kind_to_type(body.loan_kind),
        borrower_phone=(body.borrower_phone.strip() or None) if body.borrower_phone else None,
        borrower_address=(body.borrower_address.strip() or None) if body.borrower_address else None,
        notes=(body.notes.strip() or None) if body.notes else None,
        loan_amount=body.loan_amount,
        interest_rate=body.interest_rate,
        interest_free_days=body.interest_free_days,
        start_date=body.start_date,
        end_date=body.end_date,
        status=body.status,
        emi_interest_method=pf_loan_ui_service.normalize_emi_interest_method(body.emi_interest_method),
        emi_settlement=pf_loan_ui_service.normalize_emi_settlement(body.emi_settlement),
    )
    row = pf_finance_repo.create_loan_with_schedule_options(
        db,
        row,
        term_months=body.term_months,
        commission_percent=body.commission_percent,
        loan_kind=body.loan_kind,
        emi_interest_method=row.emi_interest_method,
    )
    return _loan_out_fresh(db, profile_id, row)


@router.patch('/loans/{loan_id}', response_model=LoanOut)
def patch_loan(
    loan_id: int,
    _: FinanceParticipant,
    body: LoanPatch,
    user: CurrentUser,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> LoanOut:
    pf_profile_service.assert_can_write(db, user.id, profile_id)
    ln = _loan_for_profile(db, loan_id, profile_id)
    patch = body.model_dump(exclude_unset=True)
    if 'borrower_phone' in patch:
        v = patch['borrower_phone']
        ln.borrower_phone = None if v is None else (str(v).strip() or None)
    if 'borrower_address' in patch:
        v = patch['borrower_address']
        ln.borrower_address = None if v is None else (str(v).strip() or None)
    if 'notes' in patch:
        v = patch['notes']
        ln.notes = None if v is None else (str(v).strip() or None)
    db.commit()
    db.refresh(ln)
    return _loan_out_fresh(db, profile_id, ln)


@router.delete('/loans/{loan_id}', status_code=status.HTTP_204_NO_CONTENT)
def delete_loan(
    loan_id: int,
    _: FinanceParticipant,
    user: CurrentUser,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> Response:
    pf_profile_service.assert_can_write(db, user.id, profile_id)
    try:
        pf_finance_repo.delete_loan_for_profile(db, profile_id, loan_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get('/loans/{loan_id}/schedule', response_model=list[LoanScheduleOut])
def get_loan_schedule(
    _: FinanceParticipant,
    loan_id: int,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> list:
    _loan_for_profile(db, loan_id, profile_id)
    return pf_finance_repo.list_loan_schedule(db, loan_id)


@router.patch('/loans/{loan_id}/schedule/{emi_number}/credit', response_model=LoanScheduleOut)
def patch_loan_schedule_credit(
    _: FinanceParticipant,
    loan_id: int,
    emi_number: int,
    body: LoanScheduleCreditUpdate,
    user: CurrentUser,
    db: DbSession,
    profile_id: ActiveProfileId,
):
    pf_profile_service.assert_can_write(db, user.id, profile_id)
    _loan_for_profile(db, loan_id, profile_id)
    try:
        return pf_finance_repo.patch_loan_schedule_credit(
            db,
            profile_id,
            loan_id,
            emi_number,
            credit_as_cash=body.credit_as_cash,
            finance_account_id=body.finance_account_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


@router.post('/loans/{loan_id}/emi/{emi_number}/pay', response_model=LoanScheduleOut)
def pay_loan_emi(
    _: FinanceParticipant,
    loan_id: int,
    emi_number: int,
    user: CurrentUser,
    db: DbSession,
    profile_id: ActiveProfileId,
    payment_date: date_type | None = Query(
        default=None,
        description='Defaults to today if omitted.',
    ),
    finance_account_id: int | None = Query(
        default=None,
        description='Bank to credit (optional; uses EMI row assignment if omitted).',
    ),
):
    pf_profile_service.assert_can_write(db, user.id, profile_id)
    _loan_for_profile(db, loan_id, profile_id)
    try:
        return pf_finance_repo.mark_emi_paid(
            db,
            profile_id,
            loan_id,
            emi_number,
            payment_date,
            finance_account_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


@router.post('/loans/emi/pay', response_model=LoanScheduleOut)
@router.post('/loans/emis/pay', response_model=LoanScheduleOut)
def pay_loan_emi_json(
    _: FinanceParticipant,
    body: LoanEmiPayBody,
    user: CurrentUser,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> LoanScheduleOut:
    pf_profile_service.assert_can_write(db, user.id, profile_id)
    _loan_for_profile(db, body.loan_id, profile_id)
    try:
        return pf_finance_repo.mark_emi_paid(
            db,
            profile_id,
            body.loan_id,
            body.emi_number,
            body.payment_date,
            body.finance_account_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


@router.post('/loans/{loan_id}/add-amount', response_model=LoanOut)
def add_loan_principal_amount(
    loan_id: int,
    body: LoanAddPrincipalBody,
    _: FinanceParticipant,
    user: CurrentUser,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> LoanOut:
    pf_profile_service.assert_can_write(db, user.id, profile_id)
    _loan_for_profile(db, loan_id, profile_id)
    try:
        row = pf_finance_repo.add_loan_principal_disbursement(
            db,
            profile_id,
            loan_id,
            disbursement_date=body.disbursement_date,
            amount=body.amount,
            finance_account_id=body.finance_account_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    return _loan_out_fresh(db, profile_id, row)


@router.post('/loans/{loan_id}/close', response_model=LoanOut)
def close_loan(
    loan_id: int,
    _: FinanceParticipant,
    user: CurrentUser,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> LoanOut:
    pf_profile_service.assert_can_write(db, user.id, profile_id)
    _loan_for_profile(db, loan_id, profile_id)
    try:
        row = pf_finance_repo.close_loan_if_settled(db, profile_id, loan_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    return _loan_out_fresh(db, profile_id, row)


@router.get('/loans/{loan_id}/payments', response_model=list[LoanPaymentOut])
def list_loan_payments(
    _: FinanceParticipant,
    loan_id: int,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> list[LoanPayment]:
    _loan_for_profile(db, loan_id, profile_id)
    return pf_finance_repo.list_loan_payments(db, loan_id)


@router.post('/loans/{loan_id}/payments', response_model=LoanPaymentOut, status_code=201)
def create_loan_payment(
    _: FinanceParticipant,
    loan_id: int,
    body: LoanPaymentCreate,
    user: CurrentUser,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> LoanPayment:
    pf_profile_service.assert_can_write(db, user.id, profile_id)
    _loan_for_profile(db, loan_id, profile_id)
    total = float(body.total_paid)
    ip = 0.0 if body.interest_paid is None else float(body.interest_paid)
    pp = float(total - ip) if body.principal_paid is None else float(body.principal_paid)
    if ip < 0 or pp < 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Invalid principal or interest')
    try:
        return pf_finance_repo.record_manual_loan_payment(
            db,
            profile_id,
            loan_id,
            payment_date=body.payment_date,
            total_paid=total,
            principal_paid=pp,
            interest_paid=ip,
            credit_as_cash=body.credit_as_cash,
            finance_account_id=body.finance_account_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
