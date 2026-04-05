"""Time-series aggregations for modular PF analytics (live queries; optional snapshot tables later)."""

from __future__ import annotations

from calendar import monthrange
from datetime import date

from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Session

from fastapi_service.models_extended import AccountTransaction, FinanceExpense, FinanceIncome
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
