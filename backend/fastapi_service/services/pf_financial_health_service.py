"""Composite financial health score (0–100) from live PF data."""

from __future__ import annotations

import statistics
from calendar import monthrange
from datetime import date
from typing import Any, Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from fastapi_service.models_extended import PfFinancialHealthHistory
from fastapi_service.repositories import pf_credit_card_repo, pf_finance_repo


def _clamp01(x: float) -> float:
    return max(0.0, min(1.0, x))


def _score_savings_rate(rate: float) -> float:
    if rate >= 0.25:
        return 100.0
    if rate <= 0:
        return 0.0
    return 100.0 * _clamp01(rate / 0.25)


def _score_emergency_months(m: float) -> float:
    if m >= 6:
        return 100.0
    return 100.0 * _clamp01(m / 6.0)


def _score_credit_util(pct: float) -> float:
    if pct <= 30:
        return 100.0
    if pct >= 90:
        return 20.0
    return 100.0 - (pct - 30) * (80.0 / 60.0)


def _score_dti(dti: float) -> float:
    if dti <= 0.15:
        return 100.0
    if dti >= 0.5:
        return 25.0
    return 100.0 - (dti - 0.15) * (75.0 / 0.35)


def _score_investment_ratio(r: float) -> float:
    if r >= 0.2:
        return 100.0
    return 100.0 * _clamp01(r / 0.2)


def _score_expense_stability(cv: float) -> float:
    if cv <= 0.15:
        return 100.0
    if cv >= 0.6:
        return 30.0
    return max(30.0, 100.0 - (cv - 0.15) * (70.0 / 0.45))


def _shift_month(y: int, m: int, delta: int) -> tuple[int, int]:
    m2 = m + delta
    y2 = y
    while m2 <= 0:
        m2 += 12
        y2 -= 1
    while m2 > 12:
        m2 -= 12
        y2 += 1
    return y2, m2


def _month_expense(db: Session, profile_id: int, y: int, m: int) -> float:
    s = date(y, m, 1)
    e = date(y, m, monthrange(y, m)[1])
    return float(pf_finance_repo.sum_expense_scoped(db, profile_id, s, e, account_id=None))


def _month_income(db: Session, profile_id: int, y: int, m: int) -> float:
    s = date(y, m, 1)
    e = date(y, m, monthrange(y, m)[1])
    return float(pf_finance_repo.sum_income_scoped(db, profile_id, s, e, account_id=None))


