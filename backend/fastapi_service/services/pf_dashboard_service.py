from calendar import monthrange
from datetime import date, timedelta

from sqlalchemy.orm import Session

from fastapi_service.repositories import pf_finance_repo
from fastapi_service.services import pf_accounting_policy, pf_loan_ui_service


def _validate_finance_account(db: Session, profile_id: int, account_id: int | None) -> None:
    if account_id is None:
        return
    if pf_finance_repo.get_account_for_profile(db, account_id, profile_id) is None:
        raise ValueError('Account not found')


def summary(
    db: Session,
    profile_id: int,
    account_id: int | None = None,
    *,
    period_year: int | None = None,
    period_month: int | None = None,
    recent_limit: int = 20,
) -> dict:
    today = date.today()
    if period_year is not None and period_month is not None:
        start = date(period_year, period_month, 1)
        last = monthrange(period_year, period_month)[1]
        end = date(period_year, period_month, last)
        period_mode = 'month'
    else:
        start = date(today.year, 1, 1)
        end = today
        period_mode = 'ytd'
    acc = None
    if account_id is not None:
        acc = pf_finance_repo.get_account_for_profile(db, account_id, profile_id)
        if acc is None:
            raise ValueError('Account not found')
    total_income = pf_finance_repo.sum_income(db, profile_id, start, end, account_id)
    total_expense = pf_finance_repo.sum_expense(db, profile_id, start, end, account_id)
    total_investment = pf_finance_repo.sum_investments_invested(db, profile_id)
    total_assets = pf_finance_repo.sum_assets(db, profile_id)
    total_liabilities = pf_finance_repo.sum_liabilities(db, profile_id)
    split = pf_finance_repo.sum_account_balances_cash_vs_bank(db, profile_id)
    if account_id is not None:
        cash_balance = float(acc.balance)
        t = (acc.account_type or '').lower()
        is_cash_slot = 'cash' in t or 'wallet' in t or t in ('petty', 'hand')
        balance_cash = float(acc.balance) if is_cash_slot else 0.0
        balance_bank = 0.0 if is_cash_slot else float(acc.balance)
        balance_total = float(acc.balance)
    else:
        cash_balance = pf_finance_repo.sum_account_balances(db, profile_id)
        balance_cash = split['cash']
        balance_bank = split['bank']
        balance_total = split['total']
    loan_receivable = pf_finance_repo.sum_loan_outstanding(db, profile_id)
    liability_overdue = pf_finance_repo.sum_liabilities_outstanding_overdue(db, profile_id, today=today)
    liability_due_week = pf_finance_repo.liabilities_due_between(db, profile_id, today, today + timedelta(days=7))
    # Net worth: cash + investments + fixed assets (effective / depreciated book) + loans you lent
    # − liabilities. Money you borrowed is modeled as liabilities (cards, home/vehicle loans, etc.),
    # not subtracted again as a separate "loans taken" line.
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
        'liability_overdue_amount': liability_overdue,
        'liability_due_this_week': liability_due_week,
        'net_worth': net_worth,
        'cash_balance': cash_balance,
        'balance_cash': balance_cash,
        'balance_bank': balance_bank,
        'balance_total': balance_total,
        'loan_outstanding': loan_receivable,
        'loan_receivable': loan_receivable,
        'period_start': start.isoformat(),
        'period_end': end.isoformat(),
        'period_mode': period_mode,
        'recent_transactions': recent_transactions(
            db, profile_id, max(1, min(50, int(recent_limit))), account_id, start, end
        ),
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


def _networth_growth_from_ie_series(
    db: Session,
    profile_id: int,
    account_id: int | None,
    ie_series: list[dict],
) -> list[dict]:
    """Build net-worth line chart from precomputed income vs expense rows (avoids duplicate monthly queries)."""
    if account_id is not None:
        cum = 0.0
        out = []
        for row in ie_series:
            cum += row['savings']
            out.append({'month': row['month'], 'net_worth': cum})
        return out
    base_assets = pf_finance_repo.sum_assets(db, profile_id)
    base_inv = pf_finance_repo.sum_investments_invested(db, profile_id)
    base_liab = pf_finance_repo.sum_liabilities(db, profile_id)
    base_loan = pf_finance_repo.sum_loan_outstanding(db, profile_id)
    base = base_assets + base_inv + base_loan - base_liab
    cum = 0.0
    out = []
    for row in ie_series:
        cum += row['savings']
        out.append({'month': row['month'], 'net_worth': base + cum})
    return out


def networth_growth(
    db: Session, profile_id: int, year: int | None, account_id: int | None = None
) -> list[dict]:
    """Full profile net-worth trend, or cumulative income−expense by month when ``account_id`` is set."""
    _validate_finance_account(db, profile_id, account_id)
    y = year or date.today().year
    ie_series = income_vs_expense(db, profile_id, y, account_id)
    return _networth_growth_from_ie_series(db, profile_id, account_id, ie_series)


