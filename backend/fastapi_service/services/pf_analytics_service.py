"""
Modular analytics for Personal Finance — live aggregates (TASK 6-style paths under /pf/analytics).

Snapshot tables (TASK 5) can back these later without changing the response shape.
"""

from __future__ import annotations

from calendar import monthrange
from datetime import date, timedelta
from typing import Any, Literal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from fastapi_service.models_extended import (
    ChitFund,
    ChitFundContribution,
    CreditCard,
    CreditCardTransaction,
    FinanceAccount,
    FinanceExpense,
    FinanceIncome,
    FinanceInvestment,
    FinanceInvestmentTransaction,
    Loan,
    LoanPayment,
    PfExpenseCategory,
    PfIncomeCategory,
)
from fastapi_service.repositories import pf_analytics_repo, pf_chit_fund_repo, pf_credit_card_repo, pf_finance_repo

Granularity = Literal['daily', 'monthly']

ANALYTICS_MODULES: frozenset[str] = frozenset(
    {
        'expenses',
        'income',
        'accounts',
        'movements',
        'cash-flow',
        'credit-cards',
        'loans',
        'investments',
        'liabilities',
        'assets',
        'financial-statement',
        'reports',
    }
)


def _month_bounds(y: int, m: int) -> tuple[date, date]:
    return pf_analytics_repo.month_date_bounds(y, m)


def _pct_change(cur: float, prev: float) -> float | None:
    if prev <= 0.01:
        return None
    return round((cur - prev) / prev * 100, 1)


def _kpis_from_amounts(amounts: list[float], *, inflow: float, outflow: float) -> dict[str, Any]:
    tot = sum(amounts)
    net = inflow - outflow
    n = len(amounts)
    avg = round(tot / n, 2) if n else 0.0
    hi = round(max(amounts), 2) if amounts else 0.0
    lo = round(min(amounts), 2) if amounts else 0.0
    return {
        'total_amount': round(tot, 2),
        'inflow': round(inflow, 2),
        'outflow': round(outflow, 2),
        'net_change': round(net, 2),
        'average': avg,
        'highest': hi,
        'lowest': lo,
    }


def _expenses_context(
    db: Session,
    profile_id: int,
    year: int,
    month: int,
    *,
    account_id: int | None,
    expense_category_id: int | None,
) -> dict[str, Any]:
    start, end = _month_bounds(year, month)
    total = pf_finance_repo.sum_expense_scoped(
        db,
        profile_id,
        start,
        end,
        account_id=account_id,
        expense_category_id=expense_category_id,
    )
    daily = pf_analytics_repo.expense_daily_series(
        db, profile_id, start, end, account_id=account_id, expense_category_id=expense_category_id
    )
    amounts = [v for _, v in daily]
    pm, py = (month - 1, year) if month > 1 else (12, year - 1)
    ps, pe = _month_bounds(py, pm)
    prev_total = pf_finance_repo.sum_expense_scoped(
        db,
        profile_id,
        ps,
        pe,
        account_id=account_id,
        expense_category_id=expense_category_id,
    )
    income_m = pf_finance_repo.sum_income_scoped(db, profile_id, start, end, account_id=account_id)
    kpis = _kpis_from_amounts(amounts, inflow=0.0, outflow=round(float(total), 2))
    kpis['total_amount'] = round(float(total), 2)
    kpis['net_change'] = round(-float(total), 2)
    return {
        'period': {'start': start.isoformat(), 'end': end.isoformat(), 'month': f'{year:04d}-{month:02d}'},
        'kpis': kpis,
        'daily_pairs': daily,
        'prev_month_total': round(float(prev_total), 2),
        'month_over_month_pct': _pct_change(float(total), float(prev_total)),
        'income_same_month': round(float(income_m), 2),
    }


def expenses_summary(
    db: Session,
    profile_id: int,
    *,
    year: int,
    month: int,
    account_id: int | None = None,
    expense_category_id: int | None = None,
) -> dict[str, Any]:
    ctx = _expenses_context(db, profile_id, year, month, account_id=account_id, expense_category_id=expense_category_id)
    return {
        'module': 'expenses',
        'period': ctx['period'],
        'filters': {'account_id': account_id, 'expense_category_id': expense_category_id},
        'kpis': ctx['kpis'],
        'comparison': {
            'prior_month_total': ctx['prev_month_total'],
            'month_over_month_pct': ctx['month_over_month_pct'],
            'income_same_month': ctx['income_same_month'],
        },
    }


def expenses_trend(
    db: Session,
    profile_id: int,
    *,
    granularity: Granularity,
    year: int,
    month: int | None = None,
    account_id: int | None = None,
    expense_category_id: int | None = None,
) -> dict[str, Any]:
    if granularity == 'daily':
        if month is None:
            month = date.today().month
        start, end = _month_bounds(year, month)
        rows = pf_analytics_repo.expense_daily_series(
            db, profile_id, start, end, account_id=account_id, expense_category_id=expense_category_id
        )
        series = [{'label': d.isoformat(), 'date': d.isoformat(), 'amount': round(v, 2)} for d, v in rows]
        return {'module': 'expenses', 'granularity': 'daily', 'series': series}
    rows = pf_analytics_repo.expense_monthly_series_year(
        db, profile_id, year, account_id=account_id, expense_category_id=expense_category_id
    )
    series = [{'label': k, 'month': k, 'amount': round(v, 2)} for k, v in rows]
    return {'module': 'expenses', 'granularity': 'monthly', 'series': series}


def expenses_distribution(
    db: Session,
    profile_id: int,
    *,
    year: int,
    month: int,
    account_id: int | None = None,
    expense_category_id: int | None = None,
) -> dict[str, Any]:
    start, end = _month_bounds(year, month)
    cats = pf_finance_repo.expense_by_category_scoped(
        db,
        profile_id,
        start,
        end,
        account_id=account_id,
        expense_category_id=expense_category_id,
    )
    return {
        'module': 'expenses',
        'period': {'start': start.isoformat(), 'end': end.isoformat()},
        'slices': [{'name': n, 'value': round(v, 2)} for n, v in cats],
    }


def expenses_table(
    db: Session,
    profile_id: int,
    *,
    granularity: Granularity,
    year: int,
    month: int | None = None,
    account_id: int | None = None,
    expense_category_id: int | None = None,
) -> dict[str, Any]:
    trend = expenses_trend(
        db,
        profile_id,
        granularity=granularity,
        year=year,
        month=month,
        account_id=account_id,
        expense_category_id=expense_category_id,
    )
    return {'module': 'expenses', 'granularity': trend['granularity'], 'rows': trend['series']}


def expenses_insights(
    db: Session,
    profile_id: int,
    *,
    year: int,
    month: int,
    account_id: int | None = None,
    expense_category_id: int | None = None,
) -> dict[str, Any]:
    ctx = _expenses_context(db, profile_id, year, month, account_id=account_id, expense_category_id=expense_category_id)
    daily = ctx['daily_pairs']
    bullets: list[str] = []
    if daily:
        top_d, top_v = max(daily, key=lambda x: x[1])
        bullets.append(f'Highest spending day: {top_d.isoformat()} ({top_v:,.2f}).')
        nz = [v for _, v in daily if v > 0.01]
        if nz:
            bullets.append(f'Average on days with spend: {sum(nz) / len(nz):,.2f}.')
    if ctx['month_over_month_pct'] is not None:
        p = ctx['month_over_month_pct']
        bullets.append(f'Month-over-month vs prior: {p:+.1f}%.')
    if ctx['income_same_month'] > 0.01 and ctx['kpis']['outflow'] > ctx['income_same_month']:
        bullets.append('Warning: expenses exceed recorded income for this month (cashflow risk).')
    elif ctx['income_same_month'] <= 0.01 and ctx['kpis']['outflow'] > 0.01:
        bullets.append('Note: no income recorded this month while expenses exist.')
    return {'module': 'expenses', 'insights': bullets, 'warnings': [b for b in bullets if b.lower().startswith('warning')]}


def _income_context(
    db: Session,
    profile_id: int,
    year: int,
    month: int,
    *,
    account_id: int | None,
    income_category_id: int | None,
) -> dict[str, Any]:
    start, end = _month_bounds(year, month)
    total = pf_finance_repo.sum_income_scoped(
        db,
        profile_id,
        start,
        end,
        account_id=account_id,
        income_category_id=income_category_id,
    )
    daily = pf_analytics_repo.income_daily_series(
        db, profile_id, start, end, account_id=account_id, income_category_id=income_category_id
    )
    amounts = [v for _, v in daily]
    pm, py = (month - 1, year) if month > 1 else (12, year - 1)
    ps, pe = _month_bounds(py, pm)
    prev_total = pf_finance_repo.sum_income_scoped(
        db,
        profile_id,
        ps,
        pe,
        account_id=account_id,
        income_category_id=income_category_id,
    )
    kpis = _kpis_from_amounts(amounts, inflow=round(float(total), 2), outflow=0.0)
    kpis['total_amount'] = round(float(total), 2)
    kpis['net_change'] = round(float(total), 2)
    return {
        'period': {'start': start.isoformat(), 'end': end.isoformat(), 'month': f'{year:04d}-{month:02d}'},
        'kpis': kpis,
        'daily_pairs': daily,
        'prev_month_total': round(float(prev_total), 2),
        'month_over_month_pct': _pct_change(float(total), float(prev_total)),
    }


def income_summary(
    db: Session,
    profile_id: int,
    *,
    year: int,
    month: int,
    account_id: int | None = None,
    income_category_id: int | None = None,
) -> dict[str, Any]:
    ctx = _income_context(db, profile_id, year, month, account_id=account_id, income_category_id=income_category_id)
    return {
        'module': 'income',
        'period': ctx['period'],
        'filters': {'account_id': account_id, 'income_category_id': income_category_id},
        'kpis': ctx['kpis'],
        'comparison': {
            'prior_month_total': ctx['prev_month_total'],
            'month_over_month_pct': ctx['month_over_month_pct'],
        },
    }


def income_trend(
    db: Session,
    profile_id: int,
    *,
    granularity: Granularity,
    year: int,
    month: int | None = None,
    account_id: int | None = None,
    income_category_id: int | None = None,
) -> dict[str, Any]:
    if granularity == 'daily':
        if month is None:
            month = date.today().month
        start, end = _month_bounds(year, month)
        rows = pf_analytics_repo.income_daily_series(
            db, profile_id, start, end, account_id=account_id, income_category_id=income_category_id
        )
        series = [{'label': d.isoformat(), 'date': d.isoformat(), 'amount': round(v, 2)} for d, v in rows]
        return {'module': 'income', 'granularity': 'daily', 'series': series}
    rows = pf_analytics_repo.income_monthly_series_year(
        db, profile_id, year, account_id=account_id, income_category_id=income_category_id
    )
    series = [{'label': k, 'month': k, 'amount': round(v, 2)} for k, v in rows]
    return {'module': 'income', 'granularity': 'monthly', 'series': series}


def income_distribution(
    db: Session,
    profile_id: int,
    *,
    year: int,
    month: int,
    account_id: int | None = None,
    income_category_id: int | None = None,
) -> dict[str, Any]:
    start, end = _month_bounds(year, month)
    if income_category_id is not None:
        row = db.get(PfIncomeCategory, income_category_id)
        label = row.name if row is not None else f'Category #{income_category_id}'
        t = pf_finance_repo.sum_income_scoped(
            db, profile_id, start, end, account_id=account_id, income_category_id=income_category_id
        )
        cats = [(label, float(t))]
    else:
        cats = pf_finance_repo.income_by_category(db, profile_id, start, end, account_id=account_id)
    return {
        'module': 'income',
        'period': {'start': start.isoformat(), 'end': end.isoformat()},
        'slices': [{'name': n, 'value': round(v, 2)} for n, v in cats],
    }


