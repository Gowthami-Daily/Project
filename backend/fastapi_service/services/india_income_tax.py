"""
Indian income tax helpers: FY bounds, old/new regime slabs, cess, rebate 87A, capital gains tax.

Simplified for dashboard use — not a substitute for a chartered accountant.
"""

from __future__ import annotations

from calendar import monthrange
from datetime import date
from typing import Literal

Regime = Literal['old', 'new']

# Section caps (old regime) — rupees
CAP_80C = 150_000
CAP_80D = 25_000
CAP_80CCD1B = 50_000
CAP_24 = 200_000


def fy_start_for_date(d: date) -> int:
    """FY 2025-26 starts Apr 2025 → returns 2025."""
    return d.year if d.month >= 4 else d.year - 1


def fy_label(fy_start: int) -> str:
    return f'{fy_start}-{str(fy_start + 1)[-2:]}'


def fy_date_bounds(fy_start: int) -> tuple[date, date]:
    start = date(fy_start, 4, 1)
    end = date(fy_start + 1, 3, 31)
    return start, end


def month_in_fy(fy_start: int, month_index: int) -> tuple[int, int]:
    """
    month_index 1 = April (first month of FY), 12 = March.
    Returns (calendar_year, calendar_month).
    """
    if month_index < 1 or month_index > 12:
        raise ValueError('month_index must be 1–12 (Apr–Mar)')
    if month_index <= 9:
        return fy_start, month_index + 3
    return fy_start + 1, month_index - 9


def calendar_month_bounds_in_fy(fy_start: int, cal_year: int, cal_month: int) -> tuple[date, date]:
    """Bounds for a calendar month; must fall inside FY or clamped."""
    fy_s, fy_e = fy_date_bounds(fy_start)
    ms = date(cal_year, cal_month, 1)
    me = date(cal_year, cal_month, monthrange(cal_year, cal_month)[1])
    if me < fy_s or ms > fy_e:
        return fy_s, fy_s
    return max(ms, fy_s), min(me, fy_e)


def clamp_deductions_by_section(totals: dict[str, float]) -> dict[str, float]:
    """Apply statutory caps to raw section totals."""
    out = {}
    raw_80c = totals.get('80C', 0.0) + totals.get('80CCD', 0.0)
    out['80C'] = min(max(0.0, totals.get('80C', 0.0)), CAP_80C)
    nps_extra = totals.get('80CCD', 0.0)
    out['80CCD'] = min(max(0.0, nps_extra), CAP_80CCD1B)
    out['80D'] = min(max(0.0, totals.get('80D', 0.0)), CAP_80D)
    out['HRA'] = max(0.0, totals.get('HRA', 0.0))
    out['24'] = min(max(0.0, totals.get('24', 0.0)), CAP_24)
    out['80E'] = max(0.0, totals.get('80E', 0.0))
    out['80G'] = max(0.0, totals.get('80G', 0.0))
    return out


def total_deductions_old(capped: dict[str, float]) -> float:
    return sum(capped.values())


def tax_old_regime_slabs(taxable: float) -> float:
    """Tax before cess and rebate; slabs on taxable income."""
    if taxable <= 0:
        return 0.0
    t = 0.0
    remaining = taxable
    # 0 – 2.5L
    slab = min(remaining, 250_000)
    remaining -= slab
    # 2.5L – 5L @ 5%
    if remaining > 0:
        slab = min(remaining, 250_000)
        t += slab * 0.05
        remaining -= slab
    # 5L – 10L @ 20%
    if remaining > 0:
        slab = min(remaining, 500_000)
        t += slab * 0.20
        remaining -= slab
    # Above 10L @ 30%
    if remaining > 0:
        t += remaining * 0.30
    return round(t, 2)


def tax_new_regime_slabs(income: float) -> float:
    """New regime on income after standard deduction (caller passes net)."""
    if income <= 0:
        return 0.0
    t = 0.0
    r = income
    slab = min(r, 300_000)
    r -= slab
    if r > 0:
        slab = min(r, 300_000)
        t += slab * 0.05
        r -= slab
    if r > 0:
        slab = min(r, 300_000)
        t += slab * 0.10
        r -= slab
    if r > 0:
        slab = min(r, 300_000)
        t += slab * 0.15
        r -= slab
    if r > 0:
        slab = min(r, 300_000)
        t += slab * 0.20
        r -= slab
    if r > 0:
        t += r * 0.30
    return round(t, 2)


