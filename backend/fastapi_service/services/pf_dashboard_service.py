from datetime import date

from sqlalchemy.orm import Session

from fastapi_service.repositories import pf_finance_repo


def summary(db: Session, profile_id: int) -> dict:
    start = date(date.today().year, 1, 1)
    end = date.today()
    total_income = pf_finance_repo.sum_income(db, profile_id, start, end)
    total_expense = pf_finance_repo.sum_expense(db, profile_id, start, end)
    total_investment = pf_finance_repo.sum_investments_current(db, profile_id)
    total_assets = pf_finance_repo.sum_assets(db, profile_id)
    total_liabilities = pf_finance_repo.sum_liabilities(db, profile_id)
    cash_balance = pf_finance_repo.sum_account_balances(db, profile_id)
    loan_outstanding = pf_finance_repo.sum_loan_outstanding(db, profile_id)
    net_worth = total_assets + total_investment - total_liabilities - loan_outstanding
    return {
        'total_income': total_income,
        'total_expense': total_expense,
        'total_investment': total_investment,
        'total_assets': total_assets,
        'total_liabilities': total_liabilities,
        'net_worth': net_worth,
        'cash_balance': cash_balance,
        'loan_outstanding': loan_outstanding,
        'period_start': start.isoformat(),
        'period_end': end.isoformat(),
        'recent_transactions': recent_transactions(db, profile_id, 20),
    }


def income_vs_expense(db: Session, profile_id: int, year: int | None) -> list[dict]:
    y = year or date.today().year
    inc = {m: v for m, v in pf_finance_repo.income_by_month(db, profile_id, y)}
    exp = {m: v for m, v in pf_finance_repo.expense_by_month(db, profile_id, y)}
    months = sorted(set(inc) | set(exp))
    out = []
    for m in months:
        i = inc.get(m, 0.0)
        e = exp.get(m, 0.0)
        out.append({'month': m, 'income': i, 'expense': e, 'savings': i - e})
    return out


def expense_category(db: Session, profile_id: int, start: date | None, end: date | None) -> list[dict]:
    rows = pf_finance_repo.expense_by_category(db, profile_id, start, end)
    return [{'category': c, 'total': v} for c, v in rows]


def networth_growth(db: Session, profile_id: int, year: int | None) -> list[dict]:
    """Estimate: month-end net worth using static balance sheet + cumulative P&L within year."""
    y = year or date.today().year
    base_assets = pf_finance_repo.sum_assets(db, profile_id)
    base_inv = pf_finance_repo.sum_investments_current(db, profile_id)
    base_liab = pf_finance_repo.sum_liabilities(db, profile_id)
    base_loan = pf_finance_repo.sum_loan_outstanding(db, profile_id)
    base = base_assets + base_inv - base_liab - base_loan
    series = income_vs_expense(db, profile_id, y)
    cum = 0.0
    out = []
    for row in series:
        cum += row['savings']
        out.append({'month': row['month'], 'net_worth': base + cum})
    return out


def investment_allocation(db: Session, profile_id: int) -> list[dict]:
    from fastapi_service.repositories import pf_finance_repo

    return pf_finance_repo.investment_allocation_by_type(db, profile_id)


def recent_transactions(db: Session, profile_id: int, limit: int = 20) -> list[dict]:
    from fastapi_service.repositories import pf_finance_repo

    return pf_finance_repo.list_recent_mixed(db, profile_id, limit)
