from datetime import date

from sqlalchemy import extract, func, select
from sqlalchemy.orm import Session

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


def investment_allocation_by_type(db: Session, profile_id: int) -> list[dict]:
    stmt = (
        select(FinanceInvestment.investment_type, func.sum(FinanceInvestment.current_value))
        .where(FinanceInvestment.profile_id == profile_id)
        .group_by(FinanceInvestment.investment_type)
    )
    return [{'type': r[0], 'value': float(r[1])} for r in db.execute(stmt).all()]


def list_investments(db: Session, profile_id: int, skip: int, limit: int) -> list[FinanceInvestment]:
    stmt = (
        select(FinanceInvestment)
        .where(FinanceInvestment.profile_id == profile_id)
        .order_by(FinanceInvestment.as_of_date.desc())
        .offset(skip)
        .limit(limit)
    )
    return list(db.scalars(stmt).all())


def create_investment(db: Session, row: FinanceInvestment) -> FinanceInvestment:
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def list_assets(db: Session, profile_id: int, skip: int, limit: int) -> list[FinanceAsset]:
    stmt = (
        select(FinanceAsset)
        .where(FinanceAsset.profile_id == profile_id)
        .order_by(FinanceAsset.asset_name)
        .offset(skip)
        .limit(limit)
    )
    return list(db.scalars(stmt).all())


def create_asset(db: Session, row: FinanceAsset) -> FinanceAsset:
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def list_liabilities(db: Session, profile_id: int, skip: int, limit: int) -> list[FinanceLiability]:
    stmt = (
        select(FinanceLiability)
        .where(FinanceLiability.profile_id == profile_id)
        .order_by(FinanceLiability.liability_name)
        .offset(skip)
        .limit(limit)
    )
    return list(db.scalars(stmt).all())


def create_liability(db: Session, row: FinanceLiability) -> FinanceLiability:
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def list_recent_mixed(db: Session, profile_id: int, limit: int) -> list[dict]:
    inc = list_income(db, profile_id, 0, limit, None, None)
    exp = list_expenses(db, profile_id, 0, limit, None, None)
    merged: list[dict] = []
    for i in inc:
        merged.append(
            {
                'kind': 'income',
                'id': i.id,
                'date': i.entry_date.isoformat(),
                'amount': float(i.amount),
                'category': i.category,
                'description': i.description,
            }
        )
    for e in exp:
        merged.append(
            {
                'kind': 'expense',
                'id': e.id,
                'date': e.entry_date.isoformat(),
                'amount': float(e.amount),
                'category': e.category,
                'description': e.description,
            }
        )
    merged.sort(key=lambda r: r['date'], reverse=True)
    return merged[:limit]


def list_accounts(db: Session, profile_id: int, skip: int, limit: int) -> list[FinanceAccount]:
    stmt = (
        select(FinanceAccount)
        .where(FinanceAccount.profile_id == profile_id)
        .order_by(FinanceAccount.account_name)
        .offset(skip)
        .limit(limit)
    )
    return list(db.scalars(stmt).all())


def create_account(db: Session, row: FinanceAccount) -> FinanceAccount:
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def list_income(
    db: Session,
    profile_id: int,
    skip: int,
    limit: int,
    start: date | None,
    end: date | None,
) -> list[FinanceIncome]:
    stmt = select(FinanceIncome).where(FinanceIncome.profile_id == profile_id)
    if start:
        stmt = stmt.where(FinanceIncome.entry_date >= start)
    if end:
        stmt = stmt.where(FinanceIncome.entry_date <= end)
    stmt = stmt.order_by(FinanceIncome.entry_date.desc()).offset(skip).limit(limit)
    return list(db.scalars(stmt).all())


def create_income(db: Session, row: FinanceIncome) -> FinanceIncome:
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def list_expenses(
    db: Session,
    profile_id: int,
    skip: int,
    limit: int,
    start: date | None,
    end: date | None,
) -> list[FinanceExpense]:
    stmt = select(FinanceExpense).where(FinanceExpense.profile_id == profile_id)
    if start:
        stmt = stmt.where(FinanceExpense.entry_date >= start)
    if end:
        stmt = stmt.where(FinanceExpense.entry_date <= end)
    stmt = stmt.order_by(FinanceExpense.entry_date.desc()).offset(skip).limit(limit)
    return list(db.scalars(stmt).all())


def create_expense(db: Session, row: FinanceExpense) -> FinanceExpense:
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def sum_income(db: Session, profile_id: int, start: date | None, end: date | None) -> float:
    stmt = select(func.coalesce(func.sum(FinanceIncome.amount), 0)).where(FinanceIncome.profile_id == profile_id)
    if start:
        stmt = stmt.where(FinanceIncome.entry_date >= start)
    if end:
        stmt = stmt.where(FinanceIncome.entry_date <= end)
    return float(db.scalar(stmt) or 0)


