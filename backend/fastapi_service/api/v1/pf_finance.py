from datetime import date as date_type
from decimal import Decimal

from fastapi import APIRouter, HTTPException, Query, Response, status

from fastapi_service.core.dependencies import ActiveProfileId, CurrentUser, DbSession, Pagination
from fastapi_service.models_extended import (
    FinanceAccount,
    FinanceAsset,
    FinanceExpense,
    FinanceIncome,
    FinanceInvestment,
    FinanceLiability,
    Loan,
    LoanPayment,
    PfExpenseCategory,
    PfIncomeCategory,
    PfPaymentInstrument,
)
from fastapi_service.repositories import pf_finance_repo
from fastapi_service.schemas_extended import (
    FinanceAccountBalanceUpdate,
    FinanceAccountCreate,
    FinanceAccountOut,
    FinanceAssetCreate,
    FinanceAssetOut,
    FinanceExpenseCreate,
    FinanceExpenseOut,
    FinanceExpenseUpdate,
    FinanceIncomeCreate,
    FinanceIncomeOut,
    FinanceIncomeUpdate,
    FinanceInvestmentCreate,
    FinanceInvestmentOut,
    FinanceLiabilityCreate,
    FinanceLiabilityOut,
    LoanAddPrincipalBody,
    LoanCreate,
    LoanOut,
    LoanPaymentCreate,
    LoanPaymentOut,
    LoanScheduleCreditUpdate,
    LoanScheduleOut,
    PfMasterCategoryOut,
    PfPaymentInstrumentCreate,
    PfPaymentInstrumentOut,
    finance_expense_to_out,
    finance_income_to_out,
)
from fastapi_service.services import pf_profile_service
from fastapi_service.services.rbac_service import FinanceParticipant

router = APIRouter()


def _loan_for_profile(db, loan_id: int, profile_id: int) -> Loan:
    ln = db.get(Loan, loan_id)
    if ln is None or ln.profile_id != profile_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Loan not found')
    return ln


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
    )
    return pf_finance_repo.create_account(db, row)


@router.patch('/accounts/{account_id}', response_model=FinanceAccountOut)
def patch_account_balance(
    account_id: int,
    _: FinanceParticipant,
    body: FinanceAccountBalanceUpdate,
    user: CurrentUser,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> FinanceAccount:
    pf_profile_service.assert_can_write(db, user.id, profile_id)
    row = pf_finance_repo.get_account_for_profile(db, account_id, profile_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Account not found')
    return pf_finance_repo.update_account_balance(db, row, body.balance)


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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e
    return Response(status_code=status.HTTP_204_NO_CONTENT)


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
) -> list[FinanceIncomeOut]:
    rows = pf_finance_repo.list_income(db, profile_id, page.skip, page.limit, None, None)
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
) -> list[FinanceExpenseOut]:
    rows = pf_finance_repo.list_expenses(db, profile_id, page.skip, page.limit, None, None)
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
    try:
        acc_id, inst_id = pf_finance_repo.resolve_expense_payment_fields(
            db, profile_id, ps, body.payment_method, body.account_id, body.payment_instrument_id
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
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
        is_recurring=body.is_recurring,
        recurring_type=body.recurring_type,
        payment_status=ps,
    )
    try:
        saved = pf_finance_repo.create_expense(db, row)
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
        k in patch for k in ('payment_method', 'payment_instrument_id', 'account_id', 'payment_status')
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
    pf_finance_repo.delete_expense(db, profile_id, row)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get('/investments', response_model=list[FinanceInvestmentOut])
def list_investments(
    _: FinanceParticipant,
    db: DbSession,
    profile_id: ActiveProfileId,
    page: Pagination,
) -> list[FinanceInvestment]:
    return pf_finance_repo.list_investments(db, profile_id, page.skip, page.limit)