def income_table(
    db: Session,
    profile_id: int,
    *,
    granularity: Granularity,
    year: int,
    month: int | None = None,
    account_id: int | None = None,
    income_category_id: int | None = None,
) -> dict[str, Any]:
    t = income_trend(
        db,
        profile_id,
        granularity=granularity,
        year=year,
        month=month,
        account_id=account_id,
        income_category_id=income_category_id,
    )
    return {'module': 'income', 'granularity': t['granularity'], 'rows': t['series']}


def income_insights(
    db: Session,
    profile_id: int,
    *,
    year: int,
    month: int,
    account_id: int | None = None,
    income_category_id: int | None = None,
) -> dict[str, Any]:
    ctx = _income_context(db, profile_id, year, month, account_id=account_id, income_category_id=income_category_id)
    bullets: list[str] = []
    daily = ctx['daily_pairs']
    if daily:
        top_d, top_v = max(daily, key=lambda x: x[1])
        bullets.append(f'Highest income day: {top_d.isoformat()} ({top_v:,.2f}).')
    if ctx['month_over_month_pct'] is not None:
        bullets.append(f'Month-over-month vs prior: {ctx["month_over_month_pct"]:+.1f}%.')
    return {'module': 'income', 'insights': bullets, 'warnings': []}


def _accounts_daily_net_per_calendar_day(
    db: Session,
    profile_id: int,
    *,
    start: date,
    end: date,
    account_id: int | None,
) -> list[float]:
    """One value per calendar day in [start, end]: income − expense for that day (0 if none)."""
    inc = pf_analytics_repo.income_daily_series(db, profile_id, start, end, account_id=account_id)
    exp = pf_analytics_repo.expense_daily_series(db, profile_id, start, end, account_id=account_id)
    by_date: dict[date, dict[str, float]] = {}
    for d, v in inc:
        by_date.setdefault(d, {'inflow': 0.0, 'outflow': 0.0})
        by_date[d]['inflow'] += float(v)
    for d, v in exp:
        by_date.setdefault(d, {'inflow': 0.0, 'outflow': 0.0})
        by_date[d]['outflow'] += float(v)
    nets: list[float] = []
    cur = start
    while cur <= end:
        x = by_date.get(cur, {'inflow': 0.0, 'outflow': 0.0})
        nets.append(x['inflow'] - x['outflow'])
        cur += timedelta(days=1)
    return nets


def accounts_summary(
    db: Session,
    profile_id: int,
    *,
    year: int,
    month: int,
    account_id: int | None = None,
) -> dict[str, Any]:
    start, end = _month_bounds(year, month)
    if account_id is not None:
        acc = pf_finance_repo.get_account_for_profile(db, account_id, profile_id)
        total_bal = float(acc.balance) if acc is not None else 0.0
        by_type = (
            {pf_finance_repo.canonical_account_type(acc): float(acc.balance)}
            if acc is not None
            else {}
        )
    else:
        total_bal = float(pf_finance_repo.sum_account_balances(db, profile_id))
        by_type = pf_finance_repo.sum_balances_by_account_type(db, profile_id)
    inc = pf_finance_repo.sum_income_scoped(db, profile_id, start, end, account_id=account_id)
    exp = pf_finance_repo.sum_expense_scoped(db, profile_id, start, end, account_id=account_id)
    chit = pf_chit_fund_repo.sum_net_asset_value_profile(db, profile_id)

    daily_nets = _accounts_daily_net_per_calendar_day(db, profile_id, start=start, end=end, account_id=account_id)
    if daily_nets:
        avg_dn = sum(daily_nets) / len(daily_nets)
        hi_dn = max(daily_nets)
        lo_dn = min(daily_nets)
    else:
        avg_dn = hi_dn = lo_dn = 0.0

    return {
        'module': 'accounts',
        'period': {'start': start.isoformat(), 'end': end.isoformat(), 'month': f'{year:04d}-{month:02d}'},
        'filters': {'account_id': account_id},
        'kpis': {
            'total_amount': round(float(total_bal), 2),
            'inflow': round(float(inc), 2),
            'outflow': round(float(exp), 2),
            'net_change': round(float(inc) - float(exp), 2),
            'average': round(avg_dn, 2),
            'highest': round(hi_dn, 2),
            'lowest': round(lo_dn, 2),
        },
        'kpi_notes': {
            'average': 'Mean daily net (income − expense) across every day in the selected month.',
            'highest': 'Best single-day net in the month.',
            'lowest': 'Weakest single-day net in the month.',
            'total_amount': 'Current book balance (all accounts or filtered account).',
        },
        'balances_by_type': {k: round(float(v), 2) for k, v in by_type.items()},
        'chit_funds_net_asset': round(float(chit), 2),
    }


def accounts_trend(
    db: Session,
    profile_id: int,
    *,
    granularity: Granularity,
    year: int,
    month: int | None = None,
    account_id: int | None = None,
) -> dict[str, Any]:
    if granularity == 'daily':
        if month is None:
            month = date.today().month
        start, end = _month_bounds(year, month)
        inc = pf_analytics_repo.income_daily_series(db, profile_id, start, end, account_id=account_id)
        exp = pf_analytics_repo.expense_daily_series(db, profile_id, start, end, account_id=account_id)
        by_date: dict[str, dict[str, float]] = {}
        for d, v in inc:
            by_date.setdefault(d.isoformat(), {'inflow': 0.0, 'outflow': 0.0})
            by_date[d.isoformat()]['inflow'] += float(v)
        for d, v in exp:
            by_date.setdefault(d.isoformat(), {'inflow': 0.0, 'outflow': 0.0})
            by_date[d.isoformat()]['outflow'] += float(v)
        keys = sorted(by_date.keys())
        series = [
            {
                'label': k,
                'date': k,
                'inflow': round(by_date[k]['inflow'], 2),
                'outflow': round(by_date[k]['outflow'], 2),
                'net': round(by_date[k]['inflow'] - by_date[k]['outflow'], 2),
            }
            for k in keys
        ]
        return {'module': 'accounts', 'granularity': 'daily', 'series': series}
    im = pf_analytics_repo.income_monthly_series_year(db, profile_id, year, account_id=account_id)
    ex = pf_analytics_repo.expense_monthly_series_year(db, profile_id, year, account_id=account_id)
    mm = {k: {'inflow': v, 'outflow': 0.0} for k, v in im}
    for k, v in ex:
        mm.setdefault(k, {'inflow': 0.0, 'outflow': 0.0})
        mm[k]['outflow'] += float(v)
    keys = sorted(mm.keys())
    series = [
        {
            'label': k,
            'month': k,
            'inflow': round(mm[k]['inflow'], 2),
            'outflow': round(mm[k]['outflow'], 2),
            'net': round(mm[k]['inflow'] - mm[k]['outflow'], 2),
        }
        for k in keys
    ]
    return {'module': 'accounts', 'granularity': 'monthly', 'series': series}


def accounts_distribution(
    db: Session,
    profile_id: int,
    *,
    year: int,
    month: int,
) -> dict[str, Any]:
    by_type = pf_finance_repo.sum_balances_by_account_type(db, profile_id)
    return {
        'module': 'accounts',
        'slices': [{'name': k, 'value': round(float(v), 2)} for k, v in sorted(by_type.items(), key=lambda x: -x[1])],
    }


def accounts_table(
    db: Session,
    profile_id: int,
    *,
    granularity: Granularity,
    year: int,
    month: int | None = None,
    account_id: int | None = None,
) -> dict[str, Any]:
    t = accounts_trend(db, profile_id, granularity=granularity, year=year, month=month, account_id=account_id)
    return {'module': 'accounts', 'granularity': t['granularity'], 'rows': t['series']}


def accounts_insights(
    db: Session,
    profile_id: int,
    *,
    year: int,
    month: int,
    account_id: int | None = None,
) -> dict[str, Any]:
    start, end = _month_bounds(year, month)
    exp = pf_finance_repo.sum_expense_scoped(db, profile_id, start, end, account_id=account_id)
    inc = pf_finance_repo.sum_income_scoped(db, profile_id, start, end, account_id=account_id)
    bullets = [f'Net P&L cash (income − expense) for month: {inc - exp:,.2f}.']
    if exp > inc and inc > 0.01:
        bullets.append('Warning: expenses exceeded income for this month.')
    return {'module': 'accounts', 'insights': bullets, 'warnings': [b for b in bullets if 'Warning' in b]}


def financial_statement_summary(
    db: Session,
    profile_id: int,
    *,
    year: int,
    month: int,
    account_id: int | None = None,
) -> dict[str, Any]:
    """P&L-style summary: income vs expense for the month (optional account scope)."""
    start, end = _month_bounds(year, month)
    inc = float(
        pf_finance_repo.sum_income_scoped(db, profile_id, start, end, account_id=account_id, income_category_id=None)
    )
    exp = float(
        pf_finance_repo.sum_expense_scoped(
            db, profile_id, start, end, account_id=account_id, expense_category_id=None
        )
    )
    daily_nets = _accounts_daily_net_per_calendar_day(db, profile_id, start=start, end=end, account_id=account_id)
    if daily_nets:
        avg_dn = sum(daily_nets) / len(daily_nets)
        hi_dn = max(daily_nets)
        lo_dn = min(daily_nets)
    else:
        avg_dn = hi_dn = lo_dn = 0.0
    pm, py = (month - 1, year) if month > 1 else (12, year - 1)
    ps, pe = _month_bounds(py, pm)
    pinc = float(pf_finance_repo.sum_income_scoped(db, profile_id, ps, pe, account_id=account_id))
    pexp = float(pf_finance_repo.sum_expense_scoped(db, profile_id, ps, pe, account_id=account_id))
    cur_net = inc - exp
    prev_net = pinc - pexp
    return {
        'module': 'financial-statement',
        'period': {'start': start.isoformat(), 'end': end.isoformat(), 'month': f'{year:04d}-{month:02d}'},
        'filters': {'account_id': account_id},
        'kpis': {
            'total_amount': round(inc + exp, 2),
            'inflow': round(inc, 2),
            'outflow': round(exp, 2),
            'net_change': round(cur_net, 2),
            'average': round(avg_dn, 2),
            'highest': round(hi_dn, 2),
            'lowest': round(lo_dn, 2),
        },
        'kpi_notes': {
            'total_amount': 'Income plus expense (total activity) for the month.',
            'inflow': 'Recorded income in scope.',
            'outflow': 'Recorded expenses in scope.',
            'average': 'Mean daily net (income − expense) across every day in the month.',
            'highest': 'Best single-day net in the month.',
            'lowest': 'Weakest single-day net in the month.',
        },
        'comparison': {
            'prior_month_total': round(prev_net, 2),
            'month_over_month_pct': _pct_change(cur_net, prev_net),
        },
        'partial': False,
    }


def financial_statement_trend(
    db: Session,
    profile_id: int,
    *,
    granularity: Granularity,
    year: int,
    month: int | None = None,
    account_id: int | None = None,
) -> dict[str, Any]:
    t = accounts_trend(
        db, profile_id, granularity=granularity, year=year, month=month, account_id=account_id
    )
    t['module'] = 'financial-statement'
    return t


def financial_statement_distribution(
    db: Session,
    profile_id: int,
    *,
    year: int,
    month: int,
    account_id: int | None = None,
) -> dict[str, Any]:
    """Combined income + expense category slices (prefixed) for pie/bar."""
    start, end = _month_bounds(year, month)
    exp_rows = pf_finance_repo.expense_by_category_scoped(
        db, profile_id, start, end, account_id=account_id, expense_category_id=None
    )
    inc_rows = pf_finance_repo.income_by_category(db, profile_id, start, end, account_id=account_id)
    merged: list[dict[str, Any]] = []
    for n, v in exp_rows:
        label = (n or '').strip() or '(Uncategorized expense)'
        merged.append({'name': f'Expense · {label[:40]}', 'value': round(float(v), 2)})
    for n, v in inc_rows:
        label = (n or '').strip() or '(Uncategorized income)'
        merged.append({'name': f'Income · {label[:40]}', 'value': round(float(v), 2)})
    merged.sort(key=lambda x: -x['value'])
    return {
        'module': 'financial-statement',
        'period': {'start': start.isoformat(), 'end': end.isoformat()},
        'slices': merged[:18],
    }