def sum_expense(db: Session, profile_id: int, start: date | None, end: date | None) -> float:
    stmt = select(func.coalesce(func.sum(FinanceExpense.amount), 0)).where(FinanceExpense.profile_id == profile_id)
    if start:
        stmt = stmt.where(FinanceExpense.entry_date >= start)
    if end:
        stmt = stmt.where(FinanceExpense.entry_date <= end)
    return float(db.scalar(stmt) or 0)


def sum_investments_current(db: Session, profile_id: int) -> float:
    stmt = select(func.coalesce(func.sum(FinanceInvestment.current_value), 0)).where(
        FinanceInvestment.profile_id == profile_id
    )
    return float(db.scalar(stmt) or 0)


def sum_assets(db: Session, profile_id: int) -> float:
    stmt = select(func.coalesce(func.sum(FinanceAsset.value), 0)).where(FinanceAsset.profile_id == profile_id)
    return float(db.scalar(stmt) or 0)


def sum_liabilities(db: Session, profile_id: int) -> float:
    stmt = select(func.coalesce(func.sum(FinanceLiability.amount), 0)).where(
        FinanceLiability.profile_id == profile_id
    )
    return float(db.scalar(stmt) or 0)


def sum_account_balances(db: Session, profile_id: int) -> float:
    stmt = select(func.coalesce(func.sum(FinanceAccount.balance), 0)).where(
        FinanceAccount.profile_id == profile_id
    )
    return float(db.scalar(stmt) or 0)


def income_by_month(db: Session, profile_id: int, year: int) -> list[tuple[str, float]]:
    """Month key YYYY-MM — PostgreSQL ``to_char`` or SQLite ``strftime``."""
    dialect = db.get_bind().dialect.name
    if dialect == 'postgresql':
        ym = func.to_char(FinanceIncome.entry_date, 'YYYY-MM').label('ym')
        yfilt = extract('year', FinanceIncome.entry_date) == year
    else:
        ym = func.strftime('%Y-%m', FinanceIncome.entry_date).label('ym')
        yfilt = func.strftime('%Y', FinanceIncome.entry_date) == str(year)
    stmt = (
        select(ym, func.sum(FinanceIncome.amount))
        .where(FinanceIncome.profile_id == profile_id)
        .where(yfilt)
        .group_by(ym)
        .order_by(ym)
    )
    return [(r[0], float(r[1])) for r in db.execute(stmt).all()]


def expense_by_month(db: Session, profile_id: int, year: int) -> list[tuple[str, float]]:
    dialect = db.get_bind().dialect.name
    if dialect == 'postgresql':
        ym = func.to_char(FinanceExpense.entry_date, 'YYYY-MM').label('ym')
        yfilt = extract('year', FinanceExpense.entry_date) == year
    else:
        ym = func.strftime('%Y-%m', FinanceExpense.entry_date).label('ym')
        yfilt = func.strftime('%Y', FinanceExpense.entry_date) == str(year)
    stmt = (
        select(ym, func.sum(FinanceExpense.amount))
        .where(FinanceExpense.profile_id == profile_id)
        .where(yfilt)
        .group_by(ym)
        .order_by(ym)
    )
    return [(r[0], float(r[1])) for r in db.execute(stmt).all()]


def expense_by_category(
    db: Session, profile_id: int, start: date | None, end: date | None
) -> list[tuple[str, float]]:
    stmt = select(FinanceExpense.category, func.sum(FinanceExpense.amount)).where(
        FinanceExpense.profile_id == profile_id
    )
    if start:
        stmt = stmt.where(FinanceExpense.entry_date >= start)
    if end:
        stmt = stmt.where(FinanceExpense.entry_date <= end)
    stmt = stmt.group_by(FinanceExpense.category)
    return [(r[0], float(r[1])) for r in db.execute(stmt).all()]


def list_loans(db: Session, profile_id: int) -> list[Loan]:
    stmt = select(Loan).where(Loan.profile_id == profile_id).order_by(Loan.start_date.desc())
    return list(db.scalars(stmt).all())


def create_loan(db: Session, row: Loan) -> Loan:
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def sum_loan_outstanding(db: Session, profile_id: int) -> float:
    """Approximation: latest balance_remaining per loan max, else loan_amount."""
    loans = list_loans(db, profile_id)
    total = 0.0
    for ln in loans:
        stmt = (
            select(LoanPayment.balance_remaining)
            .where(LoanPayment.loan_id == ln.id)
            .order_by(LoanPayment.payment_date.desc(), LoanPayment.id.desc())
            .limit(1)
        )
        last = db.scalar(stmt)
        total += float(last) if last is not None else float(ln.loan_amount)
    return total


def list_loan_payments(db: Session, loan_id: int) -> list[LoanPayment]:
    stmt = select(LoanPayment).where(LoanPayment.loan_id == loan_id).order_by(LoanPayment.payment_date.desc())
    return list(db.scalars(stmt).all())


def create_loan_payment(db: Session, row: LoanPayment) -> LoanPayment:
    db.add(row)
    db.commit()
    db.refresh(row)
    return row