@router.post('/investments', response_model=FinanceInvestmentOut, status_code=201)
def create_investment(
    _: FinanceParticipant,
    body: FinanceInvestmentCreate,
    user: CurrentUser,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> FinanceInvestment:
    pf_profile_service.assert_can_write(db, user.id, profile_id)
    row = FinanceInvestment(
        profile_id=profile_id,
        investment_type=body.investment_type,
        invested_amount=body.invested_amount,
        current_value=body.current_value,
        platform=body.platform,
        as_of_date=body.as_of_date,
    )
    return pf_finance_repo.create_investment(db, row)


@router.get('/assets', response_model=list[FinanceAssetOut])
def list_assets(
    _: FinanceParticipant,
    db: DbSession,
    profile_id: ActiveProfileId,
    page: Pagination,
) -> list[FinanceAsset]:
    return pf_finance_repo.list_assets(db, profile_id, page.skip, page.limit)


@router.post('/assets', response_model=FinanceAssetOut, status_code=201)
def create_asset(
    _: FinanceParticipant,
    body: FinanceAssetCreate,
    user: CurrentUser,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> FinanceAsset:
    pf_profile_service.assert_can_write(db, user.id, profile_id)
    row = FinanceAsset(
        profile_id=profile_id,
        asset_name=body.asset_name,
        asset_type=body.asset_type,
        value=body.value,
    )
    return pf_finance_repo.create_asset(db, row)


@router.get('/liabilities', response_model=list[FinanceLiabilityOut])
def list_liabilities(
    _: FinanceParticipant,
    db: DbSession,
    profile_id: ActiveProfileId,
    page: Pagination,
) -> list[FinanceLiability]:
    return pf_finance_repo.list_liabilities(db, profile_id, page.skip, page.limit)


@router.post('/liabilities', response_model=FinanceLiabilityOut, status_code=201)
def create_liability(
    _: FinanceParticipant,
    body: FinanceLiabilityCreate,
    user: CurrentUser,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> FinanceLiability:
    pf_profile_service.assert_can_write(db, user.id, profile_id)
    row = FinanceLiability(
        profile_id=profile_id,
        liability_name=body.liability_name,
        liability_type=body.liability_type,
        amount=body.amount,
        interest_rate=body.interest_rate,
        due_date=body.due_date,
    )
    return pf_finance_repo.create_liability(db, row)


@router.get('/loans', response_model=list[LoanOut])
def list_loans(
    _: FinanceParticipant,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> list[LoanOut]:
    rows = pf_finance_repo.list_loans(db, profile_id)
    ids = [r.id for r in rows]
    with_schedule = pf_finance_repo.loan_ids_with_emi_schedule(db, ids)
    next_emi = pf_finance_repo.next_pending_emi_by_loan(db, profile_id)
    out: list[LoanOut] = []
    for r in rows:
        base = LoanOut.model_validate(r, from_attributes=True)
        ne = next_emi.get(r.id)
        extra: dict = {'has_emi_schedule': r.id in with_schedule}
        if ne:
            d, amt = ne
            extra['next_emi_due'] = d
            extra['next_emi_amount'] = Decimal(str(amt))
        out.append(base.model_copy(update=extra))
    return out


@router.post('/loans', response_model=LoanOut, status_code=201)
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
        loan_amount=body.loan_amount,
        interest_rate=body.interest_rate,
        interest_free_days=body.interest_free_days,
        start_date=body.start_date,
        end_date=body.end_date,
        status=body.status,
    )
    row = pf_finance_repo.create_loan_with_schedule_options(
        db,
        row,
        term_months=body.term_months,
        commission_percent=body.commission_percent,
    )
    has_s = pf_finance_repo.loan_has_emi_schedule(db, row.id)
    return LoanOut.model_validate(row, from_attributes=True).model_copy(update={'has_emi_schedule': has_s})


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
    has_s = pf_finance_repo.loan_has_emi_schedule(db, row.id)
    return LoanOut.model_validate(row, from_attributes=True).model_copy(update={'has_emi_schedule': has_s})


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
    has_s = pf_finance_repo.loan_has_emi_schedule(db, row.id)
    return LoanOut.model_validate(row, from_attributes=True).model_copy(update={'has_emi_schedule': has_s})


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