def financial_statement_table(
    db: Session,
    profile_id: int,
    *,
    granularity: Granularity,
    year: int,
    month: int | None = None,
    account_id: int | None = None,
) -> dict[str, Any]:
    t = financial_statement_trend(
        db, profile_id, granularity=granularity, year=year, month=month, account_id=account_id
    )
    return {'module': 'financial-statement', 'granularity': t['granularity'], 'rows': t['series']}


def financial_statement_insights(
    db: Session,
    profile_id: int,
    *,
    year: int,
    month: int,
    account_id: int | None = None,
) -> dict[str, Any]:
    start, end = _month_bounds(year, month)
    inc = float(pf_finance_repo.sum_income_scoped(db, profile_id, start, end, account_id=account_id))
    exp = float(pf_finance_repo.sum_expense_scoped(db, profile_id, start, end, account_id=account_id))
    bullets: list[str] = [
        f'Income statement for period: income {inc:,.2f}, expense {exp:,.2f}, net {inc - exp:,.2f}.',
    ]
    summ = financial_statement_summary(db, profile_id, year=year, month=month, account_id=account_id)
    mom = summ.get('comparison', {}).get('month_over_month_pct')
    if mom is not None:
        bullets.append(f'Net result vs prior month: {mom:+.1f}%.')
    if exp > inc + 0.01 and inc > 0.01:
        bullets.append('Warning: expenses exceeded income this month.')
    elif inc <= 0.01 and exp > 0.01:
        bullets.append('Note: expenses recorded with no income in scope for this month.')
    if not inc and not exp:
        bullets.append('No income or expense entries in this scope for the selected month.')
    return {
        'module': 'financial-statement',
        'insights': bullets,
        'warnings': [b for b in bullets if b.lower().startswith('warning')],
    }


def _cashflow_ledger_filtered(
    db: Session,
    profile_id: int,
    *,
    start: date,
    end: date,
    account_id: int | None = None,
) -> dict[str, float]:
    # Internal transfers and CC bill payments are excluded from net cashflow.
    # They are movement between owned pockets / settlement of already-booked card spend.
    ledger_types = (
        'EXTERNAL_DEPOSIT',
        'EXTERNAL_WITHDRAWAL',
        'LOAN_DISBURSEMENT',
        'LOAN_LIABILITY_PAYMENT',
        'LOAN_EMI_PAYMENT',
        'CHIT_AUCTION_RECEIPT',
        'CHIT_CONTRIBUTION',
    )
    raw = pf_finance_repo.sum_account_transaction_amounts_by_type(
        db, profile_id, start, end, ledger_types
    )
    if account_id is not None:
        # account scoped views keep only income/expense and investment legs;
        # ledger splits are full-profile in current repo helpers.
        return {}
    return {k: float(v) for k, v in raw.items()}


def _cashflow_investment_pairs(
    db: Session, profile_id: int, *, start: date, end: date, granularity: Granularity
) -> list[tuple[str, float, float, float]]:
    if granularity == 'daily':
        rows = pf_analytics_repo.investment_txn_daily_series(db, profile_id, start, end)
        out: list[tuple[str, float, float, float]] = []
        for d, amt in rows:
            a = float(amt)
            out.append((d.isoformat(), max(0.0, a), abs(min(0.0, a)), a))
        return out
    rows_m = pf_analytics_repo.investment_txn_monthly_series_year(db, profile_id, start.year)
    out_m: list[tuple[str, float, float, float]] = []
    for ym, amt in rows_m:
        if not str(ym).startswith(f'{start.year:04d}-'):
            continue
        a = float(amt)
        out_m.append((str(ym), max(0.0, a), abs(min(0.0, a)), a))
    return out_m


def _period_key(d: date, granularity: Granularity) -> str:
    return d.isoformat() if granularity == 'daily' else f'{d.year:04d}-{d.month:02d}'


def _top_entities(entity_totals: dict[str, float], limit: int = 6) -> list[str]:
    return [k for k, _ in sorted(entity_totals.items(), key=lambda x: abs(x[1]), reverse=True)[:limit]]


