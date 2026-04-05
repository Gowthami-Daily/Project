"""Time-series aggregations for modular PF analytics (live queries; optional snapshot tables later)."""

from __future__ import annotations

from calendar import monthrange
from datetime import date

from sqlalchemy import case, func, literal, or_, select
from sqlalchemy.orm import Session

from fastapi_service.models_extended import (
    AccountTransaction,
    CreditCard,
    CreditCardPayment,
    CreditCardTransaction,
    FinanceExpense,
    FinanceIncome,
    FinanceInvestment,
    FinanceInvestmentTransaction,
    FinanceLiability,
    LiabilityPayment,
    Loan,
    LoanPayment,
    PfExpenseCategory,
)
from fastapi_service.repositories.pf_finance_repo import _expense_scope, _income_scope

# Ledger magnitudes: classify as cash in vs cash out for movement analytics
_LEDGER_INFLOW_TYPES: tuple[str, ...] = (
    'EXTERNAL_DEPOSIT',
    'TRANSFER_IN',
    'CHIT_AUCTION_RECEIPT',
)
_LEDGER_OUTFLOW_TYPES: tuple[str, ...] = (
    'EXTERNAL_WITHDRAWAL',
    'TRANSFER_OUT',
    'CC_BILL_PAYMENT',
    'LOAN_DISBURSEMENT',
    'LOAN_LIABILITY_PAYMENT',
    'LOAN_EMI_PAYMENT',
    'CHIT_CONTRIBUTION',
)


def month_date_bounds(year: int, month: int) -> tuple[date, date]:
    last = monthrange(year, month)[1]
    return date(year, month, 1), date(year, month, last)


def expense_daily_series(
    db: Session,
    profile_id: int,
    start: date,
    end: date,
    *,
    account_id: int | None = None,
    expense_category_id: int | None = None,
) -> list[tuple[date, float]]:
    stmt = (
        select(
            FinanceExpense.entry_date,
            func.coalesce(func.sum(FinanceExpense.amount), 0),
        )
        .where(
            _expense_scope(
                profile_id,
                start,
                end,
                account_id,
                expense_category_id,
                None,
                expense_type_filter=None,
            )
        )
        .group_by(FinanceExpense.entry_date)
        .order_by(FinanceExpense.entry_date)
    )
    return [(r[0], float(r[1])) for r in db.execute(stmt).all()]


def income_daily_series(
    db: Session,
    profile_id: int,
    start: date,
    end: date,
    *,
    account_id: int | None = None,
    income_category_id: int | None = None,
) -> list[tuple[date, float]]:
    stmt = (
        select(
            FinanceIncome.entry_date,
            func.coalesce(func.sum(FinanceIncome.amount), 0),
        )
        .where(_income_scope(profile_id, start, end, account_id, income_category_id, None))
        .group_by(FinanceIncome.entry_date)
        .order_by(FinanceIncome.entry_date)
    )
    return [(r[0], float(r[1])) for r in db.execute(stmt).all()]


def expense_monthly_series_year(
    db: Session,
    profile_id: int,
    year: int,
    *,
    account_id: int | None = None,
    expense_category_id: int | None = None,
) -> list[tuple[str, float]]:
    start, end = date(year, 1, 1), date(year, 12, 31)
    dialect = db.get_bind().dialect.name
    if dialect == 'postgresql':
        ym = func.to_char(FinanceExpense.entry_date, 'YYYY-MM').label('ym')
    else:
        ym = func.strftime('%Y-%m', FinanceExpense.entry_date).label('ym')
    stmt = (
        select(ym, func.coalesce(func.sum(FinanceExpense.amount), 0))
        .where(
            _expense_scope(
                profile_id,
                start,
                end,
                account_id,
                expense_category_id,
                None,
                expense_type_filter=None,
            )
        )
        .group_by(ym)
        .order_by(ym)
    )
    return [(str(r[0]), float(r[1])) for r in db.execute(stmt).all()]


def income_monthly_series_year(
    db: Session,
    profile_id: int,
    year: int,
    *,
    account_id: int | None = None,
    income_category_id: int | None = None,
) -> list[tuple[str, float]]:
    start, end = date(year, 1, 1), date(year, 12, 31)
    dialect = db.get_bind().dialect.name
    if dialect == 'postgresql':
        ym = func.to_char(FinanceIncome.entry_date, 'YYYY-MM').label('ym')
    else:
        ym = func.strftime('%Y-%m', FinanceIncome.entry_date).label('ym')
    stmt = (
        select(ym, func.coalesce(func.sum(FinanceIncome.amount), 0))
        .where(_income_scope(profile_id, start, end, account_id, income_category_id, None))
        .group_by(ym)
        .order_by(ym)
    )
    return [(str(r[0]), float(r[1])) for r in db.execute(stmt).all()]