def add_cess(tax: float, rate: float = 0.04) -> tuple[float, float]:
    cess = round(max(0.0, tax) * rate, 2)
    return round(tax + cess, 2), cess


def standard_deduction_new_regime() -> float:
    """Fixed standard deduction under new regime (approximate consolidated figure)."""
    return 50_000.0


def compute_income_tax(
    *,
    regime: Regime,
    total_income: float,
    deduction_totals_by_section: dict[str, float],
    capital_gains_tax_already: float = 0.0,
) -> dict:
    """
    Returns income-tax portion (excludes CGT which is added separately).
    """
    capped = clamp_deductions_by_section(deduction_totals_by_section)
    ded_total = total_deductions_old(capped) if regime == 'old' else 0.0

    if regime == 'old':
        taxable = max(0.0, total_income - ded_total)
        tax_pre = tax_old_regime_slabs(taxable)
        if taxable <= 500_000:
            tax_pre = 0.0
    else:
        net = max(0.0, total_income - standard_deduction_new_regime())
        taxable = net
        tax_pre = tax_new_regime_slabs(net)
        if taxable <= 700_000:
            tax_pre = 0.0

    cgt = max(0.0, capital_gains_tax_already)
    pre_cess = max(0.0, tax_pre) + cgt
    after_cess, cess = add_cess(pre_cess)

    return {
        'regime': regime,
        'total_income': round(total_income, 2),
        'deductions_total': round(ded_total, 2) if regime == 'old' else 0.0,
        'deductions_capped': {k: round(v, 2) for k, v in capped.items()} if regime == 'old' else {},
        'taxable_income': round(taxable, 2),
        'tax_before_cess': round(tax_pre + cgt, 2),
        'income_tax_component': round(tax_pre, 2),
        'capital_gains_tax': round(cgt, 2),
        'cess': round(cess, 2),
        'total_tax': round(after_cess, 2),
    }


def holding_days(buy: date, sell: date) -> int:
    return (sell - buy).days


def compute_capital_gain_tax_for_lot(
    *,
    asset_type: str,
    buy_date: date,
    sell_date: date,
    buy_amount: float,
    sell_amount: float,
) -> tuple[float, float]:
    """Returns (gain_amount, tax_amount)."""
    gain = max(0.0, float(sell_amount) - float(buy_amount))
    at = (asset_type or '').lower().replace(' ', '_')
    days = holding_days(buy_date, sell_date)

    if at in ('stocks', 'stock', 'equity', 'mutual_funds', 'mutual_fund', 'mf'):
        if days <= 365:
            return round(gain, 2), round(gain * 0.15, 2)
        ltcg_taxable = max(0.0, gain - 100_000)
        return round(gain, 2), round(ltcg_taxable * 0.10, 2)

    if at in ('property', 'real_estate', 'land'):
        if days <= 730:
            return round(gain, 2), round(gain * 0.20, 2)
        return round(gain, 2), round(gain * 0.20, 2)

    if days <= 365:
        return round(gain, 2), round(gain * 0.15, 2)
    ltcg_taxable = max(0.0, gain - 100_000)
    return round(gain, 2), round(ltcg_taxable * 0.10, 2)


def marginal_rate_estimate(taxable: float, regime: Regime) -> float:
    """Rough marginal rate for 'tax saved' messaging."""
    if regime == 'new':
        if taxable <= 300_000:
            return 0.0
        if taxable <= 600_000:
            return 0.05
        if taxable <= 900_000:
            return 0.10
        if taxable <= 1_200_000:
            return 0.15
        if taxable <= 1_500_000:
            return 0.20
        return 0.30
    if taxable <= 250_000:
        return 0.0
    if taxable <= 500_000:
        return 0.05
    if taxable <= 1_000_000:
        return 0.20
    return 0.30