def investment_allocation(db: Session, profile_id: int) -> list[dict]:
    return pf_finance_repo.investment_allocation_by_type(db, profile_id)


def recent_transactions(
    db: Session,
    profile_id: int,
    limit: int = 20,
    account_id: int | None = None,
    start: date | None = None,
    end: date | None = None,
) -> list[dict]:
    return pf_finance_repo.list_recent_mixed(db, profile_id, limit, account_id, start, end)


def loans_analytics(
    db: Session,
    profile_id: int,
    year: int | None = None,
    *,
    pending_emi_installments_total: float | None = None,
) -> dict:
    return pf_finance_repo.loan_dashboard_analytics(
        db, profile_id, year, pending_emi_installments_total=pending_emi_installments_total
    )


def _serialize_loans_for_dashboard(db: Session, profile_id: int) -> list[dict]:
    rows = pf_loan_ui_service.list_enriched_loans(db, profile_id)
    return [r.model_dump(mode='json') for r in rows]


def upcoming_emis_preview(db: Session, profile_id: int, limit: int = 25) -> list[dict]:
    m = pf_finance_repo.next_pending_emi_by_loan(db, profile_id)
    if not m:
        return []
    loans = {l.id: l for l in pf_finance_repo.list_loans(db, profile_id)}
    items: list[dict] = []
    for lid, (due, amt) in m.items():
        ln = loans.get(lid)
        if ln is None:
            continue
        items.append(
            {
                'loan_id': lid,
                'borrower_name': ln.borrower_name,
                'due_date': due.isoformat(),
                'emi_amount': amt,
            }
        )
    items.sort(key=lambda x: x['due_date'])
    return items[:limit]


def cashflow_month_summary(
    db: Session,
    profile_id: int,
    year: int | None = None,
    month: int | None = None,
    *,
    pending_emis_receivable: float | None = None,
) -> dict:
    """Calendar month (default current): expense buckets, dairy/EMI/food splits, cash vs bank, pending EMIs."""
    today = date.today()
    y = int(year) if year is not None else today.year
    m = int(month) if month is not None else today.month
    if not (1 <= m <= 12):
        raise ValueError('Invalid month')
    start = date(y, m, 1)
    end = date(y, m, monthrange(y, m)[1])
    total_exp = pf_finance_repo.sum_expense(db, profile_id, start, end)
    food = pf_finance_repo.sum_expense_categories_exact(db, profile_id, start, end, ['Food & Groceries'])
    dairy = pf_finance_repo.sum_expense_categories_exact(
        db, profile_id, start, end, ['Dairy Farm Expenses', 'Feed']
    )
    emi_exp = pf_finance_repo.sum_expense_emi_categories(db, profile_id, start, end)
    pending = (
        float(pending_emis_receivable)
        if pending_emis_receivable is not None
        else pf_finance_repo.sum_pending_loan_schedule_emis(db, profile_id)
    )
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


def dashboard_bundle(
    db: Session,
    profile_id: int,
    account_id: int | None,
    period_year: int,
    period_month: int,
    *,
    recent_limit: int = 15,
) -> dict:
    """Single payload for the personal finance dashboard (reduces round-trips)."""
    start = date(period_year, period_month, 1)
    end = date(period_year, period_month, monthrange(period_year, period_month)[1])
    summ = summary(
        db,
        profile_id,
        account_id,
        period_year=period_year,
        period_month=period_month,
        recent_limit=recent_limit,
    )
    acc_rows = pf_finance_repo.list_accounts(db, profile_id, 0, 500)
    accounts = [
        {'id': a.id, 'account_name': a.account_name, 'account_type': a.account_type or ''}
        for a in acc_rows
    ]
    # One pass for pending EMIs (was queried twice: cashflow + loan analytics).
    pending_emi_total = pf_finance_repo.sum_pending_loan_schedule_emis(db, profile_id)
    emis_due_month = pf_finance_repo.emis_due_in_calendar_month_detail(
        db, profile_id, period_year, period_month
    )
    ie_rows = income_vs_expense(db, profile_id, period_year, account_id)
    return {
        'summary': summ,
        'income_vs_expense': ie_rows,
        'expense_by_category': expense_category(db, profile_id, start, end, account_id),
        'networth_growth': _networth_growth_from_ie_series(db, profile_id, account_id, ie_rows),
        'investment_allocation': investment_allocation(db, profile_id),
        'loans_analytics': loans_analytics(
            db, profile_id, period_year, pending_emi_installments_total=pending_emi_total
        ),
        'cashflow_month': cashflow_month_summary(
            db, profile_id, period_year, period_month, pending_emis_receivable=pending_emi_total
        ),
        'upcoming_emis': upcoming_emis_preview(db, profile_id),
        'loans': _serialize_loans_for_dashboard(db, profile_id),
        'accounts': accounts,
        'emis_due_selected_month': emis_due_month,
        'accounting_policy': {
            'version': pf_accounting_policy.POLICY_VERSION,
            'one_liner': pf_accounting_policy.SHORT_SUMMARY,
        },
    }
