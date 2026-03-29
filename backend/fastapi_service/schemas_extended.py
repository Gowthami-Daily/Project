from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from fastapi_service.models_extended import FinanceExpense, FinanceIncome


class ProfileMemberOut(BaseModel):
    profile_id: int
    profile_name: str
    profile_type: str
    permission: str
    dairy_link_key: str | None = None


class ProfileSwitchBody(BaseModel):
    profile_id: int = Field(..., description='Profile to activate; new JWT will include this id.')


class FinanceAccountOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    profile_id: int
    account_name: str
    account_type: str
    balance: Decimal
    created_at: object


class FinanceAccountCreate(BaseModel):
    account_name: str = Field(..., max_length=200)
    account_type: str = Field(..., max_length=40)
    balance: float = 0.0


class FinanceAccountBalanceUpdate(BaseModel):
    balance: float = Field(..., description='New account balance')


class PfMasterCategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    icon: str | None
    color: str | None


class PfPaymentInstrumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    profile_id: int
    kind: str
    label: str
    finance_account_id: int | None = None
    created_at: object


class PfPaymentInstrumentCreate(BaseModel):
    kind: str = Field(..., max_length=24, description='card or upi')
    label: str = Field(..., min_length=1, max_length=200)
    finance_account_id: int = Field(..., description='Bank/cash account debited when using this card or UPI')

    @field_validator('kind')
    @classmethod
    def kind_allowed(cls, v: str) -> str:
        k = (v or '').strip().lower()
        if k not in ('card', 'upi'):
            raise ValueError('kind must be card or upi')
        return k


class FinanceIncomeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    profile_id: int
    account_id: int | None
    amount: Decimal
    category: str
    income_type: str
    entry_date: date
    description: str | None
    income_category_id: int | None = None
    received_from: str | None = None
    payment_method: str | None = None
    receipt_image_url: str | None = None
    is_recurring: bool = False
    recurring_type: str | None = None
    category_icon: str | None = None
    category_color: str | None = None


class FinanceIncomeCreate(BaseModel):
    amount: float
    category: str = 'general'
    income_type: str = 'other'
    entry_date: date
    description: str | None = None
    account_id: int | None = None
    income_category_id: int | None = None
    received_from: str | None = Field(None, max_length=200)
    payment_method: str | None = Field(None, max_length=24)
    receipt_image_url: str | None = None
    is_recurring: bool = False
    recurring_type: str | None = Field(None, max_length=20)


class FinanceIncomeUpdate(BaseModel):
    amount: float | None = None
    category: str | None = Field(None, max_length=120)
    income_type: str | None = Field(None, max_length=80)
    entry_date: date | None = None
    description: str | None = None
    account_id: int | None = None
    income_category_id: int | None = None
    received_from: str | None = Field(None, max_length=200)
    payment_method: str | None = Field(None, max_length=24)
    receipt_image_url: str | None = None
    is_recurring: bool | None = None
    recurring_type: str | None = Field(None, max_length=20)

    @field_validator('amount')
    @classmethod
    def amount_positive(cls, v: float | None) -> float | None:
        if v is not None and v <= 0:
            raise ValueError('amount must be positive')
        return v


class FinanceExpenseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    profile_id: int
    account_id: int | None
    amount: Decimal
    category: str
    entry_date: date
    description: str | None
    expense_category_id: int | None = None
    paid_by: str | None = None
    payment_method: str | None = None
    payment_instrument_id: int | None = None
    payment_instrument_label: str | None = None
    is_recurring: bool = False
    recurring_type: str | None = None
    payment_status: str = 'PAID'
    category_icon: str | None = None
    category_color: str | None = None


class FinanceExpenseCreate(BaseModel):
    amount: float
    category: str = 'general'
    entry_date: date
    description: str | None = None
    account_id: int | None = None
    expense_category_id: int | None = None
    paid_by: str | None = Field(None, max_length=120)
    payment_method: str | None = Field(None, max_length=24)
    payment_instrument_id: int | None = None
    is_recurring: bool = False
    recurring_type: str | None = Field(None, max_length=20)
    payment_status: str = Field(default='PAID', max_length=20)


class FinanceExpenseUpdate(BaseModel):
    amount: float | None = None
    category: str | None = Field(None, max_length=120)
    entry_date: date | None = None
    description: str | None = None
    account_id: int | None = None
    expense_category_id: int | None = None
    paid_by: str | None = Field(None, max_length=120)
    payment_method: str | None = Field(None, max_length=24)
    payment_instrument_id: int | None = None
    is_recurring: bool | None = None
    recurring_type: str | None = Field(None, max_length=20)
    payment_status: str | None = Field(None, max_length=20)

    @field_validator('amount')
    @classmethod
    def amount_positive(cls, v: float | None) -> float | None:
        if v is not None and v <= 0:
            raise ValueError('amount must be positive')
        return v