def _build_breakdown_data(
    db: Session,
    profile_id: int,
    *,
    breakdown: str,
    granularity: Granularity,
    start: date,
    end: date,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    """
    Returns:
    - aggregate_series: [{label,inflow,outflow,net}]
    - entities: [{name,total_net,total_inflow,total_outflow,series:[...]}]
    - detailed_rows: [{label,source,type,inflow,outflow,net}]
    """
    b = str(breakdown or 'all').strip().lower()
    by_pair: dict[tuple[str, str], dict[str, float]] = {}

    def add(period: str, source: str, inflow: float = 0.0, outflow: float = 0.0) -> None:
        if not period or not source:
            return
        k = (period, source)
        slot = by_pair.setdefault(k, {'inflow': 0.0, 'outflow': 0.0})
        slot['inflow'] += float(inflow or 0.0)
        slot['outflow'] += float(outflow or 0.0)

    # Banks/accounts
    if b in ('banks', 'all'):
        inc_rows = db.execute(
            select(FinanceIncome.entry_date, FinanceAccount.account_name, func.coalesce(func.sum(FinanceIncome.amount), 0))
            .select_from(FinanceIncome)
            .join(FinanceAccount, FinanceAccount.id == FinanceIncome.account_id, isouter=True)
            .where(
                FinanceIncome.profile_id == profile_id,
                FinanceIncome.entry_date >= start,
                FinanceIncome.entry_date <= end,
            )
            .group_by(FinanceIncome.entry_date, FinanceAccount.account_name)
        ).all()
        for d, n, v in inc_rows:
            add(_period_key(d, granularity), n or 'Unassigned account', inflow=float(v))

        exp_rows = db.execute(
            select(FinanceExpense.entry_date, FinanceAccount.account_name, func.coalesce(func.sum(FinanceExpense.amount), 0))
            .select_from(FinanceExpense)
            .join(FinanceAccount, FinanceAccount.id == FinanceExpense.account_id, isouter=True)
            .where(
                FinanceExpense.profile_id == profile_id,
                FinanceExpense.entry_date >= start,
                FinanceExpense.entry_date <= end,
            )
            .group_by(FinanceExpense.entry_date, FinanceAccount.account_name)
        ).all()
        for d, n, v in exp_rows:
            add(_period_key(d, granularity), n or 'Unassigned account', outflow=float(v))

    # Cards
    if b in ('cards', 'all'):
        cc_rows = db.execute(
            select(CreditCardTransaction.transaction_date, CreditCard.card_name, func.coalesce(func.sum(CreditCardTransaction.amount), 0))
            .select_from(CreditCardTransaction)
            .join(CreditCard, CreditCard.id == CreditCardTransaction.card_id)
            .where(
                CreditCard.profile_id == profile_id,
                CreditCardTransaction.transaction_date >= start,
                CreditCardTransaction.transaction_date <= end,
            )
            .group_by(CreditCardTransaction.transaction_date, CreditCard.card_name)
        ).all()
        for d, n, v in cc_rows:
            add(_period_key(d, granularity), n or 'Credit card', outflow=float(v))

    # Expenses
    if b in ('expenses', 'all'):
        ex_rows = db.execute(
            select(FinanceExpense.entry_date, PfExpenseCategory.name, FinanceExpense.category, func.coalesce(func.sum(FinanceExpense.amount), 0))
            .select_from(FinanceExpense)
            .join(PfExpenseCategory, PfExpenseCategory.id == FinanceExpense.expense_category_id, isouter=True)
            .where(
                FinanceExpense.profile_id == profile_id,
                FinanceExpense.entry_date >= start,
                FinanceExpense.entry_date <= end,
            )
            .group_by(FinanceExpense.entry_date, PfExpenseCategory.name, FinanceExpense.category)
        ).all()
        for d, n, c, v in ex_rows:
            add(_period_key(d, granularity), n or c or 'Expense', outflow=float(v))

    # Income
    if b in ('income', 'all'):
        in_rows = db.execute(
            select(FinanceIncome.entry_date, PfIncomeCategory.name, FinanceIncome.category, func.coalesce(func.sum(FinanceIncome.amount), 0))
            .select_from(FinanceIncome)
            .join(PfIncomeCategory, PfIncomeCategory.id == FinanceIncome.income_category_id, isouter=True)
            .where(
                FinanceIncome.profile_id == profile_id,
                FinanceIncome.entry_date >= start,
                FinanceIncome.entry_date <= end,
            )
            .group_by(FinanceIncome.entry_date, PfIncomeCategory.name, FinanceIncome.category)
        ).all()
        for d, n, c, v in in_rows:
            add(_period_key(d, granularity), n or c or 'Income', inflow=float(v))

    # Investments
    if b in ('investments', 'all'):
        inv_rows = db.execute(
            select(FinanceInvestmentTransaction.txn_date, FinanceInvestment.name, func.coalesce(func.sum(FinanceInvestmentTransaction.amount), 0))
            .select_from(FinanceInvestmentTransaction)
            .join(FinanceInvestment, FinanceInvestment.id == FinanceInvestmentTransaction.investment_id)
            .where(
                FinanceInvestment.profile_id == profile_id,
                FinanceInvestmentTransaction.txn_date >= start,
                FinanceInvestmentTransaction.txn_date <= end,
            )
            .group_by(FinanceInvestmentTransaction.txn_date, FinanceInvestment.name)
        ).all()
        for d, n, v in inv_rows:
            amt = float(v)
            add(_period_key(d, granularity), n or 'Investment', inflow=max(0.0, amt), outflow=abs(min(0.0, amt)))

    # Loans
    if b in ('loans', 'all'):
        lp_rows = db.execute(
            select(LoanPayment.payment_date, Loan.borrower_name, func.coalesce(func.sum(LoanPayment.total_paid), 0))
            .select_from(LoanPayment)
            .join(Loan, Loan.id == LoanPayment.loan_id)
            .where(
                Loan.profile_id == profile_id,
                LoanPayment.payment_date >= start,
                LoanPayment.payment_date <= end,
            )
            .group_by(LoanPayment.payment_date, Loan.borrower_name)
        ).all()
        for d, n, v in lp_rows:
            add(_period_key(d, granularity), n or 'Loan repayment', outflow=float(v))

    # Chit
    if b in ('chit', 'all'):
        ch_rows = db.execute(
            select(ChitFundContribution.contribution_date, ChitFund.chit_name, func.coalesce(func.sum(ChitFundContribution.amount), 0))
            .select_from(ChitFundContribution)
            .join(ChitFund, ChitFund.id == ChitFundContribution.chit_fund_id)
            .where(
                ChitFund.profile_id == profile_id,
                ChitFundContribution.contribution_date >= start,
                ChitFundContribution.contribution_date <= end,
            )
            .group_by(ChitFundContribution.contribution_date, ChitFund.chit_name)
        ).all()
        for d, n, v in ch_rows:
            add(_period_key(d, granularity), n or 'Chit contribution', outflow=float(v))
        auc_rows = db.execute(
            select(ChitFund.start_date, ChitFund.chit_name, ChitFund.amount_received)
            .where(
                ChitFund.profile_id == profile_id,
                ChitFund.amount_received.is_not(None),
                ChitFund.start_date >= start,
                ChitFund.start_date <= end,
            )
        ).all()
        for d, n, v in auc_rows:
            add(_period_key(d, granularity), n or 'Chit receipt', inflow=float(v or 0))

    if not by_pair:
        return [], [], []

    # Build detailed rows
    detailed_rows: list[dict[str, Any]] = []
    periods = sorted({p for p, _ in by_pair.keys()})
    entity_totals: dict[str, float] = {}
    for (p, src), vals in by_pair.items():
        net = float(vals['inflow']) - float(vals['outflow'])
        entity_totals[src] = entity_totals.get(src, 0.0) + net
        detailed_rows.append(
            {
                'label': p,
                'source': src,
                'type': 'inflow' if net >= 0 else 'outflow',
                'inflow': round(float(vals['inflow']), 2),
                'outflow': round(float(vals['outflow']), 2),
                'net': round(net, 2),
            }
        )
    detailed_rows.sort(key=lambda r: (r['label'], -abs(float(r['net']))))

    top_names = _top_entities(entity_totals, limit=6)
    if len(entity_totals) > len(top_names):
        top_names.append('Others')
    entity_series_map: dict[str, dict[str, dict[str, float]]] = {n: {} for n in top_names}
    for (p, src), vals in by_pair.items():
        key = src if src in top_names else 'Others'
        slot = entity_series_map[key].setdefault(p, {'inflow': 0.0, 'outflow': 0.0})
        slot['inflow'] += float(vals['inflow'])
        slot['outflow'] += float(vals['outflow'])

    entities: list[dict[str, Any]] = []
    for name in top_names:
        pdata = []
        t_in = t_out = 0.0
        for p in periods:
            v = entity_series_map[name].get(p, {'inflow': 0.0, 'outflow': 0.0})
            n = float(v['inflow']) - float(v['outflow'])
            t_in += float(v['inflow'])
            t_out += float(v['outflow'])
            pdata.append({'label': p, 'inflow': round(float(v['inflow']), 2), 'outflow': round(float(v['outflow']), 2), 'net': round(n, 2)})
        entities.append({'name': name, 'total_inflow': round(t_in, 2), 'total_outflow': round(t_out, 2), 'total_net': round(t_in - t_out, 2), 'series': pdata})

    aggregate_series = []
    for p in periods:
        i = o = 0.0
        for e in entities:
            row = next((x for x in e['series'] if x['label'] == p), None)
            if row is None:
                continue
            i += float(row['inflow'])
            o += float(row['outflow'])
        aggregate_series.append(
            {
                'label': p,
                'inflow': round(i, 2),
                'outflow': round(o, 2),
                'net': round(i - o, 2),
                'date': p if granularity == 'daily' else None,
                'month': p if granularity == 'monthly' else None,
            }
        )
    return aggregate_series, entities, detailed_rows


def cash_flow_summary(
    db: Session,
    profile_id: int,
    *,
    year: int,
    month: int,
    account_id: int | None = None,
    breakdown: str = 'all',
) -> dict[str, Any]:
    start, end = _month_bounds(year, month)
    inc = float(pf_finance_repo.sum_income_scoped(db, profile_id, start, end, account_id=account_id))
    exp = float(pf_finance_repo.sum_expense_scoped(db, profile_id, start, end, account_id=account_id))
    led = _cashflow_ledger_filtered(db, profile_id, start=start, end=end, account_id=account_id)
    inv_rows = pf_analytics_repo.investment_txn_daily_series(db, profile_id, start, end)
    inv_pos = sum(max(0.0, float(v)) for _, v in inv_rows)
    inv_neg = sum(abs(min(0.0, float(v))) for _, v in inv_rows)
    inflow = inc + float(led.get('EXTERNAL_DEPOSIT', 0.0)) + float(led.get('CHIT_AUCTION_RECEIPT', 0.0)) + inv_pos
    outflow = (
        exp
        + float(led.get('EXTERNAL_WITHDRAWAL', 0.0))
        + float(led.get('LOAN_DISBURSEMENT', 0.0))
        + float(led.get('LOAN_LIABILITY_PAYMENT', 0.0))
        + float(led.get('LOAN_EMI_PAYMENT', 0.0))
        + float(led.get('CHIT_CONTRIBUTION', 0.0))
        + inv_neg
    )
    days = max(1, (end - start).days + 1)
    net = inflow - outflow
    burn = max(0.0, -net / days)
    pm, py = (month - 1, year) if month > 1 else (12, year - 1)
    ps, pe = _month_bounds(py, pm)
    prev_inc = float(pf_finance_repo.sum_income_scoped(db, profile_id, ps, pe, account_id=account_id))
    prev_exp = float(pf_finance_repo.sum_expense_scoped(db, profile_id, ps, pe, account_id=account_id))
    prev_net = prev_inc - prev_exp

    # Lightweight account-flow proxy: net (income-expense) by account in period.
    account_flow = []
    try:
        for a in pf_finance_repo.list_accounts(db, profile_id, 0, 200):
            ai = float(pf_finance_repo.sum_income_scoped(db, profile_id, start, end, account_id=int(a.id)))
            ae = float(pf_finance_repo.sum_expense_scoped(db, profile_id, start, end, account_id=int(a.id)))
            flow = ai - ae
            if abs(flow) > 0.01:
                account_flow.append(
                    {
                        'name': a.account_name or f'Account #{a.id}',
                        'inflow': round(ai, 2),
                        'outflow': round(ae, 2),
                        'net': round(flow, 2),
                    }
                )
    except Exception:
        account_flow = []
    account_flow.sort(key=lambda x: abs(float(x.get('net', 0.0))), reverse=True)

    out = {
        'module': 'cash-flow',
        'period': {'start': start.isoformat(), 'end': end.isoformat(), 'month': f'{year:04d}-{month:02d}'},
        'filters': {'account_id': account_id, 'breakdown': breakdown},
        'kpis': {
            'total_amount': round(inflow + outflow, 2),
            'inflow': round(inflow, 2),
            'outflow': round(outflow, 2),
            'net_change': round(net, 2),
            'average': round(net / days, 2),
            'highest': 0.0,
            'lowest': 0.0,
            'burn_rate': round(burn, 2),
        },
        'comparison': {
            'prior_month_total': round(prev_net, 2),
            'month_over_month_pct': _pct_change(net, prev_net),
        },
        'account_flow': account_flow[:12],
    }
    if str(breakdown).lower() != 'all':
        _, entities, _ = _build_breakdown_data(
            db, profile_id, breakdown=breakdown, granularity='daily', start=start, end=end
        )
        out['entity_totals'] = [
            {'name': e['name'], 'net': e['total_net'], 'inflow': e['total_inflow'], 'outflow': e['total_outflow']}
            for e in entities
        ]
    return out


def cash_flow_trend(
    db: Session,
    profile_id: int,
    *,
    granularity: Granularity,
    year: int,
    month: int | None = None,
    account_id: int | None = None,
    breakdown: str = 'all',
) -> dict[str, Any]:
    if granularity == 'daily':
        if month is None:
            month = date.today().month
        start, end = _month_bounds(year, month)
        inc = pf_analytics_repo.income_daily_series(db, profile_id, start, end, account_id=account_id)
        exp = pf_analytics_repo.expense_daily_series(db, profile_id, start, end, account_id=account_id)
        led = pf_analytics_repo.ledger_daily_inflow_outflow(db, profile_id, start, end, account_id=account_id)
        inv = _cashflow_investment_pairs(db, profile_id, start=start, end=end, granularity='daily')
        by: dict[str, dict[str, float]] = {}
        for d, v in inc:
            k = d.isoformat()
            by.setdefault(k, {'inflow': 0.0, 'outflow': 0.0})
            by[k]['inflow'] += float(v)
        for d, v in exp:
            k = d.isoformat()
            by.setdefault(k, {'inflow': 0.0, 'outflow': 0.0})
            by[k]['outflow'] += float(v)
        for d, i, o in led:
            k = d.isoformat()
            by.setdefault(k, {'inflow': 0.0, 'outflow': 0.0})
            # remove transfer and cc-bill from the net cashflow line
            by[k]['inflow'] += max(0.0, float(i))
            by[k]['outflow'] += max(0.0, float(o))
        for k, ip, on, _ in inv:
            by.setdefault(k, {'inflow': 0.0, 'outflow': 0.0})
            by[k]['inflow'] += float(ip)
            by[k]['outflow'] += float(on)
        series = [
            {
                'label': k,
                'date': k,
                'inflow': round(by[k]['inflow'], 2),
                'outflow': round(by[k]['outflow'], 2),
                'net': round(by[k]['inflow'] - by[k]['outflow'], 2),
            }
            for k in sorted(by.keys())
        ]
        if str(breakdown).lower() != 'all':
            agg, entities, detailed = _build_breakdown_data(
                db, profile_id, breakdown=breakdown, granularity='daily', start=start, end=end
            )
            return {'module': 'cash-flow', 'granularity': 'daily', 'breakdown': breakdown, 'series': agg, 'entities': entities, 'detailed_rows': detailed}
        return {'module': 'cash-flow', 'granularity': 'daily', 'breakdown': breakdown, 'series': series}

    im = pf_analytics_repo.income_monthly_series_year(db, profile_id, year, account_id=account_id)
    ex = pf_analytics_repo.expense_monthly_series_year(db, profile_id, year, account_id=account_id)
    lm = pf_analytics_repo.ledger_monthly_inflow_outflow_year(db, profile_id, year, account_id=account_id)
    start_y, end_y = _month_bounds(year, 1)[0], _month_bounds(year, 12)[1]
    ivm = _cashflow_investment_pairs(db, profile_id, start=start_y, end=end_y, granularity='monthly')
    bym: dict[str, dict[str, float]] = {}
    for k, v in im:
        bym.setdefault(k, {'inflow': 0.0, 'outflow': 0.0})
        bym[k]['inflow'] += float(v)
    for k, v in ex:
        bym.setdefault(k, {'inflow': 0.0, 'outflow': 0.0})
        bym[k]['outflow'] += float(v)
    for k, i, o in lm:
        bym.setdefault(k, {'inflow': 0.0, 'outflow': 0.0})
        bym[k]['inflow'] += float(i)
        bym[k]['outflow'] += float(o)
    for k, ip, on, _ in ivm:
        bym.setdefault(k, {'inflow': 0.0, 'outflow': 0.0})
        bym[k]['inflow'] += float(ip)
        bym[k]['outflow'] += float(on)
    series = [
        {
            'label': k,
            'month': k,
            'inflow': round(v['inflow'], 2),
            'outflow': round(v['outflow'], 2),
            'net': round(v['inflow'] - v['outflow'], 2),
        }
        for k, v in sorted(bym.items())
    ]
    if str(breakdown).lower() != 'all':
        # monthly uses full selected year
        s, e = _month_bounds(year, 1)[0], _month_bounds(year, 12)[1]
        agg, entities, detailed = _build_breakdown_data(
            db, profile_id, breakdown=breakdown, granularity='monthly', start=s, end=e
        )
        return {'module': 'cash-flow', 'granularity': 'monthly', 'breakdown': breakdown, 'series': agg, 'entities': entities, 'detailed_rows': detailed}
    return {'module': 'cash-flow', 'granularity': 'monthly', 'breakdown': breakdown, 'series': series}


def cash_flow_distribution(
    db: Session,
    profile_id: int,
    *,
    year: int,
    month: int,
    account_id: int | None = None,
    breakdown: str = 'all',
) -> dict[str, Any]:
    start, end = _month_bounds(year, month)
    income = float(pf_finance_repo.sum_income_scoped(db, profile_id, start, end, account_id=account_id))
    expense = float(pf_finance_repo.sum_expense_scoped(db, profile_id, start, end, account_id=account_id))
    inv = pf_analytics_repo.investment_txn_daily_series(db, profile_id, start, end)
    inv_in = sum(max(0.0, float(v)) for _, v in inv)
    inv_out = sum(abs(min(0.0, float(v))) for _, v in inv)
    led = _cashflow_ledger_filtered(db, profile_id, start=start, end=end, account_id=account_id)
    if str(breakdown).lower() != 'all':
        _, entities, _ = _build_breakdown_data(
            db, profile_id, breakdown=breakdown, granularity='daily', start=start, end=end
        )
        slices = [{'name': e['name'], 'value': round(abs(float(e['total_net'])), 2)} for e in entities]
        return {'module': 'cash-flow', 'breakdown': breakdown, 'period': {'start': start.isoformat(), 'end': end.isoformat()}, 'slices': [s for s in slices if s['value'] > 0.01]}
    slices = [
        {'name': 'Income', 'value': round(income, 2)},
        {'name': 'Expenses', 'value': round(expense, 2)},
        {'name': 'Investments (in)', 'value': round(inv_in, 2)},
        {'name': 'Investments (out)', 'value': round(inv_out, 2)},
        {'name': 'Chit contribution', 'value': round(float(led.get('CHIT_CONTRIBUTION', 0.0)), 2)},
        {'name': 'Chit auction receipt', 'value': round(float(led.get('CHIT_AUCTION_RECEIPT', 0.0)), 2)},
        {'name': 'Loan disbursement', 'value': round(float(led.get('LOAN_DISBURSEMENT', 0.0)), 2)},
        {'name': 'Loan payments', 'value': round(float(led.get('LOAN_LIABILITY_PAYMENT', 0.0)) + float(led.get('LOAN_EMI_PAYMENT', 0.0)), 2)},
        {'name': 'External deposit', 'value': round(float(led.get('EXTERNAL_DEPOSIT', 0.0)), 2)},
        {'name': 'External withdrawal', 'value': round(float(led.get('EXTERNAL_WITHDRAWAL', 0.0)), 2)},
    ]
    return {'module': 'cash-flow', 'breakdown': breakdown, 'period': {'start': start.isoformat(), 'end': end.isoformat()}, 'slices': [s for s in slices if s['value'] > 0.01]}


def cash_flow_table(
    db: Session,
    profile_id: int,
    *,
    granularity: Granularity,
    year: int,
    month: int | None = None,
    account_id: int | None = None,
    breakdown: str = 'all',
) -> dict[str, Any]:
    t = cash_flow_trend(
        db, profile_id, granularity=granularity, year=year, month=month, account_id=account_id, breakdown=breakdown
    )
    rows = t.get('detailed_rows') if str(breakdown).lower() != 'all' else t.get('series')
    return {'module': 'cash-flow', 'granularity': t['granularity'], 'breakdown': breakdown, 'rows': rows or []}


def cash_flow_insights(
    db: Session,
    profile_id: int,
    *,
    year: int,
    month: int,
    account_id: int | None = None,
    breakdown: str = 'all',
) -> dict[str, Any]:
    s = cash_flow_summary(db, profile_id, year=year, month=month, account_id=account_id, breakdown=breakdown)
    t = cash_flow_trend(
        db, profile_id, granularity='daily', year=year, month=month, account_id=account_id, breakdown=breakdown
    )
    rows = t.get('series', [])
    inflow = float(s.get('kpis', {}).get('inflow', 0.0))
    outflow = float(s.get('kpis', {}).get('outflow', 0.0))
    net = float(s.get('kpis', {}).get('net_change', 0.0))
    bullets: list[str] = []
    warnings: list[str] = []
    if net < 0:
        msg = f'You are spending {abs(net):,.2f} more than earning in this period.'
        bullets.append(msg)
        warnings.append(msg)
    else:
        bullets.append(f'Net positive cashflow of {net:,.2f} in this period.')
    if rows:
        worst = min(rows, key=lambda r: float(r.get('net', 0.0)))
        bullets.append(f'Highest cash burn: {worst.get("label")} ({float(worst.get("net", 0.0)):,.2f}).')
        pos_days = sum(1 for r in rows if float(r.get('net', 0.0)) >= 0)
        bullets.append(f'Positive cashflow on {pos_days}/{len(rows)} tracked periods.')
    if inflow > 0.01:
        ratio = outflow / inflow
        if ratio > 1.15:
            w = f'Cashflow health risk: outflow is {ratio*100:.1f}% of inflow.'
            bullets.append(w)
            warnings.append(w)
    if str(breakdown).lower() != 'all':
        ets = s.get('entity_totals') or []
        if ets:
            top = max(ets, key=lambda x: abs(float(x.get('net', 0.0))))
            bullets.append(f'{top.get("name")} is the largest cashflow channel ({float(top.get("net", 0.0)):,.2f} net).')
    return {'module': 'cash-flow', 'breakdown': breakdown, 'insights': bullets, 'warnings': warnings}


def movements_summary(
    db: Session,
    profile_id: int,
    *,
    year: int,
    month: int,
    account_id: int | None = None,
) -> dict[str, Any]:
    start, end = _month_bounds(year, month)
    rows = pf_analytics_repo.ledger_daily_inflow_outflow(db, profile_id, start, end, account_id=account_id)
    inf = sum(a for _, a, _ in rows)
    out = sum(b for _, _, b in rows)
    amounts = [a + b for _, a, b in rows]
    kpis = _kpis_from_amounts(amounts, inflow=round(inf, 2), outflow=round(out, 2))
    kpis['total_amount'] = round(inf + out, 2)
    return {
        'module': 'movements',
        'period': {'start': start.isoformat(), 'end': end.isoformat(), 'month': f'{year:04d}-{month:02d}'},
        'filters': {'account_id': account_id},
        'kpis': kpis,
    }


def movements_trend(
    db: Session,
    profile_id: int,
    *,
    granularity: Granularity,
    year: int,
    month: int | None = None,
    account_id: int | None = None,
) -> dict[str, Any]:
    if granularity == 'daily':
        if month is None:
            month = date.today().month
        start, end = _month_bounds(year, month)
        rows = pf_analytics_repo.ledger_daily_inflow_outflow(db, profile_id, start, end, account_id=account_id)
        series = [
            {
                'label': d.isoformat(),
                'date': d.isoformat(),
                'inflow': round(i, 2),
                'outflow': round(o, 2),
                'net': round(i - o, 2),
            }
            for d, i, o in rows
        ]
        return {'module': 'movements', 'granularity': 'daily', 'series': series}
    rows = pf_analytics_repo.ledger_monthly_inflow_outflow_year(db, profile_id, year, account_id=account_id)
    series = [
        {'label': k, 'month': k, 'inflow': round(i, 2), 'outflow': round(o, 2), 'net': round(i - o, 2)}
        for k, i, o in rows
    ]
    return {'module': 'movements', 'granularity': 'monthly', 'series': series}


def movements_distribution(
    db: Session,
    profile_id: int,
    *,
    year: int,
    month: int,
    account_id: int | None = None,
) -> dict[str, Any]:
    start, end = _month_bounds(year, month)
    agg = pf_finance_repo.sum_account_transaction_amounts_by_type(
        db, profile_id, start, end, pf_finance_repo.LEDGER_CASHFLOW_SUMMARY_TYPES
    )
    return {
        'module': 'movements',
        'slices': [{'name': k, 'value': round(v, 2)} for k, v in sorted(agg.items(), key=lambda x: -x[1])],
    }


def movements_table(
    db: Session,
    profile_id: int,
    *,
    granularity: Granularity,
    year: int,
    month: int | None = None,
    account_id: int | None = None,
) -> dict[str, Any]:
    t = movements_trend(db, profile_id, granularity=granularity, year=year, month=month, account_id=account_id)
    return {'module': 'movements', 'granularity': t['granularity'], 'rows': t['series']}


def movements_insights(
    db: Session,
    profile_id: int,
    *,
    year: int,
    month: int,
    account_id: int | None = None,
) -> dict[str, Any]:
    start, end = _month_bounds(year, month)
    rows = pf_analytics_repo.ledger_daily_inflow_outflow(db, profile_id, start, end, account_id=account_id)
    bullets: list[str] = []
    if rows:
        best = max(rows, key=lambda x: x[1] - x[2])
        bullets.append(f'Strongest net inflow day: {best[0].isoformat()} (in {best[1]:,.2f}, out {best[2]:,.2f}).')
    return {'module': 'movements', 'insights': bullets, 'warnings': []}


def _stub(module: str, message: str) -> dict[str, Any]:
    return {
        'module': module,
        'partial': True,
        'message': message,
        'kpis': {
            'total_amount': 0.0,
            'inflow': 0.0,
            'outflow': 0.0,
            'net_change': 0.0,
            'average': 0.0,
            'highest': 0.0,
            'lowest': 0.0,
        },
        'series': [],
        'slices': [],
        'rows': [],
        'insights': [],
        'warnings': [],
    }


def credit_cards_packaged(
    db: Session,
    profile_id: int,
    *,
    year: int,
    month: int,
    card_id: int | None = None,
) -> dict[str, Any]:
    try:
        util = pf_credit_card_repo.card_utilization_rows(db, profile_id)
    except Exception:
        util = []
    if card_id is not None:
        card = pf_credit_card_repo.get_card_for_profile(db, card_id, profile_id)
        if card is None:
            return {
                'module': 'credit-cards',
                'partial': False,
                'filters': {'card_id': card_id},
                'kpis': {
                    'total_amount': 0.0,
                    'inflow': 0.0,
                    'outflow': 0.0,
                    'net_change': 0.0,
                    'average': 0.0,
                    'highest': 0.0,
                    'lowest': 0.0,
                },
                'utilization_pct': 0.0,
                'available': 0.0,
                'used': 0.0,
                'limit': 0.0,
                'dashboard': {},
                'cards': [],
                'card_label': None,
            }
        util = [r for r in util if int(r.get('card_id') or 0) == int(card_id)]
    total_limit = sum(float(r.get('card_limit') or 0) for r in util)
    used = sum(float(r.get('used_amount') or 0) for r in util)
    avail = max(0.0, total_limit - used)
    pct = round((used / total_limit) * 100, 2) if total_limit > 0.01 else 0.0
    try:
        dash = pf_credit_card_repo.dashboard_summary(db, profile_id, period_year=year, period_month=month)
    except Exception:
        dash = {}
    try:
        spend_m = pf_credit_card_repo.total_spend_month(
            db, profile_id, period_year=year, period_month=month, card_id=card_id
        )
    except Exception:
        spend_m = 0.0
    if card_id is not None:
        try:
            paid_m = pf_credit_card_repo.sum_card_payments_month(
                db, profile_id, card_id, period_year=year, period_month=month
            )
        except Exception:
            paid_m = 0.0
    else:
        paid_m = float(dash.get('paid_this_month') or 0)

    if card_id is not None:
        start, end = _month_bounds(year, month)
        try:
            daily_pairs = pf_analytics_repo.credit_card_spend_daily_series(
                db, profile_id, start, end, card_id=card_id
            )
        except Exception:
            daily_pairs = []
        by_d = {d: float(v) for d, v in daily_pairs}
        amounts: list[float] = []
        cur = start
        while cur <= end:
            amounts.append(by_d.get(cur, 0.0))
            cur += timedelta(days=1)
        avg_d = round(sum(amounts) / len(amounts), 2) if amounts else 0.0
        hi_d = round(max(amounts), 2) if amounts else 0.0
        lo_d = round(min(amounts), 2) if amounts else 0.0
        avg_kpi, hi_kpi, lo_kpi = avg_d, hi_d, lo_d
    else:
        avg_kpi = round(used / max(len(util), 1), 2)
        hi_kpi = round(max((float(r.get('used_amount') or 0) for r in util), default=0.0), 2)
        lo_kpi = round(min((float(r.get('used_amount') or 0) for r in util), default=0.0), 2)

    out: dict[str, Any] = {
        'module': 'credit-cards',
        'partial': False,
        'filters': {'card_id': card_id},
        'kpis': {
            'total_amount': round(total_limit, 2),
            'inflow': round(paid_m, 2),
            'outflow': round(float(spend_m), 2),
            'net_change': round(paid_m - float(spend_m), 2),
            'average': avg_kpi,
            'highest': hi_kpi,
            'lowest': lo_kpi,
        },
        'utilization_pct': pct,
        'available': round(avail, 2),
        'used': round(used, 2),
        'limit': round(total_limit, 2),
        'dashboard': dash,
        'cards': util,
    }
    if card_id is not None and util:
        out['card_label'] = str(util[0].get('card_name') or '')
    return out


def loans_packaged(db: Session, profile_id: int) -> dict[str, Any]:
    """Legacy snapshot KPIs; prefer ``loans_summary`` for dashboard analytics."""
    try:
        rows = pf_finance_repo.list_loans(db, profile_id)
    except Exception:
        rows = []
    lent_principal = sum(float(getattr(r, 'loan_amount', None) or 0) for r in rows)
    outstanding = sum(
        float(
            r.remaining_amount
            if getattr(r, 'remaining_amount', None) is not None
            else (getattr(r, 'loan_amount', None) or 0)
        )
        for r in rows
    )
    try:
        borrowed_liab = float(pf_finance_repo.sum_liabilities(db, profile_id))
    except Exception:
        borrowed_liab = 0.0
    n = len(rows)
    return {
        'module': 'loans',
        'partial': True,
        'kpis': {
            'total_amount': round(lent_principal, 2),
            'inflow': round(outstanding, 2),
            'outflow': round(borrowed_liab, 2),
            'net_change': round(outstanding - borrowed_liab, 2),
            'average': round(lent_principal / n, 2) if n else 0.0,
            'highest': round(max((float(getattr(r, 'loan_amount', None) or 0) for r in rows), default=0.0), 2),
            'lowest': round(min((float(getattr(r, 'loan_amount', None) or 0) for r in rows), default=0.0), 2),
        },
        'outstanding_lent': round(outstanding, 2),
        'notes': 'Borrowed side overlaps Liabilities module; use Loans page for schedules.',
    }


def loans_summary(
    db: Session,
    profile_id: int,
    *,
    year: int,
    month: int,
) -> dict[str, Any]:
    """Lent-loans analytics: repayments in the selected month + portfolio outstanding."""
    start, end = _month_bounds(year, month)
    try:
        daily_pairs = pf_analytics_repo.loan_repayments_daily_series(db, profile_id, start, end)
    except Exception:
        daily_pairs = []
    by_d = {d: float(v) for d, v in daily_pairs}
    amounts: list[float] = []
    cur = start
    while cur <= end:
        amounts.append(by_d.get(cur, 0.0))
        cur += timedelta(days=1)
    total_repaid = float(sum(amounts))
    try:
        rows = pf_finance_repo.list_loans(db, profile_id)
    except Exception:
        rows = []
    outstanding = sum(
        float(
            r.remaining_amount
            if getattr(r, 'remaining_amount', None) is not None
            else (getattr(r, 'loan_amount', None) or 0)
        )
        for r in rows
    )
    lent_principal = sum(float(getattr(r, 'loan_amount', None) or 0) for r in rows)
    kpis = _kpis_from_amounts(amounts, inflow=round(total_repaid, 2), outflow=0.0)
    kpis['total_amount'] = round(total_repaid, 2)
    kpis['net_change'] = round(total_repaid, 2)
    pm, py = (month - 1, year) if month > 1 else (12, year - 1)
    ps, pe = _month_bounds(py, pm)
    try:
        prev_pairs = pf_analytics_repo.loan_repayments_daily_series(db, profile_id, ps, pe)
    except Exception:
        prev_pairs = []
    prev_total = float(sum(v for _, v in prev_pairs))
    return {
        'module': 'loans',
        'period': {'start': start.isoformat(), 'end': end.isoformat(), 'month': f'{year:04d}-{month:02d}'},
        'filters': {},
        'kpis': kpis,
        'comparison': {
            'prior_month_total': round(prev_total, 2),
            'month_over_month_pct': _pct_change(total_repaid, prev_total),
        },
        'portfolio': {'outstanding_lent': round(outstanding, 2), 'principal_lent': round(lent_principal, 2)},
        'partial': False,
    }


def loans_trend(
    db: Session,
    profile_id: int,
    *,
    granularity: Granularity,
    year: int,
    month: int | None = None,
) -> dict[str, Any]:
    if granularity == 'daily':
        if month is None:
            month = date.today().month
        start, end = _month_bounds(year, month)
        try:
            rows = pf_analytics_repo.loan_repayments_daily_series(db, profile_id, start, end)
        except Exception:
            rows = []
        series = [{'label': d.isoformat(), 'date': d.isoformat(), 'amount': round(v, 2)} for d, v in rows]
        return {'module': 'loans', 'granularity': 'daily', 'series': series}
    try:
        rows = pf_analytics_repo.loan_repayments_monthly_series_year(db, profile_id, year)
    except Exception:
        rows = []
    series = [{'label': k, 'month': k, 'amount': round(v, 2)} for k, v in rows]
    return {'module': 'loans', 'granularity': 'monthly', 'series': series}


def loans_distribution(
    db: Session,
    profile_id: int,
    *,
    year: int,
    month: int,
) -> dict[str, Any]:
    start, end = _month_bounds(year, month)
    try:
        pairs = pf_analytics_repo.loan_repayments_by_borrower_range(db, profile_id, start, end)
    except Exception:
        pairs = []
    return {
        'module': 'loans',
        'period': {'start': start.isoformat(), 'end': end.isoformat()},
        'slices': [{'name': n, 'value': round(v, 2)} for n, v in pairs],
    }


def loans_table(
    db: Session,
    profile_id: int,
    *,
    granularity: Granularity,
    year: int,
    month: int | None = None,
) -> dict[str, Any]:
    t = loans_trend(db, profile_id, granularity=granularity, year=year, month=month)
    return {'module': 'loans', 'granularity': t['granularity'], 'rows': t['series']}


def loans_insights(
    db: Session,
    profile_id: int,
    *,
    year: int,
    month: int,
) -> dict[str, Any]:
    start, end = _month_bounds(year, month)
    try:
        daily = pf_analytics_repo.loan_repayments_daily_series(db, profile_id, start, end)
    except Exception:
        daily = []
    bullets: list[str] = []
    if daily:
        top_d, top_v = max(daily, key=lambda x: x[1])
        bullets.append(f'Highest repayment day: {top_d.isoformat()} ({top_v:,.2f}).')
        nz = [v for _, v in daily if v > 0.01]
        if nz:
            avg_nz = sum(nz) / len(nz)
            if top_v > avg_nz * 1.5:
                bullets.append('Repayment spike detected (top day well above typical repayment days).')
    summ = loans_summary(db, profile_id, year=year, month=month)
    mom = summ.get('comparison', {}).get('month_over_month_pct')
    if mom is not None:
        bullets.append(f'Month-over-month repayments: {mom:+.1f}%.')
    if not bullets:
        bullets.append('No loan repayments recorded for this period.')
    return {'module': 'loans', 'insights': bullets, 'warnings': []}


def credit_cards_trend(
    db: Session,
    profile_id: int,
    *,
    granularity: Granularity,
    year: int,
    month: int | None = None,
    card_id: int | None = None,
) -> dict[str, Any]:
    if granularity == 'daily':
        if month is None:
            month = date.today().month
        start, end = _month_bounds(year, month)
        try:
            spend = dict(
                pf_analytics_repo.credit_card_spend_daily_series(
                    db, profile_id, start, end, card_id=card_id
                )
            )
            pay = dict(
                pf_analytics_repo.credit_card_payment_daily_series(
                    db, profile_id, start, end, card_id=card_id
                )
            )
        except Exception:
            spend, pay = {}, {}
        keys = sorted(set(spend) | set(pay))
        series = [
            {
                'label': d.isoformat(),
                'date': d.isoformat(),
                'inflow': round(float(pay.get(d, 0.0)), 2),
                'outflow': round(float(spend.get(d, 0.0)), 2),
                'net': round(float(pay.get(d, 0.0) - spend.get(d, 0.0)), 2),
            }
            for d in keys
        ]
        return {'module': 'credit-cards', 'granularity': 'daily', 'series': series}
    try:
        sm = dict(
            pf_analytics_repo.credit_card_spend_monthly_series_year(db, profile_id, year, card_id=card_id)
        )
        pm = dict(
            pf_analytics_repo.credit_card_payment_monthly_series_year(db, profile_id, year, card_id=card_id)
        )
    except Exception:
        sm, pm = {}, {}
    keys = sorted(set(sm) | set(pm))
    series = [
        {
            'label': k,
            'month': k,
            'inflow': round(float(pm.get(k, 0.0)), 2),
            'outflow': round(float(sm.get(k, 0.0)), 2),
            'net': round(float(pm.get(k, 0.0) - sm.get(k, 0.0)), 2),
        }
        for k in keys
    ]
    return {'module': 'credit-cards', 'granularity': 'monthly', 'series': series}


def credit_cards_distribution(
    db: Session,
    profile_id: int,
    *,
    year: int,
    month: int,
    card_id: int | None = None,
) -> dict[str, Any]:
    start, end = _month_bounds(year, month)
    try:
        cat_pairs = pf_analytics_repo.credit_card_spend_by_category_range(
            db, profile_id, start, end, card_id=card_id
        )
    except Exception:
        cat_pairs = []
    if card_id is None:
        try:
            card_pairs = pf_analytics_repo.credit_card_spend_by_card_range(
                db, profile_id, start, end, card_id=None
            )
        except Exception:
            card_pairs = []
        if not card_pairs:
            slices = [{'name': n, 'value': round(v, 2)} for n, v in cat_pairs]
        else:
            slices = [{'name': n, 'value': round(v, 2)} for n, v in card_pairs]
    else:
        slices = [{'name': n, 'value': round(v, 2)} for n, v in cat_pairs]
    return {
        'module': 'credit-cards',
        'period': {'start': start.isoformat(), 'end': end.isoformat()},
        'slices': slices,
    }


def credit_cards_table(
    db: Session,
    profile_id: int,
    *,
    granularity: Granularity,
    year: int,
    month: int | None = None,
    card_id: int | None = None,
) -> dict[str, Any]:
    t = credit_cards_trend(
        db, profile_id, granularity=granularity, year=year, month=month, card_id=card_id
    )
    return {'module': 'credit-cards', 'granularity': t['granularity'], 'rows': t['series']}


def credit_cards_insights(
    db: Session,
    profile_id: int,
    *,
    year: int,
    month: int,
    card_id: int | None = None,
) -> dict[str, Any]:
    bullets: list[str] = []
    warnings: list[str] = []
    try:
        pkg = credit_cards_packaged(db, profile_id, year=year, month=month, card_id=card_id)
    except Exception:
        pkg = {'kpis': {}, 'utilization_pct': 0.0}
    if card_id is not None and pkg.get('card_label'):
        bullets.append(f'Selected card: {pkg["card_label"]}.')
    util = float(pkg.get('utilization_pct') or 0.0)
    if util > 30:
        warnings.append(f'High credit utilization ({util:.1f}%).')
    start, end = _month_bounds(year, month)
    try:
        spend = sum(
            v
            for _, v in pf_analytics_repo.credit_card_spend_daily_series(
                db, profile_id, start, end, card_id=card_id
            )
        )
        paid = sum(
            v
            for _, v in pf_analytics_repo.credit_card_payment_daily_series(
                db, profile_id, start, end, card_id=card_id
            )
        )
    except Exception:
        spend, paid = 0.0, 0.0
    if spend > paid + 0.01:
        bullets.append('Card spend exceeded payments recorded this month (negative net on cards).')
    elif paid > 0.01 and spend <= 0.01:
        bullets.append('Payments recorded but no card spend this month.')
    if not bullets and not warnings:
        bullets.append('No notable card insights for this selection.')
    return {'module': 'credit-cards', 'insights': bullets, 'warnings': warnings}


def investments_packaged(db: Session, profile_id: int) -> dict[str, Any]:
    try:
        inv = pf_finance_repo.list_investments(db, profile_id, 0, 500)
    except Exception:
        inv = []
    invested = sum(float(r.invested_amount or 0) for r in inv)
    current = sum(float(r.current_value or r.invested_amount or 0) for r in inv)
    pnl = current - invested
    return {
        'module': 'investments',
        'partial': False,
        'kpis': {
            'total_amount': round(current, 2),
            'inflow': round(invested, 2),
            'outflow': 0.0,
            'net_change': round(pnl, 2),
            'average': round(current / max(len(inv), 1), 2),
            'highest': round(max((float(r.current_value or r.invested_amount or 0) for r in inv), default=0.0), 2),
            'lowest': round(min((float(r.current_value or r.invested_amount or 0) for r in inv), default=0.0), 2),
        },
        'invested': round(invested, 2),
        'current_value': round(current, 2),
        'profit_loss': round(pnl, 2),
    }


def investments_summary(
    db: Session,
    profile_id: int,
    *,
    year: int,
    month: int,
) -> dict[str, Any]:
    base = investments_packaged(db, profile_id)
    start, end = _month_bounds(year, month)
    try:
        daily_pairs = pf_analytics_repo.investment_txn_daily_series(db, profile_id, start, end)
    except Exception:
        daily_pairs = []
    by_d = {d: float(v) for d, v in daily_pairs}
    amounts_abs: list[float] = []
    cur = start
    while cur <= end:
        amounts_abs.append(abs(by_d.get(cur, 0.0)))
        cur += timedelta(days=1)
    kpis = dict(base['kpis'])
    if daily_pairs:
        raw_vals = [float(v) for _, v in daily_pairs]
        kpis['average'] = round(sum(amounts_abs) / max(len(amounts_abs), 1), 2)
        kpis['highest'] = round(max(raw_vals), 2)
        kpis['lowest'] = round(min(raw_vals), 2)
    pm, py = (month - 1, year) if month > 1 else (12, year - 1)
    ps, pe = _month_bounds(py, pm)
    try:
        prev_pairs = pf_analytics_repo.investment_txn_daily_series(db, profile_id, ps, pe)
    except Exception:
        prev_pairs = []
    cur_vol = sum(abs(v) for _, v in daily_pairs)
    prev_vol = sum(abs(v) for _, v in prev_pairs)
    return {
        'module': 'investments',
        'period': {'start': start.isoformat(), 'end': end.isoformat(), 'month': f'{year:04d}-{month:02d}'},
        'filters': {},
        'kpis': kpis,
        'comparison': {
            'prior_month_total': round(prev_vol, 2),
            'month_over_month_pct': _pct_change(cur_vol, prev_vol),
        },
        'partial': base.get('partial', False),
        'invested': base.get('invested'),
        'current_value': base.get('current_value'),
        'profit_loss': base.get('profit_loss'),
    }


def investments_trend(
    db: Session,
    profile_id: int,
    *,
    granularity: Granularity,
    year: int,
    month: int | None = None,
) -> dict[str, Any]:
    if granularity == 'daily':
        if month is None:
            month = date.today().month
        start, end = _month_bounds(year, month)
        try:
            rows = pf_analytics_repo.investment_txn_daily_series(db, profile_id, start, end)
        except Exception:
            rows = []
        series = [{'label': d.isoformat(), 'date': d.isoformat(), 'amount': round(v, 2)} for d, v in rows]
        return {'module': 'investments', 'granularity': 'daily', 'series': series}
    try:
        rows = pf_analytics_repo.investment_txn_monthly_series_year(db, profile_id, year)
    except Exception:
        rows = []
    series = [{'label': k, 'month': k, 'amount': round(v, 2)} for k, v in rows]
    return {'module': 'investments', 'granularity': 'monthly', 'series': series}


def investments_distribution(
    db: Session,
    profile_id: int,
    *,
    year: int,
    month: int,
) -> dict[str, Any]:
    start, end = _month_bounds(year, month)
    try:
        pairs = pf_analytics_repo.investment_txn_volume_by_name_range(db, profile_id, start, end)
    except Exception:
        pairs = []
    if pairs:
        slices = [{'name': n, 'value': round(v, 2)} for n, v in pairs]
    else:
        try:
            inv = pf_finance_repo.list_investments(db, profile_id, 0, 500)
        except Exception:
            inv = []
        slices = [
            {
                'name': (getattr(r, 'name', None) or 'Investment')[:80],
                'value': round(float(r.current_value or r.invested_amount or 0), 2),
            }
            for r in inv
        ]
    return {
        'module': 'investments',
        'period': {'start': start.isoformat(), 'end': end.isoformat()},
        'slices': slices,
    }


def investments_table(
    db: Session,
    profile_id: int,
    *,
    granularity: Granularity,
    year: int,
    month: int | None = None,
) -> dict[str, Any]:
    t = investments_trend(db, profile_id, granularity=granularity, year=year, month=month)
    return {'module': 'investments', 'granularity': t['granularity'], 'rows': t['series']}


def investments_insights(
    db: Session,
    profile_id: int,
    *,
    year: int,
    month: int,
) -> dict[str, Any]:
    summ = investments_summary(db, profile_id, year=year, month=month)
    bullets: list[str] = []
    mom = summ.get('comparison', {}).get('month_over_month_pct')
    if mom is not None:
        bullets.append(f'Trading activity (|txn| sum) vs prior month: {mom:+.1f}%.')
    start, end = _month_bounds(year, month)
    try:
        daily = pf_analytics_repo.investment_txn_daily_series(db, profile_id, start, end)
    except Exception:
        daily = []
    if daily:
        top_d, top_v = max(daily, key=lambda x: abs(x[1]))
        bullets.append(f'Largest signed flow day: {top_d.isoformat()} ({top_v:,.2f}).')
    pnl = summ.get('profit_loss')
    if pnl is not None and float(pnl) < -0.01:
        bullets.append('Portfolio mark-to-book is below cost basis for some holdings.')
    if not bullets:
        bullets.append('No investment ledger movement for this period.')
    return {'module': 'investments', 'insights': bullets, 'warnings': []}


def liabilities_packaged(db: Session, profile_id: int) -> dict[str, Any]:
    try:
        out = float(pf_finance_repo.sum_liabilities(db, profile_id))
    except Exception:
        out = 0.0
    return {
        'module': 'liabilities',
        'partial': True,
        'kpis': {
            'total_amount': round(out, 2),
            'inflow': 0.0,
            'outflow': round(out, 2),
            'net_change': round(-out, 2),
            'average': round(out, 2),
            'highest': round(out, 2),
            'lowest': round(out, 2),
        },
        'notes': 'Trend/distribution: use Reports balance sheet or add liability_type breakdown next.',
    }


def liabilities_summary(
    db: Session,
    profile_id: int,
    *,
    year: int,
    month: int,
) -> dict[str, Any]:
    start, end = _month_bounds(year, month)
    try:
        outstanding = float(pf_finance_repo.sum_liabilities(db, profile_id))
    except Exception:
        outstanding = 0.0
    try:
        daily_pairs = pf_analytics_repo.liability_payments_daily_series(db, profile_id, start, end)
    except Exception:
        daily_pairs = []
    by_d = {d: float(v) for d, v in daily_pairs}
    amounts: list[float] = []
    cur = start
    while cur <= end:
        amounts.append(by_d.get(cur, 0.0))
        cur += timedelta(days=1)
    total_paid = float(sum(amounts))
    kpis = _kpis_from_amounts(amounts, inflow=0.0, outflow=round(total_paid, 2))
    kpis['total_amount'] = round(outstanding, 2)
    kpis['net_change'] = round(-total_paid, 2)
    pm, py = (month - 1, year) if month > 1 else (12, year - 1)
    ps, pe = _month_bounds(py, pm)
    try:
        prev_pairs = pf_analytics_repo.liability_payments_daily_series(db, profile_id, ps, pe)
    except Exception:
        prev_pairs = []
    prev_paid = float(sum(v for _, v in prev_pairs))
    return {
        'module': 'liabilities',
        'period': {'start': start.isoformat(), 'end': end.isoformat(), 'month': f'{year:04d}-{month:02d}'},
        'filters': {},
        'kpis': kpis,
        'comparison': {
            'prior_month_total': round(prev_paid, 2),
            'month_over_month_pct': _pct_change(total_paid, prev_paid),
        },
        'partial': False,
    }


def liabilities_trend(
    db: Session,
    profile_id: int,
    *,
    granularity: Granularity,
    year: int,
    month: int | None = None,
) -> dict[str, Any]:
    if granularity == 'daily':
        if month is None:
            month = date.today().month
        start, end = _month_bounds(year, month)
        try:
            rows = pf_analytics_repo.liability_payments_daily_series(db, profile_id, start, end)
        except Exception:
            rows = []
        series = [
            {
                'label': d.isoformat(),
                'date': d.isoformat(),
                'inflow': 0.0,
                'outflow': round(v, 2),
                'net': round(-float(v), 2),
            }
            for d, v in rows
        ]
        return {'module': 'liabilities', 'granularity': 'daily', 'series': series}
    try:
        rows = pf_analytics_repo.liability_payments_monthly_series_year(db, profile_id, year)
    except Exception:
        rows = []
    series = [
        {
            'label': k,
            'month': k,
            'inflow': 0.0,
            'outflow': round(v, 2),
            'net': round(-float(v), 2),
        }
        for k, v in rows
    ]
    return {'module': 'liabilities', 'granularity': 'monthly', 'series': series}


def liabilities_distribution(
    db: Session,
    profile_id: int,
    *,
    year: int,
    month: int,
) -> dict[str, Any]:
    start, end = _month_bounds(year, month)
    try:
        pairs = pf_analytics_repo.liability_payments_by_name_range(db, profile_id, start, end)
    except Exception:
        pairs = []
    if not pairs:
        try:
            rows = pf_finance_repo.list_liabilities(db, profile_id, 0, 500)
        except Exception:
            rows = []
        pairs = [
            (str(getattr(r, 'liability_name', '') or 'Liability'), float(getattr(r, 'outstanding_amount', 0) or 0))
            for r in rows
        ]
    return {
        'module': 'liabilities',
        'period': {'start': start.isoformat(), 'end': end.isoformat()},
        'slices': [{'name': n, 'value': round(v, 2)} for n, v in pairs],
    }


def liabilities_table(
    db: Session,
    profile_id: int,
    *,
    granularity: Granularity,
    year: int,
    month: int | None = None,
) -> dict[str, Any]:
    t = liabilities_trend(db, profile_id, granularity=granularity, year=year, month=month)
    return {'module': 'liabilities', 'granularity': t['granularity'], 'rows': t['series']}


def liabilities_insights(
    db: Session,
    profile_id: int,
    *,
    year: int,
    month: int,
) -> dict[str, Any]:
    summ = liabilities_summary(db, profile_id, year=year, month=month)
    bullets: list[str] = []
    if summ['kpis']['outflow'] > 0.01:
        bullets.append(f"Debt payments this month: {summ['kpis']['outflow']:,.2f}.")
    mom = summ.get('comparison', {}).get('month_over_month_pct')
    if mom is not None:
        bullets.append(f'Month-over-month payment volume: {mom:+.1f}%.')
    if summ['kpis']['total_amount'] > 0.01 and summ['kpis']['outflow'] <= 0.01:
        bullets.append('Outstanding liabilities exist but no payments recorded this month.')
    if not bullets:
        bullets.append('No liability payment activity for this period.')
    return {'module': 'liabilities', 'insights': bullets, 'warnings': []}


def assets_packaged(db: Session, profile_id: int) -> dict[str, Any]:
    try:
        assets = pf_finance_repo.list_all_assets(db, profile_id)
    except Exception:
        assets = []
    from fastapi_service.services.pf_asset_valuation import effective_current_value

    total = sum(effective_current_value(r) for r in assets)
    try:
        chit = float(pf_chit_fund_repo.sum_net_asset_value_profile(db, profile_id))
    except Exception:
        chit = 0.0
    return {
        'module': 'assets',
        'partial': False,
        'kpis': {
            'total_amount': round(total + chit, 2),
            'inflow': 0.0,
            'outflow': 0.0,
            'net_change': 0.0,
            'average': 0.0,
            'highest': 0.0,
            'lowest': 0.0,
        },
        'fixed_assets_book': round(total, 2),
        'chit_funds_net': round(chit, 2),
    }


def assets_summary(
    db: Session,
    profile_id: int,
    *,
    year: int,
    month: int,
) -> dict[str, Any]:
    start, end = _month_bounds(year, month)
    base = assets_packaged(db, profile_id)
    return {
        **base,
        'period': {'start': start.isoformat(), 'end': end.isoformat(), 'month': f'{year:04d}-{month:02d}'},
        'filters': {},
    }


def assets_trend(
    db: Session,
    profile_id: int,
    *,
    granularity: Granularity,
    year: int,
    month: int | None = None,
) -> dict[str, Any]:
    return {
        'module': 'assets',
        'granularity': granularity,
        'series': [],
        'partial': True,
        'message': 'Fixed assets do not have a daily cashflow series; use book values in KPIs.',
    }


def assets_distribution(
    db: Session,
    profile_id: int,
    *,
    year: int,
    month: int,
) -> dict[str, Any]:
    from collections import defaultdict

    from fastapi_service.services.pf_asset_valuation import effective_current_value

    start, end = _month_bounds(year, month)
    try:
        assets = pf_finance_repo.list_all_assets(db, profile_id)
    except Exception:
        assets = []
    by_type: dict[str, float] = defaultdict(float)
    for r in assets:
        by_type[str(r.asset_type or 'Other')] += float(effective_current_value(r))
    pairs = sorted(by_type.items(), key=lambda x: -x[1])
    return {
        'module': 'assets',
        'period': {'start': start.isoformat(), 'end': end.isoformat()},
        'slices': [{'name': k, 'value': round(v, 2)} for k, v in pairs],
    }


def assets_table(
    db: Session,
    profile_id: int,
    *,
    granularity: Granularity,
    year: int,
    month: int | None = None,
) -> dict[str, Any]:
    t = assets_trend(db, profile_id, granularity=granularity, year=year, month=month)
    return {'module': 'assets', 'granularity': t['granularity'], 'rows': t['series']}


def assets_insights(
    db: Session,
    profile_id: int,
    *,
    year: int,
    month: int,
) -> dict[str, Any]:
    p = assets_packaged(db, profile_id)
    fb = float(p.get('fixed_assets_book') or 0)
    ch = float(p.get('chit_funds_net') or 0)
    tot = float(p.get('kpis', {}).get('total_amount') or 0)
    bullets = [
        f'Fixed assets (book): {fb:,.2f}; chit funds NAV: {ch:,.2f}; combined total: {tot:,.2f}.',
    ]
    return {'module': 'assets', 'insights': bullets, 'warnings': []}


def dispatch_summary(
    db: Session,
    profile_id: int,
    module: str,
    *,
    year: int,
    month: int,
    account_id: int | None = None,
    expense_category_id: int | None = None,
    income_category_id: int | None = None,
    card_id: int | None = None,
    breakdown: str = 'all',
) -> dict[str, Any]:
    if module == 'expenses':
        return expenses_summary(
            db, profile_id, year=year, month=month, account_id=account_id, expense_category_id=expense_category_id
        )
    if module == 'income':
        return income_summary(
            db, profile_id, year=year, month=month, account_id=account_id, income_category_id=income_category_id
        )
    if module == 'accounts':
        return accounts_summary(db, profile_id, year=year, month=month, account_id=account_id)
    if module == 'movements':
        return movements_summary(db, profile_id, year=year, month=month, account_id=account_id)
    if module == 'cash-flow':
        return cash_flow_summary(
            db, profile_id, year=year, month=month, account_id=account_id, breakdown=breakdown
        )
    if module == 'credit-cards':
        return credit_cards_packaged(db, profile_id, year=year, month=month, card_id=card_id)
    if module == 'loans':
        return loans_summary(db, profile_id, year=year, month=month)
    if module == 'investments':
        return investments_summary(db, profile_id, year=year, month=month)
    if module == 'liabilities':
        return liabilities_summary(db, profile_id, year=year, month=month)
    if module == 'assets':
        return assets_summary(db, profile_id, year=year, month=month)
    if module == 'financial-statement':
        return financial_statement_summary(db, profile_id, year=year, month=month, account_id=account_id)
    if module == 'reports':
        out = financial_statement_summary(db, profile_id, year=year, month=month, account_id=account_id)
        out['module'] = 'reports'
        out.setdefault('notes', 'Reports analytics uses financial-statement (income vs expense) data model.')
        return out
    return _stub(module, 'Unknown module')


def dispatch_trend(
    db: Session,
    profile_id: int,
    module: str,
    *,
    granularity: Granularity,
    year: int,
    month: int | None,
    account_id: int | None = None,
    expense_category_id: int | None = None,
    income_category_id: int | None = None,
    card_id: int | None = None,
    breakdown: str = 'all',
) -> dict[str, Any]:
    if module == 'expenses':
        return expenses_trend(
            db,
            profile_id,
            granularity=granularity,
            year=year,
            month=month,
            account_id=account_id,
            expense_category_id=expense_category_id,
        )
    if module == 'income':
        return income_trend(
            db,
            profile_id,
            granularity=granularity,
            year=year,
            month=month,
            account_id=account_id,
            income_category_id=income_category_id,
        )
    if module == 'accounts':
        return accounts_trend(db, profile_id, granularity=granularity, year=year, month=month, account_id=account_id)
    if module == 'movements':
        return movements_trend(db, profile_id, granularity=granularity, year=year, month=month, account_id=account_id)
    if module == 'cash-flow':
        return cash_flow_trend(
            db,
            profile_id,
            granularity=granularity,
            year=year,
            month=month,
            account_id=account_id,
            breakdown=breakdown,
        )
    if module == 'credit-cards':
        return credit_cards_trend(
            db, profile_id, granularity=granularity, year=year, month=month, card_id=card_id
        )
    if module == 'loans':
        return loans_trend(db, profile_id, granularity=granularity, year=year, month=month)
    if module == 'investments':
        return investments_trend(db, profile_id, granularity=granularity, year=year, month=month)
    if module == 'liabilities':
        return liabilities_trend(db, profile_id, granularity=granularity, year=year, month=month)
    if module == 'assets':
        return assets_trend(db, profile_id, granularity=granularity, year=year, month=month)
    if module == 'financial-statement':
        return financial_statement_trend(
            db, profile_id, granularity=granularity, year=year, month=month, account_id=account_id
        )
    if module == 'reports':
        out = financial_statement_trend(
            db, profile_id, granularity=granularity, year=year, month=month, account_id=account_id
        )
        out['module'] = 'reports'
        return out
    return {'module': module, 'granularity': granularity, 'series': [], 'partial': True}


def dispatch_distribution(
    db: Session,
    profile_id: int,
    module: str,
    *,
    year: int,
    month: int,
    account_id: int | None = None,
    expense_category_id: int | None = None,
    income_category_id: int | None = None,
    card_id: int | None = None,
    breakdown: str = 'all',
) -> dict[str, Any]:
    if module == 'expenses':
        return expenses_distribution(
            db,
            profile_id,
            year=year,
            month=month,
            account_id=account_id,
            expense_category_id=expense_category_id,
        )
    if module == 'income':
        return income_distribution(
            db,
            profile_id,
            year=year,
            month=month,
            account_id=account_id,
            income_category_id=income_category_id,
        )
    if module == 'accounts':
        return accounts_distribution(db, profile_id, year=year, month=month)
    if module == 'movements':
        return movements_distribution(db, profile_id, year=year, month=month, account_id=account_id)
    if module == 'cash-flow':
        return cash_flow_distribution(
            db, profile_id, year=year, month=month, account_id=account_id, breakdown=breakdown
        )
    if module == 'credit-cards':
        return credit_cards_distribution(db, profile_id, year=year, month=month, card_id=card_id)
    if module == 'loans':
        return loans_distribution(db, profile_id, year=year, month=month)
    if module == 'investments':
        return investments_distribution(db, profile_id, year=year, month=month)
    if module == 'liabilities':
        return liabilities_distribution(db, profile_id, year=year, month=month)
    if module == 'assets':
        return assets_distribution(db, profile_id, year=year, month=month)
    if module == 'financial-statement':
        return financial_statement_distribution(db, profile_id, year=year, month=month, account_id=account_id)
    if module == 'reports':
        out = financial_statement_distribution(db, profile_id, year=year, month=month, account_id=account_id)
        out['module'] = 'reports'
        return out
    return {'module': module, 'slices': [], 'partial': True}


def dispatch_table(
    db: Session,
    profile_id: int,
    module: str,
    *,
    granularity: Granularity,
    year: int,
    month: int | None,
    account_id: int | None = None,
    expense_category_id: int | None = None,
    income_category_id: int | None = None,
    card_id: int | None = None,
    breakdown: str = 'all',
) -> dict[str, Any]:
    if module == 'expenses':
        return expenses_table(
            db,
            profile_id,
            granularity=granularity,
            year=year,
            month=month,
            account_id=account_id,
            expense_category_id=expense_category_id,
        )
    if module == 'income':
        return income_table(
            db,
            profile_id,
            granularity=granularity,
            year=year,
            month=month,
            account_id=account_id,
            income_category_id=income_category_id,
        )
    if module == 'accounts':
        return accounts_table(db, profile_id, granularity=granularity, year=year, month=month, account_id=account_id)
    if module == 'movements':
        return movements_table(db, profile_id, granularity=granularity, year=year, month=month, account_id=account_id)
    if module == 'cash-flow':
        return cash_flow_table(
            db,
            profile_id,
            granularity=granularity,
            year=year,
            month=month,
            account_id=account_id,
            breakdown=breakdown,
        )
    if module == 'credit-cards':
        return credit_cards_table(
            db, profile_id, granularity=granularity, year=year, month=month, card_id=card_id
        )
    if module == 'loans':
        return loans_table(db, profile_id, granularity=granularity, year=year, month=month)
    if module == 'investments':
        return investments_table(db, profile_id, granularity=granularity, year=year, month=month)
    if module == 'liabilities':
        return liabilities_table(db, profile_id, granularity=granularity, year=year, month=month)
    if module == 'assets':
        return assets_table(db, profile_id, granularity=granularity, year=year, month=month)
    if module == 'financial-statement':
        return financial_statement_table(
            db, profile_id, granularity=granularity, year=year, month=month, account_id=account_id
        )
    if module == 'reports':
        out = financial_statement_table(
            db, profile_id, granularity=granularity, year=year, month=month, account_id=account_id
        )
        out['module'] = 'reports'
        return out
    return {'module': module, 'granularity': granularity, 'rows': [], 'partial': True}


def dispatch_insights(
    db: Session,
    profile_id: int,
    module: str,
    *,
    year: int,
    month: int,
    account_id: int | None = None,
    expense_category_id: int | None = None,
    income_category_id: int | None = None,
    card_id: int | None = None,
    breakdown: str = 'all',
) -> dict[str, Any]:
    if module == 'expenses':
        return expenses_insights(
            db,
            profile_id,
            year=year,
            month=month,
            account_id=account_id,
            expense_category_id=expense_category_id,
        )
    if module == 'income':
        return income_insights(
            db,
            profile_id,
            year=year,
            month=month,
            account_id=account_id,
            income_category_id=income_category_id,
        )
    if module == 'accounts':
        return accounts_insights(db, profile_id, year=year, month=month, account_id=account_id)
    if module == 'movements':
        return movements_insights(db, profile_id, year=year, month=month, account_id=account_id)
    if module == 'cash-flow':
        return cash_flow_insights(
            db, profile_id, year=year, month=month, account_id=account_id, breakdown=breakdown
        )
    if module == 'credit-cards':
        return credit_cards_insights(db, profile_id, year=year, month=month, card_id=card_id)
    if module == 'loans':
        return loans_insights(db, profile_id, year=year, month=month)
    if module == 'investments':
        return investments_insights(db, profile_id, year=year, month=month)
    if module == 'liabilities':
        return liabilities_insights(db, profile_id, year=year, month=month)
    if module == 'assets':
        return assets_insights(db, profile_id, year=year, month=month)
    if module == 'financial-statement':
        return financial_statement_insights(db, profile_id, year=year, month=month, account_id=account_id)
    if module == 'reports':
        out = financial_statement_insights(db, profile_id, year=year, month=month, account_id=account_id)
        out['module'] = 'reports'
        return out
    return {'module': module, 'insights': [], 'warnings': [], 'partial': True}
