"""Pure valuation helpers for fixed assets (depreciation, effective book value)."""

from __future__ import annotations

from datetime import date
from typing import Any, Protocol


class AssetValuationInput(Protocol):
    purchase_value: Any
    current_value: Any
    purchase_date: date | None
    depreciation_rate: Any | None


def depreciation_years(purchase_date: date | None, *, today: date | None = None) -> float:
    if purchase_date is None:
        return 0.0
    t = today or date.today()
    if purchase_date > t:
        return 0.0
    return (t - purchase_date).days / 365.25


def effective_current_value(row: AssetValuationInput, *, today: date | None = None) -> float:
    """
    Book value for net worth and summaries.

    If ``depreciation_rate`` (annual %, e.g. 10 = 10%) and ``purchase_date`` are set, uses:
    ``purchase_value - purchase_value * (rate/100) * years``, floored at 0.

    Otherwise uses stored ``current_value`` (falls back to ``purchase_value``).
    """
    pv = float(row.purchase_value or 0)
    rate_raw = row.depreciation_rate
    rate = float(rate_raw) if rate_raw is not None else 0.0
    if rate > 0 and row.purchase_date is not None:
        yrs = depreciation_years(row.purchase_date, today=today)
        dep = pv * (rate / 100.0) * yrs
        return max(0.0, pv - dep)
    cv = row.current_value
    if cv is not None:
        v = float(cv)
        return max(0.0, v)
    return max(0.0, pv)


def book_depreciation_amount(row: AssetValuationInput, *, today: date | None = None) -> float:
    """Purchase value minus effective current (non-negative)."""
    pv = float(row.purchase_value or 0)
    return max(0.0, pv - effective_current_value(row, today=today))
