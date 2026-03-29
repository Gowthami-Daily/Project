"""
Profile-based multi-tenant extension (personal / family / company / farm).
Does not alter dairy ERP models in ``models.py`` — link farm profiles via ``Profile.profile_type`` + ``dairy_link_key``.
"""

from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from fastapi_service.database import Base


class PfExpenseCategory(Base):
    """
    Master expense categories for personal finance (separate from dairy ERP ``expense_categories``).
    """

    __tablename__ = 'pf_expense_categories'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    icon: Mapped[str | None] = mapped_column(String(50), nullable=True)
    color: Mapped[str | None] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PfIncomeCategory(Base):
    """Master income categories for personal finance."""

    __tablename__ = 'pf_income_categories'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    icon: Mapped[str | None] = mapped_column(String(50), nullable=True)
    color: Mapped[str | None] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PfPaymentInstrument(Base):
    """Saved credit cards and UPI IDs per profile — each links to the account that is debited."""

    __tablename__ = 'pf_payment_instruments'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    profile_id: Mapped[int] = mapped_column(Integer, ForeignKey('profiles.id'), nullable=False, index=True)
    kind: Mapped[str] = mapped_column(String(24), nullable=False, index=True)
    label: Mapped[str] = mapped_column(String(200), nullable=False)
    finance_account_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey('finance_accounts.id'), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Role(Base):
    """Application roles for RBAC (separate from legacy ``User.role`` string)."""

    __tablename__ = 'roles'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    role_name: Mapped[str] = mapped_column(String(50), nullable=False, unique=True, index=True)


class Family(Base):
    __tablename__ = 'families'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    family_name: Mapped[str] = mapped_column(String(200), nullable=False)
    created_by_user_id: Mapped[int] = mapped_column(Integer, ForeignKey('users.id'), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class FamilyMember(Base):
    __tablename__ = 'family_members'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    family_id: Mapped[int] = mapped_column(Integer, ForeignKey('families.id'), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    relation: Mapped[str] = mapped_column(String(80), nullable=False, default='member')

    __table_args__ = (UniqueConstraint('family_id', 'user_id', name='uq_family_member'),)


class Profile(Base):
    """
    Central tenant for finance data. ``profile_type`` = PERSONAL | FAMILY | COMPANY | FARM.
    For FARM, set ``dairy_link_key`` (e.g. ``gowthami``) — integrate with dairy UI without FK into dairy tables.
    """

    __tablename__ = 'profiles'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    profile_name: Mapped[str] = mapped_column(String(200), nullable=False)
    profile_type: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    family_id: Mapped[int | None] = mapped_column(Integer, ForeignKey('families.id'), nullable=True)
    created_by_user_id: Mapped[int] = mapped_column(Integer, ForeignKey('users.id'), nullable=False)
    dairy_link_key: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class UserProfileAccess(Base):
    """Which user can access which profile, and how."""

    __tablename__ = 'user_profile_access'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    profile_id: Mapped[int] = mapped_column(Integer, ForeignKey('profiles.id'), nullable=False, index=True)
    permission: Mapped[str] = mapped_column(String(20), nullable=False, default='viewer')

    __table_args__ = (UniqueConstraint('user_id', 'profile_id', name='uq_user_profile'),)


class FinanceAccount(Base):
    __tablename__ = 'finance_accounts'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    profile_id: Mapped[int] = mapped_column(Integer, ForeignKey('profiles.id'), nullable=False, index=True)
    account_name: Mapped[str] = mapped_column(String(200), nullable=False)
    account_type: Mapped[str] = mapped_column(String(40), nullable=False)
    balance: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class FinanceIncome(Base):
    __tablename__ = 'finance_income'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    profile_id: Mapped[int] = mapped_column(Integer, ForeignKey('profiles.id'), nullable=False, index=True)
    account_id: Mapped[int | None] = mapped_column(Integer, ForeignKey('finance_accounts.id'), nullable=True)
    amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    category: Mapped[str] = mapped_column(String(120), nullable=False, default='general')
    income_type: Mapped[str] = mapped_column(String(80), nullable=False, default='other')
    entry_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    income_category_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey('pf_income_categories.id'), nullable=True, index=True
    )
    received_from: Mapped[str | None] = mapped_column(String(200), nullable=True)
    payment_method: Mapped[str | None] = mapped_column(String(24), nullable=True)
    receipt_image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_recurring: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    recurring_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    income_category_rel: Mapped['PfIncomeCategory | None'] = relationship()


class FinanceExpense(Base):
    __tablename__ = 'finance_expenses'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    profile_id: Mapped[int] = mapped_column(Integer, ForeignKey('profiles.id'), nullable=False, index=True)
    account_id: Mapped[int | None] = mapped_column(Integer, ForeignKey('finance_accounts.id'), nullable=True)
    amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    category: Mapped[str] = mapped_column(String(120), nullable=False, default='general')
    entry_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    expense_category_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey('pf_expense_categories.id'), nullable=True, index=True
    )
    paid_by: Mapped[str | None] = mapped_column(String(120), nullable=True)
    payment_method: Mapped[str | None] = mapped_column(String(24), nullable=True)
    bill_image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    payment_instrument_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey('pf_payment_instruments.id', ondelete='SET NULL'),
        nullable=True,
        index=True,
    )
    is_recurring: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    recurring_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    payment_status: Mapped[str] = mapped_column(String(20), nullable=False, default='PAID')
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    expense_category_rel: Mapped['PfExpenseCategory | None'] = relationship()
    payment_instrument_rel: Mapped['PfPaymentInstrument | None'] = relationship()


