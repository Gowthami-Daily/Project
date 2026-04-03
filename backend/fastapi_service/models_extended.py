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


class CreditCard(Base):
    """Registered credit card for a profile (swipes → expense + ledger row; statement → liability)."""

    __tablename__ = 'credit_cards'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    profile_id: Mapped[int] = mapped_column(Integer, ForeignKey('profiles.id'), nullable=False, index=True)
    card_name: Mapped[str] = mapped_column(String(100), nullable=False)
    bank_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    card_limit: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    billing_cycle_start: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    billing_cycle_end: Mapped[int | None] = mapped_column(Integer, nullable=True)
    due_days: Mapped[int] = mapped_column(Integer, nullable=False, default=15)
    closing_day: Mapped[int | None] = mapped_column(Integer, nullable=True)
    due_day: Mapped[int | None] = mapped_column(Integer, nullable=True)
    interest_rate: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False, default=0)
    annual_fee: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    card_network: Mapped[str | None] = mapped_column(String(20), nullable=True)
    card_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    currency: Mapped[str] = mapped_column(String(8), nullable=False, default='INR')
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CreditCardBill(Base):
    __tablename__ = 'credit_card_bills'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    card_id: Mapped[int] = mapped_column(Integer, ForeignKey('credit_cards.id', ondelete='CASCADE'), nullable=False, index=True)
    bill_start_date: Mapped[date] = mapped_column(Date, nullable=False)
    bill_end_date: Mapped[date] = mapped_column(Date, nullable=False)
    total_amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default='PENDING')
    liability_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey('finance_liabilities.id', ondelete='SET NULL'), nullable=True, index=True
    )
    amount_paid: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    minimum_due: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    interest: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    late_fee: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    card: Mapped['CreditCard'] = relationship(back_populates='bills')
    transactions: Mapped[list['CreditCardTransaction']] = relationship(back_populates='bill')


class CreditCardTransaction(Base):
    """Per-swipe line (linked to ``FinanceExpense`` when posted via expenses UI)."""

    __tablename__ = 'credit_card_transactions'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    card_id: Mapped[int] = mapped_column(Integer, ForeignKey('credit_cards.id', ondelete='CASCADE'), nullable=False, index=True)
    amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    transaction_date: Mapped[date] = mapped_column(Date, nullable=False)
    category_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey('pf_expense_categories.id'), nullable=True, index=True
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    expense_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey('finance_expenses.id', ondelete='SET NULL'), nullable=True, index=True
    )
    bill_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey('credit_card_bills.id', ondelete='SET NULL'), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    card: Mapped['CreditCard'] = relationship(back_populates='transactions')
    bill: Mapped['CreditCardBill | None'] = relationship(back_populates='transactions')


class CreditCardPayment(Base):
    __tablename__ = 'credit_card_payments'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    card_id: Mapped[int] = mapped_column(Integer, ForeignKey('credit_cards.id', ondelete='CASCADE'), nullable=False, index=True)
    bill_id: Mapped[int] = mapped_column(Integer, ForeignKey('credit_card_bills.id', ondelete='CASCADE'), nullable=False, index=True)
    amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    payment_date: Mapped[date] = mapped_column(Date, nullable=False)
    from_account_id: Mapped[int] = mapped_column(Integer, ForeignKey('finance_accounts.id'), nullable=False, index=True)
    reference_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


CreditCard.bills = relationship('CreditCardBill', back_populates='card')
CreditCard.transactions = relationship('CreditCardTransaction', back_populates='card')


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
    credit_card_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey('credit_cards.id', ondelete='SET NULL'), nullable=True, index=True
    )
    is_recurring: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    recurring_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    payment_status: Mapped[str] = mapped_column(String(20), nullable=False, default='PAID')
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    expense_category_rel: Mapped['PfExpenseCategory | None'] = relationship()
    payment_instrument_rel: Mapped['PfPaymentInstrument | None'] = relationship()
    credit_card_rel: Mapped['CreditCard | None'] = relationship()


