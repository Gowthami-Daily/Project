from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal, Self

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, computed_field, field_validator, model_validator

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


class CreditCardCreate(BaseModel):
    card_name: str = Field(..., min_length=1, max_length=100)
    bank_name: str | None = Field(None, max_length=100)
    card_limit: float = Field(0.0, ge=0)
    billing_cycle_start: int = Field(1, ge=1, le=31)
    billing_cycle_end: int | None = Field(None, ge=1, le=31)
    due_days: int = Field(15, ge=0, le=120)
    closing_day: int | None = Field(None, ge=1, le=31)
    due_day: int | None = Field(None, ge=1, le=31)


class CreditCardOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    profile_id: int
    card_name: str
    bank_name: str | None
    card_limit: Decimal
    billing_cycle_start: int
    billing_cycle_end: int | None
    due_days: int
    closing_day: int | None = None
    due_day: int | None = None
    created_at: object


class CreditCardTransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    card_id: int
    amount: Decimal
    transaction_date: date
    category_id: int | None
    description: str | None
    expense_id: int | None
    bill_id: int | None
    created_at: object


class CreditCardBillOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    card_id: int
    bill_start_date: date
    bill_end_date: date
    total_amount: Decimal
    due_date: date
    status: str
    liability_id: int | None
    amount_paid: Decimal
    minimum_due: Decimal | None = None
    interest: Decimal | None = None
    late_fee: Decimal | None = None
    created_at: object
    remaining: Decimal | None = None


class CreditCardBillGenerate(BaseModel):
    card_id: int
    bill_start_date: date
    bill_end_date: date


class CreditCardBillPay(BaseModel):
    bill_id: int
    amount: float = Field(..., gt=0)
    payment_date: date
    from_account_id: int
    reference_number: str | None = Field(None, max_length=100)


class CreditCardStandaloneTx(BaseModel):
    """Swipe + expense in one step (optional API)."""

    card_id: int
    amount: float = Field(..., gt=0)
    transaction_date: date
    expense_category_id: int | None = None
    category: str = 'general'
    description: str | None = None
    paid_by: str | None = None


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
    credit_card_id: int | None = None
    credit_card_label: str | None = None
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
    credit_card_id: int | None = None
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
    credit_card_id: int | None = None
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
    cc = getattr(e, 'credit_card_rel', None)
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
        credit_card_id=getattr(e, 'credit_card_id', None),
        credit_card_label=(f'{cc.card_name}' + (f' · {cc.bank_name}' if cc.bank_name else '')) if cc else None,
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
    name: str
    invested_amount: Decimal
    investment_date: date
    platform: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime


class FinanceInvestmentCreate(BaseModel):
    model_config = ConfigDict(extra='forbid')

    investment_type: str = Field(validation_alias=AliasChoices('type', 'investment_type'))
    name: str
    invested_amount: float
    investment_date: date = Field(validation_alias=AliasChoices('investment_date', 'as_of_date'))
    platform: str | None = None
    notes: str | None = None

    @field_validator('name')
    @classmethod
    def strip_name(cls, v: str) -> str:
        s = (v or '').strip()
        if not s:
            raise ValueError('name is required')
        return s

    @field_validator('investment_type')
    @classmethod
    def strip_type(cls, v: str) -> str:
        s = (v or '').strip()
        if not s:
            raise ValueError('type is required')
        return s


class FinanceInvestmentUpdate(BaseModel):
    """Full replacement body for PUT /investments/{id}."""

    model_config = ConfigDict(extra='forbid')

    investment_type: str = Field(validation_alias=AliasChoices('type', 'investment_type'))
    name: str
    invested_amount: float
    investment_date: date = Field(validation_alias=AliasChoices('investment_date', 'as_of_date'))
    platform: str | None = None
    notes: str | None = None

    @field_validator('name')
    @classmethod
    def strip_name_u(cls, v: str) -> str:
        s = (v or '').strip()
        if not s:
            raise ValueError('name is required')
        return s

    @field_validator('investment_type')
    @classmethod
    def strip_type_u(cls, v: str) -> str:
        s = (v or '').strip()
        if not s:
            raise ValueError('type is required')
        return s