def ledger_daily_inflow_outflow(
    db: Session,
    profile_id: int,
    start: date,
    end: date,
    *,
    account_id: int | None = None,
) -> list[tuple[date, float, float]]:
    inf = case(
        (AccountTransaction.transaction_type.in_(_LEDGER_INFLOW_TYPES), AccountTransaction.amount),
        else_=0,
    )
    outf = case(
        (AccountTransaction.transaction_type.in_(_LEDGER_OUTFLOW_TYPES), AccountTransaction.amount),
        else_=0,
    )
    stmt = (
        select(
            AccountTransaction.entry_date,
            func.coalesce(func.sum(inf), 0),
            func.coalesce(func.sum(outf), 0),
        )
        .where(
            AccountTransaction.profile_id == profile_id,
            AccountTransaction.entry_date >= start,
            AccountTransaction.entry_date <= end,
            or_(
                AccountTransaction.transaction_type.in_(_LEDGER_INFLOW_TYPES),
                AccountTransaction.transaction_type.in_(_LEDGER_OUTFLOW_TYPES),
            ),
        )
    )
    if account_id is not None:
        stmt = stmt.where(AccountTransaction.account_id == account_id)
    stmt = stmt.group_by(AccountTransaction.entry_date).order_by(AccountTransaction.entry_date)
    return [(r[0], float(r[1]), float(r[2])) for r in db.execute(stmt).all()]


def ledger_monthly_inflow_outflow_year(
    db: Session,
    profile_id: int,
    year: int,
    *,
    account_id: int | None = None,
) -> list[tuple[str, float, float]]:
    start, end = date(year, 1, 1), date(year, 12, 31)
    dialect = db.get_bind().dialect.name
    if dialect == 'postgresql':
        ym = func.to_char(AccountTransaction.entry_date, 'YYYY-MM').label('ym')
    else:
        ym = func.strftime('%Y-%m', AccountTransaction.entry_date).label('ym')
    inf = case(
        (AccountTransaction.transaction_type.in_(_LEDGER_INFLOW_TYPES), AccountTransaction.amount),
        else_=0,
    )
    outf = case(
        (AccountTransaction.transaction_type.in_(_LEDGER_OUTFLOW_TYPES), AccountTransaction.amount),
        else_=0,
    )
    stmt = (
        select(
            ym,
            func.coalesce(func.sum(inf), 0),
            func.coalesce(func.sum(outf), 0),
        )
        .where(
            AccountTransaction.profile_id == profile_id,
            AccountTransaction.entry_date >= start,
            AccountTransaction.entry_date <= end,
            or_(
                AccountTransaction.transaction_type.in_(_LEDGER_INFLOW_TYPES),
                AccountTransaction.transaction_type.in_(_LEDGER_OUTFLOW_TYPES),
            ),
        )
    )
    if account_id is not None:
        stmt = stmt.where(AccountTransaction.account_id == account_id)
    stmt = stmt.group_by(ym).order_by(ym)
    return [(str(r[0]), float(r[1]), float(r[2])) for r in db.execute(stmt).all()]


def loan_repayments_daily_series(db: Session, profile_id: int, start: date, end: date) -> list[tuple[date, float]]:
    stmt = (
        select(LoanPayment.payment_date, func.coalesce(func.sum(LoanPayment.total_paid), 0))
        .select_from(LoanPayment)
        .join(Loan, Loan.id == LoanPayment.loan_id)
        .where(
            Loan.profile_id == profile_id,
            LoanPayment.payment_date >= start,
            LoanPayment.payment_date <= end,
        )
        .group_by(LoanPayment.payment_date)
        .order_by(LoanPayment.payment_date)
    )
    return [(r[0], float(r[1])) for r in db.execute(stmt).all()]