def finance_expense_to_out(e: FinanceExpense) -> FinanceExpenseOut:
    rel = e.expense_category_rel
    pinst = getattr(e, 'payment_instrument_rel', None)
    return FinanceExpenseOut(
        id=e.id,
        profile_id=e.profile_id,
        account_id=e.account_id,
        amount=Decimal(str(e.amount)),
        category=e.category,
        entry_date=e.entry_date,
        description=e.description,
        expense_category_id=e.expense_category_id,
        paid_by=e.paid_by,
        payment_method=e.payment_method,
        payment_instrument_id=e.payment_instrument_id,
        payment_instrument_label=pinst.label if pinst else None,
        is_recurring=bool(e.is_recurring),
        recurring_type=e.recurring_type,
        payment_status=(e.payment_status or 'PAID').upper(),
        category_icon=rel.icon if rel else None,
        category_color=rel.color if rel else None,
    )


def finance_income_to_out(i: FinanceIncome) -> FinanceIncomeOut:
    rel = i.income_category_rel
    return FinanceIncomeOut(
        id=i.id,
        profile_id=i.profile_id,
        account_id=i.account_id,
        amount=Decimal(str(i.amount)),
        category=i.category,
        income_type=i.income_type,
        entry_date=i.entry_date,
        description=i.description,
        income_category_id=i.income_category_id,
        received_from=i.received_from,
        payment_method=i.payment_method,
        receipt_image_url=i.receipt_image_url,
        is_recurring=bool(i.is_recurring),
        recurring_type=i.recurring_type,
        category_icon=rel.icon if rel else None,
        category_color=rel.color if rel else None,
    )


class FinanceInvestmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    profile_id: int
    investment_type: str
    invested_amount: Decimal
    current_value: Decimal
    platform: str | None
    as_of_date: date


class FinanceInvestmentCreate(BaseModel):
    investment_type: str
    invested_amount: float
    current_value: float = 0.0
    platform: str | None = None
    as_of_date: date


class FinanceAssetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    profile_id: int
    asset_name: str
    asset_type: str
    value: Decimal


class FinanceAssetCreate(BaseModel):
    asset_name: str
    asset_type: str
    value: float = 0.0


class FinanceLiabilityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    profile_id: int
    liability_name: str
    liability_type: str
    amount: Decimal
    interest_rate: Decimal | None
    due_date: date | None


class FinanceLiabilityCreate(BaseModel):
    liability_name: str
    liability_type: str
    amount: float
    interest_rate: float | None = None
    due_date: date | None = None


class LoanOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    profile_id: int
    borrower_name: str
    loan_amount: Decimal
    interest_rate: Decimal | None
    interest_free_days: int | None = None
    has_emi_schedule: bool = False
    start_date: date
    end_date: date | None
    status: str
    term_months: int | None = None
    commission_percent: Decimal | None = None
    commission_amount: Decimal | None = None
    total_interest: Decimal | None = None
    total_amount: Decimal | None = None
    emi_amount: Decimal | None = None
    remaining_amount: Decimal | None = None


class LoanCreate(BaseModel):
    borrower_name: str
    loan_amount: float
    interest_rate: float | None = None
    interest_free_days: int | None = Field(
        default=None,
        ge=0,
        description='No interest accrues for this many days at the start; reduces interest-bearing term for EMI (converted to months).',
    )
    start_date: date
    end_date: date | None = None
    status: str = 'ACTIVE'
    term_months: int | None = Field(
        default=None,
        ge=1,
        description='If set with interest_rate, builds flat-interest EMI schedule.',
    )
    commission_percent: float | None = Field(default=None, ge=0)


class LoanScheduleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    loan_id: int
    emi_number: int
    due_date: date
    emi_amount: Decimal
    principal_amount: Decimal
    interest_amount: Decimal
    remaining_balance: Decimal
    payment_status: str
    payment_date: date | None
    amount_paid: Decimal | None
    finance_account_id: int | None = None
    credit_as_cash: bool = False


class LoanScheduleCreditUpdate(BaseModel):
    """How received funds are recorded when EMI is marked paid."""

    credit_as_cash: bool = Field(
        default=False,
        description='If true, payment is cash — no bank balance is credited.',
    )
    finance_account_id: int | None = Field(
        default=None,
        description='Bank to credit when not cash; ignored when credit_as_cash is true.',
    )


class LoanPaymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    loan_id: int
    payment_date: date
    principal_paid: Decimal
    interest_paid: Decimal
    total_paid: Decimal
    balance_remaining: Decimal
    finance_account_id: int | None = None
    credit_as_cash: bool = False


class LoanPaymentCreate(BaseModel):
    """Manual payment for loans **without** an EMI schedule (server computes balance remaining)."""

    payment_date: date
    total_paid: float = Field(..., gt=0)
    principal_paid: float | None = Field(None, ge=0, description='Defaults to total_paid minus interest')
    interest_paid: float | None = Field(None, ge=0, description='Defaults to 0')
    credit_as_cash: bool = False
    finance_account_id: int | None = Field(
        None,
        description='Bank to credit when credit_as_cash is false; must be omitted when cash.',
    )


class FamilyCreate(BaseModel):
    family_name: str = Field(..., max_length=200)


class FamilyMemberAdd(BaseModel):
    user_id: int
    relation: str = 'member'
