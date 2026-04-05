"""Budget lines and spend from finance_expenses."""

from __future__ import annotations

from calendar import monthrange
from datetime import date

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from fastapi_service.models_extended import FinanceExpense, PfBudget, PfBudgetExpenseMap, PfExpenseCategory


def list_budgets(db: Session, profile_id: int) -> list[PfBudget]:
    stmt = select(PfBudget).where(PfBudget.profile_id == profile_id).order_by(PfBudget.start_date.desc(), PfBudget.id)
    return list(db.scalars(stmt).all())


def get_budget(db: Session, budget_id: int, profile_id: int) -> PfBudget | None:
    row = db.get(PfBudget, budget_id)
    if row is None or row.profile_id != profile_id:
        return None
    return row


def sum_expense_for_budget_month(
    db: Session,
    profile_id: int,
    budget: PfBudget,
    year: int,
    month: int,
) -> float:
    """Sum expenses in calendar month matching category or mapped expenses."""
    ms = date(year, month, 1)
    me = date(year, month, monthrange(year, month)[1])
    mapped_ids_stmt = select(PfBudgetExpenseMap.expense_id).where(PfBudgetExpenseMap.budget_id == budget.id)
    mapped = {int(x) for x in db.scalars(mapped_ids_stmt).all()}
    stmt = select(func.coalesce(func.sum(FinanceExpense.amount), 0)).where(
        FinanceExpense.profile_id == profile_id,
        FinanceExpense.entry_date >= ms,
        FinanceExpense.entry_date <= me,
    )
    if mapped:
        stmt = stmt.where(
            or_(FinanceExpense.id.in_(mapped), _category_clause(budget))
        )
    else:
        stmt = stmt.where(_category_clause(budget))
    return float(db.scalar(stmt) or 0)


def _category_clause(budget: PfBudget):
    if budget.expense_category_id is not None:
        return FinanceExpense.expense_category_id == budget.expense_category_id
    if budget.category_label:
        return FinanceExpense.category == budget.category_label
    return FinanceExpense.id == -1


def budget_rows_for_month(db: Session, profile_id: int, year: int, month: int) -> list[dict]:
    budgets = list_budgets(db, profile_id)
    rows = []
    for b in budgets:
        if b.end_date and b.end_date < date(year, month, 1):
            continue
        if b.start_date > date(year, month, monthrange(year, month)[1]):
            continue
        spent = sum_expense_for_budget_month(db, profile_id, b, year, month)
        budget_amt = float(b.monthly_budget or 0)
        rem = budget_amt - spent
        pct = round(spent / budget_amt * 100, 1) if budget_amt > 0.01 else 0.0
        status = 'ok'
        if spent > budget_amt + 0.01:
            status = 'over'
        elif pct >= 90:
            status = 'warn'
        cat_name = b.category_label or ''
        if b.expense_category_id:
            c = db.get(PfExpenseCategory, b.expense_category_id)
            if c:
                cat_name = c.name
        rows.append(
            {
                'budget_id': b.id,
                'category': cat_name or b.name or 'Budget',
                'budget': round(budget_amt, 2),
                'spent': round(spent, 2),
                'remaining': round(rem, 2),
                'pct_used': pct,
                'status': status,
            }
        )
    return rows


def daily_spend_series(
    db: Session,
    profile_id: int,
    budget: PfBudget,
    year: int,
    month: int,
) -> list[tuple[date, float]]:
    ms = date(year, month, 1)
    me = date(year, month, monthrange(year, month)[1])
    mapped_ids_stmt = select(PfBudgetExpenseMap.expense_id).where(PfBudgetExpenseMap.budget_id == budget.id)
    mapped = {int(x) for x in db.scalars(mapped_ids_stmt).all()}
    stmt = select(FinanceExpense.entry_date, func.sum(FinanceExpense.amount)).where(
        FinanceExpense.profile_id == profile_id,
        FinanceExpense.entry_date >= ms,
        FinanceExpense.entry_date <= me,
    )
    if mapped:
        stmt = stmt.where(or_(FinanceExpense.id.in_(mapped), _category_clause(budget)))
    else:
        stmt = stmt.where(_category_clause(budget))
    stmt = stmt.group_by(FinanceExpense.entry_date).order_by(FinanceExpense.entry_date)
    return [(r[0], float(r[1])) for r in db.execute(stmt).all()]