def loan_repayments_monthly_series_year(db: Session, profile_id: int, year: int) -> list[tuple[str, float]]:
    start, end = date(year, 1, 1), date(year, 12, 31)
    dialect = db.get_bind().dialect.name
    if dialect == 'postgresql':
        ym = func.to_char(LoanPayment.payment_date, 'YYYY-MM').label('ym')
    else:
        ym = func.strftime('%Y-%m', LoanPayment.payment_date).label('ym')
    stmt = (
        select(ym, func.coalesce(func.sum(LoanPayment.total_paid), 0))
        .select_from(LoanPayment)
        .join(Loan, Loan.id == LoanPayment.loan_id)
        .where(Loan.profile_id == profile_id, LoanPayment.payment_date >= start, LoanPayment.payment_date <= end)
        .group_by(ym)
        .order_by(ym)
    )
    return [(str(r[0]), float(r[1])) for r in db.execute(stmt).all()]


def credit_card_spend_daily_series(
    db: Session,
    profile_id: int,
    start: date,
    end: date,
    *,
    card_id: int | None = None,
) -> list[tuple[date, float]]:
    stmt = (
        select(CreditCardTransaction.transaction_date, func.coalesce(func.sum(CreditCardTransaction.amount), 0))
        .select_from(CreditCardTransaction)
        .join(CreditCard, CreditCard.id == CreditCardTransaction.card_id)
        .where(
            CreditCard.profile_id == profile_id,
            CreditCardTransaction.transaction_date >= start,
            CreditCardTransaction.transaction_date <= end,
        )
    )
    if card_id is not None:
        stmt = stmt.where(CreditCardTransaction.card_id == card_id)
    stmt = stmt.group_by(CreditCardTransaction.transaction_date).order_by(CreditCardTransaction.transaction_date)
    return [(r[0], float(r[1])) for r in db.execute(stmt).all()]


def credit_card_spend_monthly_series_year(
    db: Session, profile_id: int, year: int, *, card_id: int | None = None
) -> list[tuple[str, float]]:
    start, end = date(year, 1, 1), date(year, 12, 31)
    dialect = db.get_bind().dialect.name
    if dialect == 'postgresql':
        ym = func.to_char(CreditCardTransaction.transaction_date, 'YYYY-MM').label('ym')
    else:
        ym = func.strftime('%Y-%m', CreditCardTransaction.transaction_date).label('ym')
    stmt = (
        select(ym, func.coalesce(func.sum(CreditCardTransaction.amount), 0))
        .select_from(CreditCardTransaction)
        .join(CreditCard, CreditCard.id == CreditCardTransaction.card_id)
        .where(
            CreditCard.profile_id == profile_id,
            CreditCardTransaction.transaction_date >= start,
            CreditCardTransaction.transaction_date <= end,
        )
    )
    if card_id is not None:
        stmt = stmt.where(CreditCardTransaction.card_id == card_id)
    stmt = stmt.group_by(ym).order_by(ym)
    return [(str(r[0]), float(r[1])) for r in db.execute(stmt).all()]


def investment_txn_daily_series(db: Session, profile_id: int, start: date, end: date) -> list[tuple[date, float]]:
    """Net signed cashflow from investment ledger lines (BUY negative, SELL positive heuristic)."""
    stmt = (
        select(
            FinanceInvestmentTransaction.txn_date,
            func.coalesce(func.sum(FinanceInvestmentTransaction.amount), 0),
        )
        .select_from(FinanceInvestmentTransaction)
        .join(FinanceInvestment, FinanceInvestment.id == FinanceInvestmentTransaction.investment_id)
        .where(
            FinanceInvestment.profile_id == profile_id,
            FinanceInvestmentTransaction.txn_date >= start,
            FinanceInvestmentTransaction.txn_date <= end,
        )
        .group_by(FinanceInvestmentTransaction.txn_date)
        .order_by(FinanceInvestmentTransaction.txn_date)
    )
    return [(r[0], float(r[1])) for r in db.execute(stmt).all()]


def investment_txn_monthly_series_year(db: Session, profile_id: int, year: int) -> list[tuple[str, float]]:
    start, end = date(year, 1, 1), date(year, 12, 31)
    dialect = db.get_bind().dialect.name
    if dialect == 'postgresql':
        ym = func.to_char(FinanceInvestmentTransaction.txn_date, 'YYYY-MM').label('ym')
    else:
        ym = func.strftime('%Y-%m', FinanceInvestmentTransaction.txn_date).label('ym')
    stmt = (
        select(ym, func.coalesce(func.sum(FinanceInvestmentTransaction.amount), 0))
        .select_from(FinanceInvestmentTransaction)
        .join(FinanceInvestment, FinanceInvestment.id == FinanceInvestmentTransaction.investment_id)
        .where(
            FinanceInvestment.profile_id == profile_id,
            FinanceInvestmentTransaction.txn_date >= start,
            FinanceInvestmentTransaction.txn_date <= end,
        )
        .group_by(ym)
        .order_by(ym)
    )
    return [(str(r[0]), float(r[1])) for r in db.execute(stmt).all()]


