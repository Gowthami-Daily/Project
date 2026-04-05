"""Budget dashboard aggregates."""

from __future__ import annotations

from calendar import monthrange
from datetime import date
from typing import Any, Literal

from sqlalchemy.orm import Session

from fastapi_service.repositories import pf_budget_repo, pf_finance_repo


def _match_cat(db: Session, profile_id: int, budget_id: int, cat_id: int) -> bool:
    b = pf_budget_repo.get_budget(db, budget_id, profile_id)
    return b is not None and b.expense_category_id == cat_id


def budget_summary(
    db: Session,
    profile_id: int,
    *,
    year: int,
    month: int,
    expense_category_id: int | None,
    granularity: Literal['daily', 'monthly'],
) -> dict[str, Any]:
    rows = pf_budget_repo.budget_rows_for_month(db, profile_id, year, month)
    if expense_category_id is not None:
        rows = [r for r in rows if _match_cat(db, profile_id, r['budget_id'], expense_category_id)]
    total_b = sum(r['budget'] for r in rows)
    total_s = sum(r['spent'] for r in rows)
    over_n = sum(1 for r in rows if r['status'] == 'over')
    savings_potential = sum(max(0.0, r['remaining']) for r in rows)
    return {
        'module': 'budget',
        'granularity': granularity,
        'period': {'year': year, 'month': month},
        'filters': {'expense_category_id': expense_category_id},
        'kpis': {
            'total_budget': round(total_b, 2),
            'total_spent': round(total_s, 2),
            'remaining_budget': round(total_b - total_s, 2),
            'over_budget_categories': over_n,
            'savings_potential': round(savings_potential, 2),
        },
        'category_rows': rows,
    }


def budget_trend(
    db: Session,
    profile_id: int,
    *,
    year: int,
    month: int,
    expense_category_id: int | None,
    granularity: Literal['daily', 'monthly'],
) -> dict[str, Any]:
    budgets = pf_budget_repo.list_budgets(db, profile_id)
    if expense_category_id is not None:
        budgets = [b for b in budgets if b.expense_category_id == expense_category_id]

    if granularity == 'daily':
        series: list[dict] = []
        for b in budgets:
            pts = pf_budget_repo.daily_spend_series(db, profile_id, b, year, month)
            for d, amt in pts:
                series.append({'label': d.isoformat(), 'date': d.isoformat(), 'budget_id': b.id, 'spent': round(amt, 2)})
        series.sort(key=lambda x: x['label'])
        daily_budget_pace = 0.0
        if len(budgets) == 1:
            dim = monthrange(year, month)[1]
            daily_budget_pace = round(float(budgets[0].monthly_budget or 0) / dim, 2)
        return {
            'module': 'budget',
            'granularity': 'daily',
            'series': series,
            'daily_budget_pace': daily_budget_pace,
        }

    series_m: list[dict] = []
    for m in range(1, 13):
        rows = pf_budget_repo.budget_rows_for_month(db, profile_id, year, m)
        if expense_category_id is not None:
            rows = [r for r in rows if _match_cat(db, profile_id, r['budget_id'], expense_category_id)]
        series_m.append(
            {
                'label': f'{year}-{m:02d}',
                'month': f'{year}-{m:02d}',
                'budget': round(sum(r['budget'] for r in rows), 2),
                'spent': round(sum(r['spent'] for r in rows), 2),
            }
        )
    return {'module': 'budget', 'granularity': 'monthly', 'series': series_m}


def budget_distribution(
    db: Session,
    profile_id: int,
    *,
    year: int,
    month: int,
    expense_category_id: int | None,
) -> dict[str, Any]:
    rows = pf_budget_repo.budget_rows_for_month(db, profile_id, year, month)
    if expense_category_id is not None:
        rows = [r for r in rows if _match_cat(db, profile_id, r['budget_id'], expense_category_id)]
    slices = [{'name': r['category'], 'value': r['budget']} for r in rows if r['budget'] > 0.01]
    return {'module': 'budget', 'slices': slices}


def budget_table(
    db: Session,
    profile_id: int,
    *,
    year: int,
    month: int,
    expense_category_id: int | None,
    granularity: Literal['daily', 'monthly'],
) -> dict[str, Any]:
    if granularity == 'daily':
        t = budget_trend(db, profile_id, year=year, month=month, expense_category_id=expense_category_id, granularity='daily')
        return {'module': 'budget', 'granularity': 'daily', 'rows': t['series']}
    rows = pf_budget_repo.budget_rows_for_month(db, profile_id, year, month)
    if expense_category_id is not None:
        rows = [r for r in rows if _match_cat(db, profile_id, r['budget_id'], expense_category_id)]
    return {'module': 'budget', 'granularity': 'monthly', 'rows': rows}


def budget_insights(
    db: Session,
    profile_id: int,
    *,
    year: int,
    month: int,
    expense_category_id: int | None,
) -> dict[str, Any]:
    rows = pf_budget_repo.budget_rows_for_month(db, profile_id, year, month)
    if expense_category_id is not None:
        rows = [r for r in rows if _match_cat(db, profile_id, r['budget_id'], expense_category_id)]
    bullets: list[str] = []
    for r in rows:
        if r['status'] == 'over':
            ov = r['spent'] - r['budget']
            pct = round(ov / r['budget'] * 100, 0) if r['budget'] > 0.01 else 0
            bullets.append(f"You exceeded {r['category']} budget by about {pct:.0f}% (₹{ov:,.2f}).")
        elif r['remaining'] > 0.01 and r['pct_used'] < 80:
            bullets.append(f"You saved ₹{r['remaining']:,.2f} vs budget on {r['category']}.")
    over = sum(1 for r in rows if r['status'] == 'over')
    if over:
        bullets.append(f"{over} budget line(s) are over limit this month.")
    ms = date(year, month, 1)
    me = date(year, month, monthrange(year, month)[1])
    exp = float(pf_finance_repo.sum_expense_scoped(db, profile_id, ms, me, account_id=None))
    today = date.today()
    dim = monthrange(year, month)[1]
    if year == today.year and month == today.month:
        day_n = max(1, today.day)
    else:
        day_n = dim
    if exp > 0.01 and day_n > 0:
        pace = round(exp / day_n * dim, 2)
        bullets.append(f"If spending pace continues, projected month-end expense ≈ ₹{pace:,.2f}.")
    warnings = [b for b in bullets if 'exceeded' in b.lower()]
    return {'module': 'budget', 'insights': bullets, 'warnings': warnings}