_ASSET_TYPES = frozenset(
    {
        'PROPERTY_LAND',
        'HOUSE',
        'APARTMENT',
        'VEHICLE',
        'GOLD_JEWELRY',
        'EQUIPMENT_MACHINERY',
        'FURNITURE',
        'ELECTRONICS',
        'BUSINESS_ASSET',
        'OTHER',
    }
)


class FinanceAssetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    profile_id: int
    asset_name: str
    asset_type: str
    purchase_value: Decimal
    current_value: Decimal
    purchase_date: date | None = None
    depreciation_rate: Decimal | None = None
    location: str | None = None
    linked_liability_id: int | None = None
    linked_liability_name: str | None = None
    notes: str | None = None
    created_at: datetime
    updated_at: datetime
    effective_current_value: Decimal = Decimal('0')
    book_depreciation: Decimal = Decimal('0')
    depreciation_years: float = 0.0


class AssetsPageSummaryOut(BaseModel):
    total_current_value: float
    total_purchase_value: float
    total_depreciation: float
    linked_loan_count: int
    locations: list[str]


class FinanceAssetCreate(BaseModel):
    asset_name: str
    asset_type: str = Field(
        ...,
        description=(
            'PROPERTY_LAND | HOUSE | APARTMENT | VEHICLE | GOLD_JEWELRY | '
            'EQUIPMENT_MACHINERY | FURNITURE | ELECTRONICS | BUSINESS_ASSET | OTHER'
        ),
    )
    purchase_value: float = Field(ge=0, default=0)
    current_value: float | None = Field(default=None, ge=0, description='Defaults to purchase_value when omitted')
    purchase_date: date | None = None
    depreciation_rate: float | None = Field(default=None, ge=0, le=100)
    location: str | None = Field(default=None, max_length=200)
    linked_liability_id: int | None = None
    notes: str | None = Field(default=None, max_length=4000)

    @field_validator('asset_type')
    @classmethod
    def asset_type_norm(cls, v: str) -> str:
        s = (v or '').strip().upper().replace(' ', '_')
        if s not in _ASSET_TYPES:
            raise ValueError(f'asset_type must be one of: {", ".join(sorted(_ASSET_TYPES))}')
        return s

    @field_validator('asset_name')
    @classmethod
    def asset_name_strip(cls, v: str) -> str:
        s = (v or '').strip()
        if not s:
            raise ValueError('asset_name is required')
        return s

    @model_validator(mode='after')
    def default_current_value(self) -> Self:
        if self.current_value is None:
            self.current_value = float(self.purchase_value)
        return self


class FinanceAssetUpdate(BaseModel):
    model_config = ConfigDict(extra='forbid')

    asset_name: str | None = None
    asset_type: str | None = None
    purchase_value: float | None = Field(default=None, ge=0)
    current_value: float | None = Field(default=None, ge=0)
    purchase_date: date | None = None
    depreciation_rate: float | None = Field(default=None, ge=0, le=100)
    location: str | None = Field(default=None, max_length=200)
    linked_liability_id: int | None = None
    notes: str | None = Field(default=None, max_length=4000)

    @field_validator('asset_type')
    @classmethod
    def asset_type_norm_u(cls, v: str | None) -> str | None:
        if v is None:
            return None
        s = (v or '').strip().upper().replace(' ', '_')
        if s not in _ASSET_TYPES:
            raise ValueError(f'asset_type must be one of: {", ".join(sorted(_ASSET_TYPES))}')
        return s

    @field_validator('asset_name')
    @classmethod
    def asset_name_strip_u(cls, v: str | None) -> str | None:
        if v is None:
            return None
        s = (v or '').strip()
        if not s:
            raise ValueError('asset_name cannot be empty')
        return s


class FinanceLiabilityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    profile_id: int
    liability_name: str
    liability_type: str
    total_amount: Decimal
    outstanding_amount: Decimal
    interest_rate: Decimal | None = None
    minimum_due: Decimal | None = None
    installment_amount: Decimal | None = None
    due_date: date | None = None
    billing_cycle_day: int | None = None
    lender_name: str | None = None
    notes: str | None = None
    status: str = 'ACTIVE'
    emi_interest_method: str = 'FLAT'
    interest_free_days: int | None = None
    term_months: int | None = None
    emi_schedule_start_date: date | None = None
    created_at: datetime
    updated_at: datetime
    display_status: str = 'ACTIVE'
    interest_paid_lifetime: Decimal = Decimal('0')
    has_emi_schedule: bool = False
    next_emi_due: date | None = None
    next_emi_amount: Decimal | None = None