def liability_payments_daily_series(db: Session, profile_id: int, start: date, end: date) -> list[tuple[date, float]]:
    stmt = (
        select(LiabilityPayment.payment_date, func.coalesce(func.sum(LiabilityPayment.amount_paid), 0))
        .select_from(LiabilityPayment)
        .join(FinanceLiability, FinanceLiability.id == LiabilityPayment.liability_id)
        .where(
            FinanceLiability.profile_id == profile_id,
            LiabilityPayment.payment_date >= start,
            LiabilityPayment.payment_date <= end,
        )
        .group_by(LiabilityPayment.payment_date)
        .order_by(LiabilityPayment.payment_date)
    )
    return [(r[0], float(r[1])) for r in db.execute(stmt).all()]


def liability_payments_monthly_series_year(db: Session, profile_id: int, year: int) -> list[tuple[str, float]]:
    start, end = date(year, 1, 1), date(year, 12, 31)
    dialect = db.get_bind().dialect.name
    if dialect == 'postgresql':
        ym = func.to_char(LiabilityPayment.payment_date, 'YYYY-MM').label('ym')
    else:
        ym = func.strftime('%Y-%m', LiabilityPayment.payment_date).label('ym')
    stmt = (
        select(ym, func.coalesce(func.sum(LiabilityPayment.amount_paid), 0))
        .select_from(LiabilityPayment)
        .join(FinanceLiability, FinanceLiability.id == LiabilityPayment.liability_id)
        .where(
            FinanceLiability.profile_id == profile_id,
            LiabilityPayment.payment_date >= start,
            LiabilityPayment.payment_date <= end,
        )
        .group_by(ym)
        .order_by(ym)
    )
    return [(str(r[0]), float(r[1])) for r in db.execute(stmt).all()]


def credit_card_payment_daily_series(
    db: Session,
    profile_id: int,
    start: date,
    end: date,
    *,
    card_id: int | None = None,
) -> list[tuple[date, float]]:
    stmt = (
        select(CreditCardPayment.payment_date, func.coalesce(func.sum(CreditCardPayment.amount), 0))
        .select_from(CreditCardPayment)
        .join(CreditCard, CreditCard.id == CreditCardPayment.card_id)
        .where(
            CreditCard.profile_id == profile_id,
            CreditCardPayment.payment_date >= start,
            CreditCardPayment.payment_date <= end,
        )
    )
    if card_id is not None:
        stmt = stmt.where(CreditCardPayment.card_id == card_id)
    stmt = stmt.group_by(CreditCardPayment.payment_date).order_by(CreditCardPayment.payment_date)
    return [(r[0], float(r[1])) for r in db.execute(stmt).all()]


def credit_card_payment_monthly_series_year(
    db: Session, profile_id: int, year: int, *, card_id: int | None = None
) -> list[tuple[str, float]]:
    start, end = date(year, 1, 1), date(year, 12, 31)
    dialect = db.get_bind().dialect.name
    if dialect == 'postgresql':
        ym = func.to_char(CreditCardPayment.payment_date, 'YYYY-MM').label('ym')
    else:
        ym = func.strftime('%Y-%m', CreditCardPayment.payment_date).label('ym')
    stmt = (
        select(ym, func.coalesce(func.sum(CreditCardPayment.amount), 0))
        .select_from(CreditCardPayment)
        .join(CreditCard, CreditCard.id == CreditCardPayment.card_id)
        .where(
            CreditCard.profile_id == profile_id,
            CreditCardPayment.payment_date >= start,
            CreditCardPayment.payment_date <= end,
        )
    )
    if card_id is not None:
        stmt = stmt.where(CreditCardPayment.card_id == card_id)
    stmt = stmt.group_by(ym).order_by(ym)
    return [(str(r[0]), float(r[1])) for r in db.execute(stmt).all()]


