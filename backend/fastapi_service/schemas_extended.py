from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


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


class FinanceIncomeCreate(BaseModel):
    amount: float
    category: str = 'general'
    income_type: str = 'other'
    entry_date: date
    description: str | None = None
    account_id: int | None = None


class FinanceExpenseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    profile_id: int
    account_id: int | None
    amount: Decimal
    category: str
    entry_date: date
    description: str | None


class FinanceExpenseCreate(BaseModel):
    amount: float
    category: str = 'general'
    entry_date: date
    description: str | None = None
    account_id: int | None = None


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
    start_date: date
    end_date: date | None
    status: str


class LoanCreate(BaseModel):
    borrower_name: str
    loan_amount: float
    interest_rate: float | None = None
    start_date: date
    end_date: date | None = None
    status: str = 'ACTIVE'


class LoanPaymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    loan_id: int
    payment_date: date
    principal_paid: Decimal
    interest_paid: Decimal
    total_paid: Decimal
    balance_remaining: Decimal


class LoanPaymentCreate(BaseModel):
    payment_date: date
    principal_paid: float = 0.0
    interest_paid: float = 0.0
    total_paid: float
    balance_remaining: float


class FamilyCreate(BaseModel):
    family_name: str = Field(..., max_length=200)


class FamilyMemberAdd(BaseModel):
    user_id: int
    relation: str = 'member'
