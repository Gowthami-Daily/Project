"""Tax dashboard: combine repo + India tax engine."""

from __future__ import annotations

from calendar import monthrange
from datetime import date
from typing import Any, Literal

from sqlalchemy.orm import Session

from fastapi_service.models_extended import PfCapitalGain, PfIncomeTaxSource, PfTaxDeduction, PfTaxTransaction
from fastapi_service.repositories import pf_tax_repo
from fastapi_service.services import india_income_tax as itax

Regime = Literal['old', 'new']


def _normalize_section_key(section: str) -> str:
    s = (section or '').upper().replace(' ', '')
    if '80CCD' in s or s == 'NPS':
        return '80CCD'
    if s in ('24', 'SECTION24', 'HOMELOAN', 'HOME_LOAN_INTEREST'):
        return '24'
    if s.startswith('80C'):
        return '80C'
    if s.startswith('80D'):
        return '80D'
    if 'HRA' in s:
        return 'HRA'
    if s.startswith('80E'):
        return '80E'
    if s.startswith('80G'):
        return '80G'
    return section or 'OTHER'


def normalize_deduction_totals(raw: dict[str, float]) -> dict[str, float]:
    out: dict[str, float] = {}
    for k, v in raw.items():
        nk = _normalize_section_key(k)
        out[nk] = out.get(nk, 0.0) + float(v)
    return out


def _cap_progress(used: float, cap: float) -> dict[str, Any]:
    cap = max(cap, 0.01)
    pct = min(100.0, round(used / cap * 100, 1))
    return {'used': round(used, 2), 'cap': cap, 'pct': pct, 'remaining': round(max(0.0, cap - used), 2)}


def compute_tax_snapshot(
    db: Session,
    profile_id: int,
    fy_start: int,
    *,
    regime: Regime,
) -> dict[str, Any]:
    total_income = pf_tax_repo.sum_income_sources_fy(db, profile_id, fy_start)
    raw_ded = pf_tax_repo.sum_deductions_by_section_fy(db, profile_id, fy_start)
    ded_engine = normalize_deduction_totals(raw_ded)
    capped = itax.clamp_deductions_by_section(ded_engine)
    gain_total, cgt_total = pf_tax_repo.capital_gains_totals_fy(db, profile_id, fy_start)
    tx = pf_tax_repo.sum_tax_transactions_fy(db, profile_id, fy_start)
    tax_paid_net = tx['paid'] - tx['refund']

    calc = itax.compute_income_tax(
        regime=regime,
        total_income=total_income,
        deduction_totals_by_section=ded_engine,
        capital_gains_tax_already=cgt_total,
    )
    total_tax = calc['total_tax']
    remaining = round(total_tax - tax_paid_net, 2)
    eff = round(total_tax / total_income * 100, 2) if total_income > 0.01 else 0.0

    taxable_for_marginal = calc['taxable_income']
    mrate = itax.marginal_rate_estimate(taxable_for_marginal, regime)
    tax_saved_estimate = round(min(capped.get('80C', 0), itax.CAP_80C) * mrate, 2) if regime == 'old' else 0.0

    return {
        'fy_start_year': fy_start,
        'fy_label': itax.fy_label(fy_start),
        'regime': regime,
        'total_income': round(total_income, 2),
        'deductions_total': calc['deductions_total'],
        'deductions_by_section': {k: round(v, 2) for k, v in raw_ded.items()},
        'deductions_capped': calc.get('deductions_capped', {}),
        'taxable_income': calc['taxable_income'],
        'tax_liability': total_tax,
        'income_tax_component': calc['income_tax_component'],
        'cess': calc['cess'],
        'capital_gains': round(gain_total, 2),
        'capital_gains_tax': round(cgt_total, 2),
        'tax_paid': round(tax_paid_net, 2),
        'tax_remaining': remaining,
        'refund_expected': round(-remaining, 2) if remaining < 0 else 0.0,
        'effective_tax_rate_pct': eff,
        'tax_saved_estimate': tax_saved_estimate,
    }