def loan_repayments_by_borrower_range(
    db: Session, profile_id: int, start: date, end: date
) -> list[tuple[str, float]]:
    stmt = (
        select(Loan.borrower_name, func.coalesce(func.sum(LoanPayment.total_paid), 0))
        .select_from(LoanPayment)
        .join(Loan, Loan.id == LoanPayment.loan_id)
        .where(
            Loan.profile_id == profile_id,
            LoanPayment.payment_date >= start,
            LoanPayment.payment_date <= end,
        )
        .group_by(Loan.id, Loan.borrower_name)
        .order_by(func.sum(LoanPayment.total_paid).desc())
    )
    return [(str(r[0]), float(r[1])) for r in db.execute(stmt).all()]


def liability_payments_by_name_range(
    db: Session, profile_id: int, start: date, end: date
) -> list[tuple[str, float]]:
    stmt = (
        select(FinanceLiability.liability_name, func.coalesce(func.sum(LiabilityPayment.amount_paid), 0))
        .select_from(LiabilityPayment)
        .join(FinanceLiability, FinanceLiability.id == LiabilityPayment.liability_id)
        .where(
            FinanceLiability.profile_id == profile_id,
            LiabilityPayment.payment_date >= start,
            LiabilityPayment.payment_date <= end,
        )
        .group_by(FinanceLiability.id, FinanceLiability.liability_name)
        .order_by(func.sum(LiabilityPayment.amount_paid).desc())
    )
    return [(str(r[0]), float(r[1])) for r in db.execute(stmt).all()]


def investment_txn_volume_by_name_range(
    db: Session, profile_id: int, start: date, end: date
) -> list[tuple[str, float]]:
    """Absolute transaction amounts per investment name (period activity)."""
    stmt = (
        select(
            FinanceInvestment.name,
            func.coalesce(func.sum(func.abs(FinanceInvestmentTransaction.amount)), 0),
        )
        .select_from(FinanceInvestmentTransaction)
        .join(FinanceInvestment, FinanceInvestment.id == FinanceInvestmentTransaction.investment_id)
        .where(
            FinanceInvestment.profile_id == profile_id,
            FinanceInvestmentTransaction.txn_date >= start,
            FinanceInvestmentTransaction.txn_date <= end,
        )
        .group_by(FinanceInvestment.id, FinanceInvestment.name)
        .order_by(func.sum(func.abs(FinanceInvestmentTransaction.amount)).desc())
    )
    return [(str(r[0]), float(r[1])) for r in db.execute(stmt).all()]


def credit_card_spend_by_card_range(
    db: Session, profile_id: int, start: date, end: date, *, card_id: int | None = None
) -> list[tuple[str, float]]:
    nm = func.coalesce(CreditCard.card_name, literal('Card'))
    stmt = (
        select(nm, func.coalesce(func.sum(CreditCardTransaction.amount), 0))
        .select_from(CreditCardTransaction)
        .join(CreditCard, CreditCard.id == CreditCardTransaction.card_id)
        .where(
            CreditCard.profile_id == profile_id,
            CreditCardTransaction.transaction_date >= start,
            CreditCardTransaction.transaction_date <= end,
        )
    )
    if card_id is not None:
        stmt = stmt.where(CreditCardTransaction.card_id == card_id)
    stmt = stmt.group_by(CreditCard.id, nm).order_by(func.sum(CreditCardTransaction.amount).desc())
    return [(str(r[0]), float(r[1])) for r in db.execute(stmt).all()]


def credit_card_spend_by_category_range(
    db: Session, profile_id: int, start: date, end: date, *, card_id: int | None = None
) -> list[tuple[str, float]]:
    cat_label = func.coalesce(PfExpenseCategory.name, literal('Uncategorized'))
    stmt = (
        select(cat_label, func.coalesce(func.sum(CreditCardTransaction.amount), 0))
        .select_from(CreditCardTransaction)
        .join(CreditCard, CreditCard.id == CreditCardTransaction.card_id)
        .outerjoin(PfExpenseCategory, PfExpenseCategory.id == CreditCardTransaction.category_id)
        .where(
            CreditCard.profile_id == profile_id,
            CreditCardTransaction.transaction_date >= start,
            CreditCardTransaction.transaction_date <= end,
        )
    )
    if card_id is not None:
        stmt = stmt.where(CreditCardTransaction.card_id == card_id)
    stmt = stmt.group_by(cat_label).order_by(func.sum(CreditCardTransaction.amount).desc())
    return [(str(r[0]), float(r[1])) for r in db.execute(stmt).all()]