class LiabilitiesPageSummaryOut(BaseModel):
    total_liabilities_book: float
    total_outstanding: float
    due_this_month_amount: float
    overdue_amount: float
    due_this_week: list[dict]
    interest_paid_lifetime: float


_LIABILITY_TYPES = frozenset(
    {
        'CREDIT_CARD',
        'PERSONAL_LOAN_BORROWED',
        'HOME_LOAN',
        'VEHICLE_LOAN',
        'EMI_PURCHASE',
        'BNPL',
        'BORROWED_PERSON',
        'BILLS_PAYABLE',
        'OTHER',
    }
)


class FinanceLiabilityCreate(BaseModel):
    liability_name: str
    liability_type: str = Field(
        ...,
        description=(
            'CREDIT_CARD | PERSONAL_LOAN_BORROWED | HOME_LOAN | VEHICLE_LOAN | '
            'EMI_PURCHASE | BNPL | BORROWED_PERSON | BILLS_PAYABLE | OTHER'
        ),
    )
    total_amount: float = Field(ge=0)
    outstanding_amount: float | None = Field(
        default=None,
        ge=0,
        description='Defaults to total_amount when omitted; used as principal when building EMI schedule',
    )
    interest_rate: float | None = None
    minimum_due: float | None = Field(default=None, ge=0)
    installment_amount: float | None = Field(default=None, ge=0)
    due_date: date | None = None
    billing_cycle_day: int | None = Field(default=None, ge=1, le=31)
    lender_name: str | None = Field(default=None, max_length=200)
    notes: str | None = Field(default=None, max_length=4000)
    status: str = 'ACTIVE'
    build_emi_schedule: bool = Field(
        default=False,
        description='If true, generates flat or reducing EMI rows from outstanding principal.',
    )
    emi_interest_method: Literal['flat', 'reducing_balance'] = Field(
        default='flat',
        description='Only used when build_emi_schedule is true.',
    )
    term_months: int | None = Field(default=None, ge=1)
    emi_schedule_start_date: date | None = Field(
        default=None,
        description='First anchor date; EMI 1 due = one month after this (same as loans).',
    )
    interest_free_days: int | None = Field(default=None, ge=0, description='Flat EMI only; reduces interest-bearing term.')

    @field_validator('liability_type')
    @classmethod
    def liability_type_ok(cls, v: str) -> str:
        u = (v or '').strip().upper().replace(' ', '_').replace('-', '_')
        if u == 'PERSONAL_LOAN':
            u = 'PERSONAL_LOAN_BORROWED'
        if u not in _LIABILITY_TYPES:
            raise ValueError('Invalid liability_type')
        return u

    @model_validator(mode='after')
    def outstanding_default(self):
        if self.outstanding_amount is None:
            object.__setattr__(self, 'outstanding_amount', float(self.total_amount))
        return self

    @model_validator(mode='after')
    def emi_schedule_requirements(self):
        if not self.build_emi_schedule:
            return self
        if self.term_months is None or int(self.term_months) < 1:
            raise ValueError('term_months is required when build_emi_schedule is true')
        if self.emi_schedule_start_date is None:
            raise ValueError('emi_schedule_start_date is required when build_emi_schedule is true')
        if self.interest_rate is None or float(self.interest_rate) <= 0:
            raise ValueError('interest_rate is required when build_emi_schedule is true')
        return self


class FinanceLiabilityUpdate(BaseModel):
    model_config = ConfigDict(extra='forbid')

    liability_name: str | None = Field(default=None, max_length=200)
    liability_type: str | None = None

    @field_validator('liability_type')
    @classmethod
    def liability_type_ok_u(cls, v: str | None) -> str | None:
        if v is None:
            return None
        u = (v or '').strip().upper().replace(' ', '_').replace('-', '_')
        if u == 'PERSONAL_LOAN':
            u = 'PERSONAL_LOAN_BORROWED'
        if u not in _LIABILITY_TYPES:
            raise ValueError('Invalid liability_type')
        return u
    total_amount: float | None = Field(default=None, ge=0)
    outstanding_amount: float | None = Field(default=None, ge=0)
    interest_rate: float | None = None
    minimum_due: float | None = None
    installment_amount: float | None = None
    due_date: date | None = None
    billing_cycle_day: int | None = Field(default=None, ge=1, le=31)
    lender_name: str | None = Field(default=None, max_length=200)
    notes: str | None = Field(default=None, max_length=4000)
    status: str | None = None


class LiabilityPaymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    liability_id: int
    payment_date: date
    amount_paid: Decimal
    interest_paid: Decimal
    payment_mode: str
    finance_account_id: int | None = None
    notes: str | None = None
    created_at: datetime


class LiabilityScheduleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    liability_id: int
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

    @computed_field
    def principal_component(self) -> Decimal:
        return self.principal_amount

    @computed_field
    def interest_component(self) -> Decimal:
        return self.interest_amount

    @computed_field
    def balance_principal(self) -> Decimal:
        return self.remaining_balance


class LiabilityPendingEmiOut(BaseModel):
    schedule_id: int
    liability_id: int
    liability_name: str
    emi_number: int
    due_date: date
    emi_amount: Decimal


class LiabilityEmiPayBody(BaseModel):
    liability_id: int = Field(..., ge=1)
    emi_number: int = Field(..., ge=1)
    payment_date: date | None = None
    finance_account_id: int | None = Field(default=None, ge=1)


class LiabilityPaymentCreate(BaseModel):
    payment_date: date
    amount_paid: float = Field(gt=0)
    interest_paid: float = Field(default=0, ge=0)
    payment_mode: str = Field(default='CASH', description='CASH | BANK')
    finance_account_id: int | None = None
    notes: str | None = Field(default=None, max_length=500)


class LoanOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    profile_id: int
    borrower_name: str
    loan_type: str = 'EMI'
    borrower_phone: str | None = None
    borrower_address: str | None = None
    notes: str | None = None
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
    next_emi_due: date | None = None
    next_emi_amount: Decimal | None = None
    display_status: str = 'ACTIVE'
    is_overdue: bool = False
    balance_due: Decimal = Decimal('0')
    interest_collected_lifetime: Decimal = Decimal('0')
    emi_interest_method: str = 'FLAT'
    emi_settlement: str = 'RECEIPT'


class LoanReminderItemOut(BaseModel):
    loan_id: int
    borrower_name: str
    kind: str
    due_date: date
    emi_amount: float | None = None
    emi_number: int | None = None


class LoanUpcomingEmiItemOut(BaseModel):
    loan_id: int
    borrower_name: str
    due_date: date
    emi_amount: float
    emi_number: int


class LoansPageSummaryOut(BaseModel):
    total_given: float
    total_received: float
    total_outstanding: float
    overdue_amount: float
    interest_earned_lifetime: float
    reminders: list[LoanReminderItemOut]
    upcoming_emis_this_week: list[LoanUpcomingEmiItemOut]


class LoanAddPrincipalBody(BaseModel):
    """Extra principal disbursed to the same borrower (no EMI schedule loans only)."""

    amount: float = Field(gt=0)
    disbursement_date: date
    finance_account_id: int = Field(ge=1, description='Bank account the funds are paid from')
    notes: str | None = Field(default=None, max_length=500)


class LoanPatch(BaseModel):
    """Optional borrower / notes fields for PATCH /loans/{id}."""

    model_config = ConfigDict(extra='forbid')

    borrower_phone: str | None = None
    borrower_address: str | None = None
    notes: str | None = None