def tax_summary(
    db: Session,
    profile_id: int,
    *,
    fy_start: int,
    cal_year: int,
    cal_month: int,
    regime: Regime,
    granularity: Literal['daily', 'monthly'],
) -> dict[str, Any]:
    snap = compute_tax_snapshot(db, profile_id, fy_start, regime=regime)
    progress = {
        '80C': _cap_progress(
            float(snap['deductions_capped'].get('80C', 0) if regime == 'old' else 0),
            itax.CAP_80C,
        ),
        '80D': _cap_progress(
            float(snap['deductions_capped'].get('80D', 0) if regime == 'old' else 0),
            itax.CAP_80D,
        ),
        '80CCD': _cap_progress(
            float(snap['deductions_capped'].get('80CCD', 0) if regime == 'old' else 0),
            itax.CAP_80CCD1B,
        ),
        '24': _cap_progress(
            float(snap['deductions_capped'].get('24', 0) if regime == 'old' else 0),
            itax.CAP_24,
        ),
    }
    return {
        'module': 'tax',
        'granularity': granularity,
        'period': {'fy': snap['fy_label'], 'calendar_month': f'{cal_year}-{cal_month:02d}'},
        'hero': {
            'taxable_income': snap['taxable_income'],
            'total_tax_liability': snap['tax_liability'],
            'tax_paid': snap['tax_paid'],
            'tax_remaining': snap['tax_remaining'],
            'effective_tax_rate_pct': snap['effective_tax_rate_pct'],
        },
        'kpis': {
            'total_income': snap['total_income'],
            'deductions': snap['deductions_total'],
            'taxable_income': snap['taxable_income'],
            'tax_liability': snap['tax_liability'],
            'tax_paid': snap['tax_paid'],
            'tax_remaining': snap['tax_remaining'],
            'tax_saved': snap['tax_saved_estimate'],
            'capital_gains_tax': snap['capital_gains_tax'],
        },
        'tax_calculation': snap,
        'savings_progress': progress,
    }


def tax_trend(
    db: Session,
    profile_id: int,
    *,
    fy_start: int,
    cal_year: int,
    cal_month: int,
    granularity: Literal['daily', 'monthly'],
) -> dict[str, Any]:
    if granularity == 'daily':
        inc = pf_tax_repo.daily_series_income(db, profile_id, fy_start, cal_year, cal_month)
        tax = pf_tax_repo.daily_series_tax_paid(db, profile_id, fy_start, cal_year, cal_month)
        tax_map = dict(tax)
        series = []
        for d, inv in inc:
            series.append(
                {
                    'label': d.isoformat(),
                    'date': d.isoformat(),
                    'income': round(inv, 2),
                    'tax_paid': round(tax_map.get(d, 0.0), 2),
                }
            )
        for d, tv in tax:
            if d not in dict(inc):
                series.append(
                    {
                        'label': d.isoformat(),
                        'date': d.isoformat(),
                        'income': 0.0,
                        'tax_paid': round(tv, 2),
                    }
                )
        series.sort(key=lambda x: x['label'])
        return {'module': 'tax', 'granularity': 'daily', 'series': series}
    rows = pf_tax_repo.monthly_aggregates_fy(db, profile_id, fy_start)
    return {'module': 'tax', 'granularity': 'monthly', 'series': rows}


def tax_distribution(
    db: Session,
    profile_id: int,
    *,
    fy_start: int,
    regime: Regime,
) -> dict[str, Any]:
    snap = compute_tax_snapshot(db, profile_id, fy_start, regime=regime)
    slices = []
    for k, v in sorted(snap.get('deductions_capped', {}).items(), key=lambda x: -x[1]):
        if v > 0.01:
            slices.append({'name': k, 'value': round(v, 2)})
    if not slices and regime == 'old':
        raw = snap.get('deductions_by_section', {})
        for k, v in sorted(raw.items(), key=lambda x: -x[1]):
            if v > 0.01:
                slices.append({'name': k, 'value': round(v, 2)})
    return {'module': 'tax', 'slices': slices}