def compute_health_metrics(db: Session, profile_id: int) -> dict[str, Any]:
    today = date.today()
    weights = {
        'savings_rate': 0.20,
        'emergency_fund_months': 0.15,
        'credit_utilization': 0.15,
        'debt_to_income': 0.15,
        'investment_ratio': 0.15,
        'net_worth_growth': 0.10,
        'expense_stability': 0.10,
    }

    inc3 = 0.0
    exp3 = 0.0
    for i in range(3):
        y, m = _shift_month(today.year, today.month, -i)
        inc3 += _month_income(db, profile_id, y, m)
        exp3 += _month_expense(db, profile_id, y, m)
    savings_rate = (inc3 - exp3) / inc3 if inc3 > 0.01 else 0.0
    s_sr = _score_savings_rate(savings_rate)

    exp6 = [_month_expense(db, profile_id, *_shift_month(today.year, today.month, -k)) for k in range(6)]
    avg_exp = sum(exp6) / max(len(exp6), 1)
    split = pf_finance_repo.sum_account_balances_cash_vs_bank(db, profile_id)
    liquid = float(split.get('total', 0) or 0)
    em_mo = liquid / avg_exp if avg_exp > 0.01 else 0.0
    s_em = _score_emergency_months(em_mo)

    util_rows = pf_credit_card_repo.card_utilization_rows(db, profile_id)
    avg_u = sum(float(r.get('utilization_pct') or 0) for r in util_rows) / max(len(util_rows), 1)
    s_cu = _score_credit_util(avg_u)

    liab = float(pf_finance_repo.sum_liabilities(db, profile_id))
    annual_inc = inc3 / 3.0 * 12.0 if inc3 > 0.01 else 0.0
    dti = (liab * 0.05 / annual_inc) if annual_inc > 0.01 else 0.0
    dti = min(dti, 1.5)
    s_dt = _score_dti(dti)

    inv = pf_finance_repo.list_investments(db, profile_id, 0, 500)
    inv_val = sum(float(r.current_value or r.invested_amount or 0) for r in inv)
    inv_r = inv_val / annual_inc if annual_inc > 0.01 else 0.0
    s_ir = _score_investment_ratio(inv_r)

    s_nw = 70.0

    mean_e = statistics.mean(exp6) if exp6 else 0.0
    cv = statistics.pstdev(exp6) / (mean_e + 0.01) if len(exp6) > 1 and mean_e > 0.01 else 0.0
    s_es = _score_expense_stability(cv)

    total = (
        weights['savings_rate'] * s_sr
        + weights['emergency_fund_months'] * s_em
        + weights['credit_utilization'] * s_cu
        + weights['debt_to_income'] * s_dt
        + weights['investment_ratio'] * s_ir
        + weights['net_worth_growth'] * s_nw
        + weights['expense_stability'] * s_es
    )
    score = round(min(100.0, max(0.0, total)), 1)

    status = 'Needs attention'
    if score >= 80:
        status = 'Excellent'
    elif score >= 60:
        status = 'Good'

    return {
        'score': score,
        'status': status,
        'savings_rate': round(savings_rate, 4),
        'emergency_fund_months': round(em_mo, 2),
        'credit_utilization': round(avg_u, 2),
        'debt_to_income': round(dti, 4),
        'investment_ratio': round(inv_r, 4),
        'net_worth_growth': 0.0,
        'expense_stability': round(1.0 - _clamp01(cv), 4),
        'breakdown_scores': {
            'savings_rate': round(s_sr, 1),
            'emergency_fund_months': round(s_em, 1),
            'credit_utilization': round(s_cu, 1),
            'debt_to_income': round(s_dt, 1),
            'investment_ratio': round(s_ir, 1),
            'net_worth_growth': round(s_nw, 1),
            'expense_stability': round(s_es, 1),
        },
        'context': {'liquid_total': round(liquid, 2), 'avg_monthly_expense_6m': round(avg_exp, 2)},
    }


def persist_snapshot(db: Session, profile_id: int, metrics: dict) -> None:
    row = PfFinancialHealthHistory(
        profile_id=profile_id,
        snapshot_date=date.today(),
        score=metrics['score'],
        savings_rate=metrics.get('savings_rate'),
        emergency_fund_months=metrics.get('emergency_fund_months'),
        credit_utilization=metrics.get('credit_utilization'),
        debt_to_income=metrics.get('debt_to_income'),
        investment_ratio=metrics.get('investment_ratio'),
        net_worth_growth=metrics.get('net_worth_growth'),
        expense_stability=metrics.get('expense_stability'),
    )
    db.add(row)
    db.commit()


def health_summary(db: Session, profile_id: int, *, persist: bool = False) -> dict[str, Any]:
    m = compute_health_metrics(db, profile_id)
    if persist:
        persist_snapshot(db, profile_id, m)
    return {'module': 'financial-health', 'hero': {'score': m['score'], 'status': m['status']}, 'metrics': m}


def health_trend_networth_savings(
    db: Session, profile_id: int, *, year: int
) -> dict[str, Any]:
    series_nw: list[dict] = []
    series_sr: list[dict] = []
    series_dti: list[dict] = []
    for m in range(1, 13):
        y, mo = year, m
        inc = _month_income(db, profile_id, y, mo)
        exp = _month_expense(db, profile_id, y, mo)
        sr = round((inc - exp) / inc, 4) if inc > 0.01 else 0.0
        nw = float(pf_finance_repo.net_worth_from_finance_accounts_only(db, profile_id))
        liab = float(pf_finance_repo.sum_liabilities(db, profile_id))
        annual_inc = inc * 12.0
        dti = round((liab * 0.05) / annual_inc, 4) if annual_inc > 0.01 else 0.0
        label = f'{year}-{m:02d}'
        series_nw.append({'label': label, 'net_worth': round(nw, 2)})
        series_sr.append({'label': label, 'savings_rate': sr})
        series_dti.append({'label': label, 'debt_to_income': dti})
    return {'net_worth': series_nw, 'savings_rate': series_sr, 'debt_to_income': series_dti}