class FinanceInvestment(Base):
    __tablename__ = 'finance_investments'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    profile_id: Mapped[int] = mapped_column(Integer, ForeignKey('profiles.id'), nullable=False, index=True)
    investment_type: Mapped[str] = mapped_column(String(80), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False, default='')
    invested_amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    investment_date: Mapped[date] = mapped_column(Date, nullable=False)
    platform: Mapped[str | None] = mapped_column(String(120), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class FinanceAsset(Base):
    __tablename__ = 'finance_assets'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    profile_id: Mapped[int] = mapped_column(Integer, ForeignKey('profiles.id'), nullable=False, index=True)
    asset_name: Mapped[str] = mapped_column(String(200), nullable=False)
    asset_type: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    purchase_value: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    current_value: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    purchase_date: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    depreciation_rate: Mapped[float | None] = mapped_column(Numeric(8, 4), nullable=True)
    location: Mapped[str | None] = mapped_column(String(200), nullable=True)
    linked_liability_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey('finance_liabilities.id', ondelete='SET NULL'), nullable=True, index=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class FinanceLiability(Base):
    __tablename__ = 'finance_liabilities'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    profile_id: Mapped[int] = mapped_column(Integer, ForeignKey('profiles.id'), nullable=False, index=True)
    liability_name: Mapped[str] = mapped_column(String(200), nullable=False)
    liability_type: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    total_amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    outstanding_amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    interest_rate: Mapped[float | None] = mapped_column(Numeric(6, 3), nullable=True)
    minimum_due: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)
    installment_amount: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    billing_cycle_day: Mapped[int | None] = mapped_column(Integer, nullable=True)
    lender_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default='ACTIVE')
    emi_interest_method: Mapped[str] = mapped_column(String(24), nullable=False, default='FLAT')
    interest_free_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    term_months: Mapped[int | None] = mapped_column(Integer, nullable=True)
    emi_schedule_start_date: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class LiabilityPayment(Base):
    __tablename__ = 'liability_payments'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    liability_id: Mapped[int] = mapped_column(
        Integer, ForeignKey('finance_liabilities.id', ondelete='CASCADE'), nullable=False, index=True
    )
    payment_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    amount_paid: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    interest_paid: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    payment_mode: Mapped[str] = mapped_column(String(16), nullable=False, default='CASH')
    finance_account_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey('finance_accounts.id'), nullable=True, index=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class LiabilitySchedule(Base):
    """EMI schedule for a liability (flat or reducing balance)."""

    __tablename__ = 'liability_schedule'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    liability_id: Mapped[int] = mapped_column(
        Integer, ForeignKey('finance_liabilities.id', ondelete='CASCADE'), nullable=False, index=True
    )
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


class Loan(Base):
    __tablename__ = 'loans'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    profile_id: Mapped[int] = mapped_column(Integer, ForeignKey('profiles.id'), nullable=False, index=True)
    borrower_name: Mapped[str] = mapped_column(String(200), nullable=False)
    loan_type: Mapped[str] = mapped_column(String(24), nullable=False, default='EMI')
    borrower_phone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    borrower_address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
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
    emi_interest_method: Mapped[str] = mapped_column(String(24), nullable=False, default='FLAT')
    emi_settlement: Mapped[str] = mapped_column(String(24), nullable=False, default='RECEIPT')


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


class UserPermission(Base):
    """Per-user module access (personal finance & exports); enforced in future middleware."""

    __tablename__ = 'user_permissions'
    __table_args__ = (UniqueConstraint('user_id', 'module_name', name='uq_user_permissions_user_module'),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    module_name: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    can_view: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    can_edit: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    can_delete: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    can_export: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class AuditLog(Base):
    __tablename__ = 'audit_logs'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


class AccountMovement(Base):
    """Money movements: internal transfers, external in/out, card pay, loan proceeds / EMI."""

    __tablename__ = 'account_movements'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    profile_id: Mapped[int] = mapped_column(Integer, ForeignKey('profiles.id'), nullable=False, index=True)
    movement_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    from_account_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey('finance_accounts.id'), nullable=True, index=True
    )
    to_account_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey('finance_accounts.id'), nullable=True, index=True
    )
    liability_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey('finance_liabilities.id'), nullable=True, index=True
    )
    loan_id: Mapped[int | None] = mapped_column(Integer, ForeignKey('loans.id'), nullable=True, index=True)
    credit_card_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey('credit_cards.id'), nullable=True, index=True
    )
    credit_card_bill_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey('credit_card_bills.id'), nullable=True, index=True
    )
    amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    movement_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    reference_number: Mapped[str | None] = mapped_column(String(128), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    external_counterparty: Mapped[str | None] = mapped_column(String(120), nullable=True)
    attachment_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


class AccountTransaction(Base):
    """
    Ledger line per finance account (e.g. TRANSFER_IN / TRANSFER_OUT).
    Positive ``amount`` is always the magnitude; type indicates effect on the account.
    """

    __tablename__ = 'account_transactions'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    profile_id: Mapped[int] = mapped_column(Integer, ForeignKey('profiles.id'), nullable=False, index=True)
    account_id: Mapped[int] = mapped_column(Integer, ForeignKey('finance_accounts.id'), nullable=False, index=True)
    transaction_type: Mapped[str] = mapped_column(String(24), nullable=False, index=True)
    amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    movement_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey('account_movements.id', ondelete='SET NULL'), nullable=True, index=True
    )
    entry_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    reference_number: Mapped[str | None] = mapped_column(String(128), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
