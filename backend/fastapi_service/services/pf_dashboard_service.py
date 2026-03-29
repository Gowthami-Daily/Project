from calendar import monthrange
from datetime import date

from sqlalchemy.orm import Session

from fastapi_service.repositories import pf_finance_repo


def _validate_finance_account(db: Session, profile_id: int, account_id: int | None) -> None:
    if account_id is None:
        return
    if pf_finance_repo.get_account_for_profile(db, account_id, profile_id) is None:
        raise ValueError('Account not found')


def summary(db: Session, profile_id: int, account_id: int | None = None) -> dict:
    start = date(date.today().year, 1, 1)
    end = date.today()
    acc = None
    if account_id is not None:
        acc = pf_finance_repo.get_account_for_profile(db, account_id, profile_id)
        if acc is None:
            raise ValueError('Account not found')
    total_income = pf_finance_repo.sum_income(db, profile_id, start, end, account_id)
    total_expense = pf_finance_repo.sum_expense(db, profile_id, start, end, account_id)
    total_investment = pf_finance_repo.sum_investments_current(db, profile_id)
    total_assets = pf_finance_repo.sum_assets(db, profile_id)
    total_liabilities = pf_finance_repo.sum_liabilities(db, profile_id)
    if account_id is not None:
        cash_balance = float(acc.balance)
    else:
        cash_balance = pf_finance_repo.sum_account_balances(db, profile_id)
    loan_receivable = pf_finance_repo.sum_loan_outstanding(db, profile_id)
    net_worth = (
        float(cash_balance)
        + total_investment
        + total_assets
        + loan_receivable
        - total_liabilities
    )
    uni = 0.0
    une = 0.0
    if account_id is None:
        uni = pf_finance_repo.sum_income_unassigned(db, profile_id, start, end)
        une = pf_finance_repo.sum_expense_unassigned(db, profile_id, start, end)
    return {
        'total_income': total_income,
        'total_expense': total_expense,
        'total_investment': total_investment,
        'total_assets': total_assets,
        'total_liabilities': total_liabilities,
        'net_worth': net_worth,
        'cash_balance': cash_balance,
        'loan_outstanding': loan_receivable,
        'loan_receivable': loan_receivable,
        'period_start': start.isoformat(),
        'period_end': end.isoformat(),
        'recent_transactions': recent_transactions(db, profile_id, 20, account_id),
        'account_filter': {'id': acc.id, 'name': acc.account_name} if acc else None,
        'unallocated_income_ytd': uni,
        'unallocated_expense_ytd': une,
    }


def income_vs_expense(
    db: Session, profile_id: int, year: int | None, account_id: int | None = None
) -> list[dict]:
    _validate_finance_account(db, profile_id, account_id)
    y = year or date.today().year
    inc = {m: v for m, v in pf_finance_repo.income_by_month(db, profile_id, y, account_id)}
    exp = {m: v for m, v in pf_finance_repo.expense_by_month(db, profile_id, y, account_id)}
    months = sorted(set(inc) | set(exp))
    out = []
    for m in months:
        i = inc.get(m, 0.0)
        e = exp.get(m, 0.0)
        out.append({'month': m, 'income': i, 'expense': e, 'savings': i - e})
    return out


def expense_category(
    db: Session,
    profile_id: int,
    start: date | None,
    end: date | None,
    account_id: int | None = None,
) -> list[dict]:
    _validate_finance_account(db, profile_id, account_id)
    rows = pf_finance_repo.expense_by_category(db, profile_id, start, end, account_id)
    return [{'category': c, 'total': v} for c, v in rows]


def networth_growth(
    db: Session, profile_id: int, year: int | None, account_id: int | None = None
) -> list[dict]:
    """Full profile net-worth trend, or cumulative income−expense by month when ``account_id`` is set."""
    _validate_finance_account(db, profile_id, account_id)
    y = year or date.today().year
    if account_id is not None:
        series = income_vs_expense(db, profile_id, y, account_id)
        cum = 0.0
        out = []
        for row in series:
            cum += row['savings']
            out.append({'month': row['month'], 'net_worth': cum})
        return out
    base_assets = pf_finance_repo.sum_assets(db, profile_id)
    base_inv = pf_finance_repo.sum_investments_current(db, profile_id)
    base_liab = pf_finance_repo.sum_liabilities(db, profile_id)
    base_loan = pf_finance_repo.sum_loan_outstanding(db, profile_id)
    base = base_assets + base_inv + base_loan - base_liab
    series = income_vs_expense(db, profile_id, y, None)
    cum = 0.0
    out = []
    for row in series:
        cum += row['savings']
        out.append({'month': row['month'], 'net_worth': base + cum})
    return out


def investment_allocation(db: Session, profile_id: int) -> list[dict]:
    return pf_finance_repo.investment_allocation_by_type(db, profile_id)


def recent_transactions(
    db: Session, profile_id: int, limit: int = 20, account_id: int | None = None
) -> list[dict]:
    return pf_finance_repo.list_recent_mixed(db, profile_id, limit, account_id)


def loans_analytics(db: Session, profile_id: int, year: int | None = None) -> dict:
    return pf_finance_repo.loan_dashboard_analytics(db, profile_id, year)


def cashflow_month_summary(db: Session, profile_id: int) -> dict:
    """Current calendar month: expense buckets, dairy/EMI/food splits, cash vs bank, pending EMIs."""
    today = date.today()
    start = date(today.year, today.month, 1)
    end = date(today.year, today.month, monthrange(today.year, today.month)[1])
    total_exp = pf_finance_repo.sum_expense(db, profile_id, start, end)
    food = pf_finance_repo.sum_expense_categories_exact(db, profile_id, start, end, ['Food & Groceries'])
    dairy = pf_finance_repo.sum_expense_categories_exact(
        db, profile_id, start, end, ['Dairy Farm Expenses', 'Feed']
    )
    emi_exp = pf_finance_repo.sum_expense_emi_categories(db, profile_id, start, end)
    pending = pf_finance_repo.sum_pending_loan_schedule_emis(db, profile_id)
    split = pf_finance_repo.sum_account_balances_cash_vs_bank(db, profile_id)
    return {
        'period_start': start.isoformat(),
        'period_end': end.isoformat(),
        'total_expense_month': total_exp,
        'food_expense': food,
        'emi_expense_month': emi_exp,
        'dairy_expense': dairy,
        'pending_emis_receivable': pending,
        'cash_balance': split['cash'],
        'bank_balance': split['bank'],
        'accounts_total': split['total'],
    }
