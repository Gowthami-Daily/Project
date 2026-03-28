from fastapi import APIRouter, HTTPException, status

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
)
from fastapi_service.repositories import pf_finance_repo
from fastapi_service.schemas_extended import (
    FinanceAccountCreate,
    FinanceAccountOut,
    FinanceAssetCreate,
    FinanceAssetOut,
    FinanceExpenseCreate,
    FinanceExpenseOut,
    FinanceIncomeCreate,
    FinanceIncomeOut,
    FinanceInvestmentCreate,
    FinanceInvestmentOut,
    FinanceLiabilityCreate,
    FinanceLiabilityOut,
    LoanCreate,
    LoanOut,
    LoanPaymentCreate,
    LoanPaymentOut,
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


@router.get('/income', response_model=list[FinanceIncomeOut])
def list_income(
    _: FinanceParticipant,
    db: DbSession,
    profile_id: ActiveProfileId,
    page: Pagination,
) -> list[FinanceIncome]:
    return pf_finance_repo.list_income(db, profile_id, page.skip, page.limit, None, None)


@router.post('/income', response_model=FinanceIncomeOut, status_code=201)
def create_income(
    _: FinanceParticipant,
    body: FinanceIncomeCreate,
    user: CurrentUser,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> FinanceIncome:
    pf_profile_service.assert_can_write(db, user.id, profile_id)
    row = FinanceIncome(
        profile_id=profile_id,
        account_id=body.account_id,
        amount=body.amount,
        category=body.category,
        income_type=body.income_type,
        entry_date=body.entry_date,
        description=body.description,
    )
    return pf_finance_repo.create_income(db, row)


@router.get('/expenses', response_model=list[FinanceExpenseOut])
def list_expenses(
    _: FinanceParticipant,
    db: DbSession,
    profile_id: ActiveProfileId,
    page: Pagination,
) -> list[FinanceExpense]:
    return pf_finance_repo.list_expenses(db, profile_id, page.skip, page.limit, None, None)


@router.post('/expenses', response_model=FinanceExpenseOut, status_code=201)
def create_expense(
    _: FinanceParticipant,
    body: FinanceExpenseCreate,
    user: CurrentUser,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> FinanceExpense:
    pf_profile_service.assert_can_write(db, user.id, profile_id)
    row = FinanceExpense(
        profile_id=profile_id,
        account_id=body.account_id,
        amount=body.amount,
        category=body.category,
        entry_date=body.entry_date,
        description=body.description,
    )
    return pf_finance_repo.create_expense(db, row)


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
) -> list[Loan]:
    return pf_finance_repo.list_loans(db, profile_id)


@router.post('/loans', response_model=LoanOut, status_code=201)
def create_loan(
    _: FinanceParticipant,
    body: LoanCreate,
    user: CurrentUser,
    db: DbSession,
    profile_id: ActiveProfileId,
) -> Loan:
    pf_profile_service.assert_can_write(db, user.id, profile_id)
    row = Loan(
        profile_id=profile_id,
        borrower_name=body.borrower_name,
        loan_amount=body.loan_amount,
        interest_rate=body.interest_rate,
        start_date=body.start_date,
        end_date=body.end_date,
        status=body.status,
    )
    return pf_finance_repo.create_loan(db, row)


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
    row = LoanPayment(
        loan_id=loan_id,
        payment_date=body.payment_date,
        principal_paid=body.principal_paid,
        interest_paid=body.interest_paid,
        total_paid=body.total_paid,
        balance_remaining=body.balance_remaining,
    )
    return pf_finance_repo.create_loan_payment(db, row)