class LoanCreate(BaseModel):
    borrower_name: str
    loan_amount: float
    borrower_phone: str | None = Field(default=None, max_length=40)
    borrower_address: str | None = Field(default=None, max_length=500)
    notes: str | None = Field(default=None, max_length=4000)
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
        description='If set with interest_rate, builds EMI schedule (flat or reducing per emi_interest_method).',
    )
    commission_percent: float | None = Field(default=None, ge=0)
    loan_kind: Literal['emi_schedule', 'interest_free', 'simple_accrual'] = Field(
        default='emi_schedule',
        description=(
            'emi_schedule: term + rate builds EMI rows; interest_free: principal only, 0%% rate; '
            'simple_accrual: no EMI, principal + simple interest from start_date through today (365-day year).'
        ),
    )
    emi_interest_method: Literal['flat', 'reducing_balance'] = Field(
        default='flat',
        description='flat: interest = P×r×years, EMI constant; reducing_balance: monthly amortization (annual rate / 12).',
    )
    emi_settlement: Literal['receipt', 'payment'] = Field(
        default='receipt',
        description='receipt: incoming repayment (credits bank); payment: EMI paid (expense + bank debit).',
    )

    @model_validator(mode='after')
    def normalize_loan_kind(self):
        if self.loan_kind == 'interest_free':
            object.__setattr__(self, 'interest_rate', 0.0)
            object.__setattr__(self, 'term_months', None)
            object.__setattr__(self, 'interest_free_days', None)
        elif self.loan_kind == 'simple_accrual':
            if self.term_months is not None:
                raise ValueError('Do not set term months for simple accrual loans')
            if self.interest_rate is None or float(self.interest_rate) <= 0:
                raise ValueError('Simple accrual loans require interest % greater than 0')
            object.__setattr__(self, 'interest_free_days', None)
        return self

    @model_validator(mode='after')
    def emi_method_rules(self):
        if self.loan_kind != 'emi_schedule':
            return self
        if self.emi_interest_method == 'reducing_balance':
            if self.term_months is None or int(self.term_months) < 1:
                raise ValueError('term_months is required for reducing-balance EMI loans')
            if self.interest_rate is None or float(self.interest_rate) <= 0:
                raise ValueError('interest_rate is required for reducing-balance EMI loans')
        return self


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

    @computed_field
    def principal_component(self) -> Decimal:
        return self.principal_amount

    @computed_field
    def interest_component(self) -> Decimal:
        return self.interest_amount

    @computed_field
    def balance_principal(self) -> Decimal:
        return self.remaining_balance


class LoanPendingEmiOut(BaseModel):
    schedule_id: int
    loan_id: int
    borrower_name: str
    emi_number: int
    due_date: date
    emi_amount: Decimal
    emi_settlement: str = 'RECEIPT'


class LoanEmiPayBody(BaseModel):
    loan_id: int = Field(..., ge=1)
    emi_number: int = Field(..., ge=1)
    payment_date: date | None = None
    finance_account_id: int | None = Field(default=None, ge=1)


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


class AccountTransferCreate(BaseModel):
    from_account_id: int = Field(..., ge=1)
    to_account_id: int = Field(..., ge=1)
    amount: float = Field(..., gt=0)
    transfer_date: date
    transfer_method: str = Field(default='INTERNAL', max_length=40)
    reference_number: str | None = Field(None, max_length=128)
    notes: str | None = None


class AccountMovementCreate(BaseModel):
    """Money movement (internal or external)."""

    movement_type: str = Field(
        ...,
        description=(
            'internal_transfer | external_deposit | external_withdrawal | '
            'credit_card_payment | loan_disbursement | loan_emi_payment'
        ),
    )
    amount: float = Field(..., gt=0)
    movement_date: date
    from_account_id: int | None = None
    to_account_id: int | None = None
    liability_id: int | None = None
    loan_id: int | None = None
    credit_card_id: int | None = None
    credit_card_bill_id: int | None = None
    external_counterparty: str | None = Field(None, max_length=120)
    reference_number: str | None = Field(None, max_length=128)
    notes: str | None = None
    create_linked_income: bool = False
    create_linked_expense: bool = False
    income_category: str | None = Field(None, max_length=120)
    expense_category: str | None = Field(None, max_length=120)
    emi_number: int | None = Field(None, ge=1)
    liability_interest_paid: float = Field(0.0, ge=0)


class AccountMovementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    profile_id: int
    movement_type: str
    from_account_id: int | None = None
    to_account_id: int | None = None
    liability_id: int | None = None
    loan_id: int | None = None
    credit_card_id: int | None = None
    credit_card_bill_id: int | None = None
    amount: Decimal
    movement_date: date
    reference_number: str | None
    notes: str | None
    external_counterparty: str | None = None
    attachment_url: str | None = None
    created_by: int | None = None
    created_at: datetime


AccountTransferOut = AccountMovementOut


class AccountTransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    profile_id: int
    account_id: int
    transaction_type: str
    amount: Decimal
    movement_id: int | None = None
    entry_date: date
    reference_number: str | None
    notes: str | None
    created_by: int | None
    created_at: datetime


class AccountBalanceSummaryOut(BaseModel):
    cash_balance: float
    bank_balance: float
    total_balance: float
    accounts: list[dict[str, Any]]