def health_trend(db: Session, profile_id: int, *, year: int, granularity: Literal['daily', 'monthly']) -> dict[str, Any]:
    if granularity == 'daily':
        return {
            'module': 'financial-health',
            'granularity': 'daily',
            'series': [],
            'message': 'Record daily snapshots via POST /pf/financial-health/recalculate to build a daily score series.',
        }
    stmt = (
        select(PfFinancialHealthHistory)
        .where(
            PfFinancialHealthHistory.profile_id == profile_id,
            PfFinancialHealthHistory.snapshot_date >= date(year, 1, 1),
            PfFinancialHealthHistory.snapshot_date <= date(year, 12, 31),
        )
        .order_by(PfFinancialHealthHistory.snapshot_date)
    )
    rows = []
    for r in db.scalars(stmt).all():
        rows.append({'label': r.snapshot_date.isoformat(), 'score': float(r.score)})
    if not rows:
        m = compute_health_metrics(db, profile_id)
        rows = [{'label': f'{year}-{i:02d}', 'score': m['score']} for i in range(1, 13)]
    extra = health_trend_networth_savings(db, profile_id, year=year)
    return {
        'module': 'financial-health',
        'granularity': 'monthly',
        'series': rows,
        'net_worth_trend': extra['net_worth'],
        'savings_rate_trend': extra['savings_rate'],
        'debt_to_income_trend': extra['debt_to_income'],
    }


def health_table(db: Session, profile_id: int, *, year: int) -> dict[str, Any]:
    stmt = (
        select(PfFinancialHealthHistory)
        .where(
            PfFinancialHealthHistory.profile_id == profile_id,
            PfFinancialHealthHistory.snapshot_date >= date(year, 1, 1),
            PfFinancialHealthHistory.snapshot_date <= date(year, 12, 31),
        )
        .order_by(PfFinancialHealthHistory.snapshot_date.desc())
    )
    out = []
    for r in db.scalars(stmt).all():
        out.append(
            {
                'date': r.snapshot_date.isoformat(),
                'score': float(r.score),
                'savings_rate': float(r.savings_rate) if r.savings_rate is not None else None,
                'emergency_fund_months': float(r.emergency_fund_months) if r.emergency_fund_months is not None else None,
                'credit_utilization': float(r.credit_utilization) if r.credit_utilization is not None else None,
                'debt_to_income': float(r.debt_to_income) if r.debt_to_income is not None else None,
            }
        )
    if not out:
        m = compute_health_metrics(db, profile_id)
        out.append(
            {
                'date': date.today().isoformat(),
                'score': m['score'],
                'savings_rate': m['savings_rate'],
                'emergency_fund_months': m['emergency_fund_months'],
                'credit_utilization': m['credit_utilization'],
                'debt_to_income': m['debt_to_income'],
            }
        )
    return {'module': 'financial-health', 'rows': out}


def health_insights(db: Session, profile_id: int) -> dict[str, Any]:
    m = compute_health_metrics(db, profile_id)
    bullets: list[str] = []
    bullets.append(f"Composite score {m['score']}/100 — {m['status']}.")
    bullets.append(f"Emergency fund runway ≈ {m['emergency_fund_months']:.1f} months of spend (liquid / recent avg).")
    if m['credit_utilization'] <= 35:
        bullets.append('Credit utilization looks healthy.')
    else:
        bullets.append('Credit utilization is elevated — paying down balances improves this pillar.')
    if m['debt_to_income'] > 0.35:
        bullets.append('Debt-to-income proxy is high — focus on reducing liabilities or growing income.')
    if m['investment_ratio'] < 0.1:
        bullets.append('Increasing investments toward 10–20% of income can lift your score.')
    warnings = [b for b in bullets if 'high' in b.lower() or 'elevated' in b.lower()]
    return {'module': 'financial-health', 'insights': bullets, 'warnings': warnings}