class FinanceInvestment(Base):
    __tablename__ = 'finance_investments'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    profile_id: Mapped[int] = mapped_column(Integer, ForeignKey('profiles.id'), nullable=False, index=True)
    investment_type: Mapped[str] = mapped_column(String(80), nullable=False)
    invested_amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    current_value: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    platform: Mapped[str | None] = mapped_column(String(120), nullable=True)
    as_of_date: Mapped[date] = mapped_column(Date, nullable=False)


class FinanceAsset(Base):
    __tablename__ = 'finance_assets'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    profile_id: Mapped[int] = mapped_column(Integer, ForeignKey('profiles.id'), nullable=False, index=True)
    asset_name: Mapped[str] = mapped_column(String(200), nullable=False)
    asset_type: Mapped[str] = mapped_column(String(80), nullable=False)
    value: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)


class FinanceLiability(Base):
    __tablename__ = 'finance_liabilities'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    profile_id: Mapped[int] = mapped_column(Integer, ForeignKey('profiles.id'), nullable=False, index=True)
    liability_name: Mapped[str] = mapped_column(String(200), nullable=False)
    liability_type: Mapped[str] = mapped_column(String(80), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    interest_rate: Mapped[float | None] = mapped_column(Numeric(6, 3), nullable=True)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)


class Loan(Base):
    __tablename__ = 'loans'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    profile_id: Mapped[int] = mapped_column(Integer, ForeignKey('profiles.id'), nullable=False, index=True)
    borrower_name: Mapped[str] = mapped_column(String(200), nullable=False)
    loan_amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    interest_rate: Mapped[float | None] = mapped_column(Numeric(6, 3), nullable=True)
    interest_free_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(40), nullable=False, default='ACTIVE')
    term_months: Mapped[int | None] = mapped_column(Integer, nullable=True)
    commission_percent: Mapped[float | None] = mapped_column(Numeric(6, 3), nullable=True)
    commission_amount: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)
    total_interest: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)
    total_amount: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)
    emi_amount: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)
    remaining_amount: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)


class LoanSchedule(Base):
    """Flat-interest EMI schedule for a loan (optional; legacy loans have no rows)."""

    __tablename__ = 'loan_schedule'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    loan_id: Mapped[int] = mapped_column(Integer, ForeignKey('loans.id', ondelete='CASCADE'), nullable=False, index=True)
    emi_number: Mapped[int] = mapped_column(Integer, nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    emi_amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    principal_amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    interest_amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    remaining_balance: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    payment_status: Mapped[str] = mapped_column(String(20), nullable=False, default='Pending')
    payment_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    amount_paid: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)
    finance_account_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey('finance_accounts.id'), nullable=True, index=True
    )
    credit_as_cash: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class LoanPayment(Base):
    __tablename__ = 'loan_payments'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    loan_id: Mapped[int] = mapped_column(Integer, ForeignKey('loans.id'), nullable=False, index=True)
    payment_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    principal_paid: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    interest_paid: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    total_paid: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    balance_remaining: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    finance_account_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey('finance_accounts.id'), nullable=True, index=True
    )
    credit_as_cash: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
