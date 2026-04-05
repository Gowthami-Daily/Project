"""
Modular analytics for Personal Finance — live aggregates (TASK 6-style paths under /pf/analytics).

Snapshot tables (TASK 5) can back these later without changing the response shape.
"""

from __future__ import annotations

from calendar import monthrange
from datetime import date, timedelta
from typing import Any, Literal

from sqlalchemy.orm import Session

from fastapi_service.models_extended import PfIncomeCategory
from fastapi_service.repositories import pf_analytics_repo, pf_chit_fund_repo, pf_credit_card_repo, pf_finance_repo

Granularity = Literal['daily', 'monthly']

ANALYTICS_MODULES: frozenset[str] = frozenset(
    {
        'expenses',
        'income',
        'accounts',
        'movements',
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
) -> dict[str, Any]:
    util = pf_credit_card_repo.card_utilization_rows(db, profile_id)
    total_limit = sum(float(r.get('card_limit') or 0) for r in util)
    used = sum(float(r.get('used_amount') or 0) for r in util)
    avail = max(0.0, total_limit - used)
    pct = round((used / total_limit) * 100, 2) if total_limit > 0.01 else 0.0
    dash = pf_credit_card_repo.dashboard_summary(db, profile_id, period_year=year, period_month=month)
    spend_m = pf_credit_card_repo.total_spend_month(db, profile_id, period_year=year, period_month=month)
    paid_m = float(dash.get('paid_this_month') or 0)
    return {
        'module': 'credit-cards',
        'partial': False,
        'kpis': {
            'total_amount': round(total_limit, 2),
            'inflow': round(paid_m, 2),
            'outflow': round(float(spend_m), 2),
            'net_change': round(paid_m - float(spend_m), 2),
            'average': round(used / max(len(util), 1), 2),
            'highest': round(max((float(r.get('used_amount') or 0) for r in util), default=0.0), 2),
            'lowest': round(min((float(r.get('used_amount') or 0) for r in util), default=0.0), 2),
        },
        'utilization_pct': pct,
        'available': round(avail, 2),
        'used': round(used, 2),
        'limit': round(total_limit, 2),
        'dashboard': dash,
        'cards': util,
    }


def loans_packaged(db: Session, profile_id: int) -> dict[str, Any]:
    rows = pf_finance_repo.list_loans(db, profile_id, 0, 500, None, None)
    lent_principal = sum(float(r.loan_amount or 0) for r in rows)
    outstanding = sum(
        float(r.remaining_amount if r.remaining_amount is not None else r.loan_amount or 0) for r in rows
    )
    borrowed_liab = pf_finance_repo.sum_liabilities(db, profile_id)
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
            'highest': round(max((float(r.loan_amount or 0) for r in rows), default=0.0), 2),
            'lowest': round(min((float(r.loan_amount or 0) for r in rows), default=0.0), 2),
        },
        'outstanding_lent': round(outstanding, 2),
        'notes': 'Borrowed side overlaps Liabilities module; use Loans page for schedules.',
    }


def investments_packaged(db: Session, profile_id: int) -> dict[str, Any]:
    inv = pf_finance_repo.list_investments(db, profile_id, 0, 500)
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


def liabilities_packaged(db: Session, profile_id: int) -> dict[str, Any]:
    out = pf_finance_repo.sum_liabilities(db, profile_id)
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


def assets_packaged(db: Session, profile_id: int) -> dict[str, Any]:
    assets = pf_finance_repo.list_all_assets(db, profile_id)
    from fastapi_service.services.pf_asset_valuation import effective_current_value

    total = sum(effective_current_value(r) for r in assets)
    chit = pf_chit_fund_repo.sum_net_asset_value_profile(db, profile_id)
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
    if module == 'credit-cards':
        return credit_cards_packaged(db, profile_id, year=year, month=month)
    if module == 'loans':
        return loans_packaged(db, profile_id)
    if module == 'investments':
        return investments_packaged(db, profile_id)
    if module == 'liabilities':
        return liabilities_packaged(db, profile_id)
    if module == 'assets':
        return assets_packaged(db, profile_id)
    if module in ('financial-statement', 'reports'):
        return _stub(module, 'Use Financial statement or Reports hub for full statements; analytics API is ledger-focused.')
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
    if module == 'credit-cards':
        cats = pf_credit_card_repo.spend_by_category_year(db, profile_id, year)
        return {'module': 'credit-cards', 'slices': [{'name': str(c.get('name', '')), 'value': float(c.get('amount', 0))} for c in cats]}
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
    return {'module': module, 'insights': [], 'warnings': [], 'partial': True}