def tax_table(
    db: Session,
    profile_id: int,
    *,
    fy_start: int,
    cal_year: int,
    cal_month: int,
    granularity: Literal['daily', 'monthly'],
    regime: Regime,
) -> dict[str, Any]:
    if granularity == 'monthly':
        return {'module': 'tax', 'granularity': 'monthly', 'rows': pf_tax_repo.monthly_aggregates_fy(db, profile_id, fy_start)}
    inc = dict(pf_tax_repo.daily_series_income(db, profile_id, fy_start, cal_year, cal_month))
    ded = dict(pf_tax_repo.daily_series_deductions(db, profile_id, fy_start, cal_year, cal_month))
    tax = dict(pf_tax_repo.daily_series_tax_paid(db, profile_id, fy_start, cal_year, cal_month))
    cg = pf_tax_repo.daily_series_capital_gains(db, profile_id, fy_start, cal_year, cal_month)
    cg_by_date: dict[date, tuple[float, float]] = {}
    for d, g, t in cg:
        cg_by_date[d] = (cg_by_date.get(d, (0.0, 0.0))[0] + g, cg_by_date.get(d, (0.0, 0.0))[1] + t)
    all_dates = sorted(set(inc) | set(ded) | set(tax) | set(cg_by_date))
    rows = []
    for d in all_dates:
        g, gt = cg_by_date.get(d, (0.0, 0.0))
        rows.append(
            {
                'date': d.isoformat(),
                'income': round(inc.get(d, 0.0), 2),
                'deductions': round(ded.get(d, 0.0), 2),
                'tax_paid': round(tax.get(d, 0.0), 2),
                'capital_gains': round(g, 2),
                'capital_gains_tax': round(gt, 2),
            }
        )
    return {'module': 'tax', 'granularity': 'daily', 'rows': rows}


def tax_insights(
    db: Session,
    profile_id: int,
    *,
    fy_start: int,
    regime: Regime,
) -> dict[str, Any]:
    snap = compute_tax_snapshot(db, profile_id, fy_start, regime=regime)
    bullets: list[str] = []
    ti = snap['taxable_income']
    mrate = itax.marginal_rate_estimate(ti, regime)
    bullets.append(f"Estimated marginal tax rate (approx): {mrate * 100:.0f}% on next rupee.")
    if regime == 'old':
        p = snap.get('deductions_capped', {})
        u80 = float(p.get('80C', 0))
        pct = round(u80 / itax.CAP_80C * 100, 0) if itax.CAP_80C else 0
        bullets.append(f"80C room used: about {pct:.0f}% of ₹{itax.CAP_80C:,.0f} cap.")
        rem = max(0.0, itax.CAP_80C - u80)
        bullets.append(f"You could still allocate up to ₹{rem:,.0f} more under 80C (subject to eligibility).")
    bullets.append(f"Taxable income (FY {snap['fy_label']}): ₹{ti:,.2f}.")
    bullets.append(f"Total tax (incl. cess & capital gains tax): ₹{snap['tax_liability']:,.2f}.")
    bullets.append(f"Capital gains tax booked: ₹{snap['capital_gains_tax']:,.2f}.")
    if snap['tax_remaining'] > 0.01:
        bullets.append(f"Pay ₹{snap['tax_remaining']:,.2f} to settle liability (per model; verify with CA).")
    elif snap['refund_expected'] > 0.01:
        bullets.append(f"Model suggests refund headroom of ₹{snap['refund_expected']:,.2f} vs taxes paid.")
    warnings: list[str] = []
    if snap['total_income'] <= 0.01:
        warnings.append('No income tax sources recorded for this FY — add salary/business/other income.')
    return {'module': 'tax', 'insights': bullets, 'warnings': warnings}
