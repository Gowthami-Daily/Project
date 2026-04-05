"""CRUD and aggregates for Indian tax dashboard tables."""

from __future__ import annotations

from calendar import monthrange
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from fastapi_service.models_extended import PfCapitalGain, PfIncomeTaxSource, PfTaxDeduction, PfTaxTransaction
from fastapi_service.services import india_income_tax as itax


def sum_income_sources_fy(db: Session, profile_id: int, fy_start: int) -> float:
    s, e = itax.fy_date_bounds(fy_start)
    stmt = select(func.coalesce(func.sum(PfIncomeTaxSource.amount), 0)).where(
        PfIncomeTaxSource.profile_id == profile_id,
        PfIncomeTaxSource.fy_start_year == fy_start,
        PfIncomeTaxSource.source_date >= s,
        PfIncomeTaxSource.source_date <= e,
    )
    return float(db.scalar(stmt) or 0)


def sum_deductions_by_section_fy(db: Session, profile_id: int, fy_start: int) -> dict[str, float]:
    s, e = itax.fy_date_bounds(fy_start)
    stmt = (
        select(PfTaxDeduction.section, func.coalesce(func.sum(PfTaxDeduction.amount), 0))
        .where(
            PfTaxDeduction.profile_id == profile_id,
            PfTaxDeduction.fy_start_year == fy_start,
            PfTaxDeduction.deduction_date >= s,
            PfTaxDeduction.deduction_date <= e,
        )
        .group_by(PfTaxDeduction.section)
    )
    return {str(r[0]).upper(): float(r[1]) for r in db.execute(stmt).all()}


def sum_tax_transactions_fy(db: Session, profile_id: int, fy_start: int) -> dict[str, float]:
    """Positive amounts; refunds stored as positive with type tax_refund (subtract in service)."""
    s, e = itax.fy_date_bounds(fy_start)
    stmt = select(PfTaxTransaction).where(
        PfTaxTransaction.profile_id == profile_id,
        PfTaxTransaction.fy_start_year == fy_start,
        PfTaxTransaction.txn_date >= s,
        PfTaxTransaction.txn_date <= e,
    )
    paid = 0.0
    refund = 0.0
    for r in db.scalars(stmt):
        t = (r.txn_type or '').lower()
        a = float(r.amount or 0)
        if t == 'tax_refund':
            refund += a
        else:
            paid += a
    return {'paid': paid, 'refund': refund}


def capital_gains_totals_fy(db: Session, profile_id: int, fy_start: int) -> tuple[float, float]:
    s, e = itax.fy_date_bounds(fy_start)
    stmt = select(func.coalesce(func.sum(PfCapitalGain.gain_amount), 0), func.coalesce(func.sum(PfCapitalGain.tax_amount), 0)).where(
        PfCapitalGain.profile_id == profile_id,
        PfCapitalGain.fy_start_year == fy_start,
        PfCapitalGain.sell_date >= s,
        PfCapitalGain.sell_date <= e,
    )
    row = db.execute(stmt).one()
    return float(row[0]), float(row[1])


def list_income_sources_month(
    db: Session, profile_id: int, fy_start: int, cal_year: int, cal_month: int
) -> list[PfIncomeTaxSource]:
    ms, me = itax.calendar_month_bounds_in_fy(fy_start, cal_year, cal_month)
    stmt = (
        select(PfIncomeTaxSource)
        .where(
            PfIncomeTaxSource.profile_id == profile_id,
            PfIncomeTaxSource.fy_start_year == fy_start,
            PfIncomeTaxSource.source_date >= ms,
            PfIncomeTaxSource.source_date <= me,
        )
        .order_by(PfIncomeTaxSource.source_date, PfIncomeTaxSource.id)
    )
    return list(db.scalars(stmt).all())


def daily_series_income(
    db: Session, profile_id: int, fy_start: int, cal_year: int, cal_month: int
) -> list[tuple[date, float]]:
    rows = list_income_sources_month(db, profile_id, fy_start, cal_year, cal_month)
    by: dict[date, float] = {}
    for r in rows:
        by[r.source_date] = by.get(r.source_date, 0.0) + float(r.amount)
    return sorted(by.items())


def daily_series_deductions(
    db: Session, profile_id: int, fy_start: int, cal_year: int, cal_month: int
) -> list[tuple[date, float]]:
    ms, me = itax.calendar_month_bounds_in_fy(fy_start, cal_year, cal_month)
    stmt = (
        select(PfTaxDeduction)
        .where(
            PfTaxDeduction.profile_id == profile_id,
            PfTaxDeduction.fy_start_year == fy_start,
            PfTaxDeduction.deduction_date >= ms,
            PfTaxDeduction.deduction_date <= me,
        )
        .order_by(PfTaxDeduction.deduction_date, PfTaxDeduction.id)
    )
    rows = list(db.scalars(stmt).all())
    by: dict[date, float] = {}
    for r in rows:
        by[r.deduction_date] = by.get(r.deduction_date, 0.0) + float(r.amount)
    return sorted(by.items())


def daily_series_tax_paid(
    db: Session, profile_id: int, fy_start: int, cal_year: int, cal_month: int
) -> list[tuple[date, float]]:
    ms, me = itax.calendar_month_bounds_in_fy(fy_start, cal_year, cal_month)
    stmt = (
        select(PfTaxTransaction)
        .where(
            PfTaxTransaction.profile_id == profile_id,
            PfTaxTransaction.fy_start_year == fy_start,
            PfTaxTransaction.txn_date >= ms,
            PfTaxTransaction.txn_date <= me,
        )
        .order_by(PfTaxTransaction.txn_date, PfTaxTransaction.id)
    )
    by: dict[date, float] = {}
    for r in db.scalars(stmt).all():
        if (r.txn_type or '').lower() == 'tax_refund':
            by[r.txn_date] = by.get(r.txn_date, 0.0) - float(r.amount)
        else:
            by[r.txn_date] = by.get(r.txn_date, 0.0) + float(r.amount)
    return sorted(by.items())


def daily_series_capital_gains(
    db: Session, profile_id: int, fy_start: int, cal_year: int, cal_month: int
) -> list[tuple[date, float, float]]:
    ms, me = itax.calendar_month_bounds_in_fy(fy_start, cal_year, cal_month)
    stmt = (
        select(PfCapitalGain)
        .where(
            PfCapitalGain.profile_id == profile_id,
            PfCapitalGain.fy_start_year == fy_start,
            PfCapitalGain.sell_date >= ms,
            PfCapitalGain.sell_date <= me,
        )
        .order_by(PfCapitalGain.sell_date, PfCapitalGain.id)
    )
    out: list[tuple[date, float, float]] = []
    for r in db.scalars(stmt).all():
        out.append((r.sell_date, float(r.gain_amount), float(r.tax_amount)))
    return out


def monthly_aggregates_fy(
    db: Session, profile_id: int, fy_start: int
) -> list[dict]:
    """12 rows: April → March with income, deductions, tax paid, cg."""
    rows_out: list[dict] = []
    for mi in range(1, 13):
        cy, cm = itax.month_in_fy(fy_start, mi)
        ms = date(cy, cm, 1)
        me = date(cy, cm, monthrange(cy, cm)[1])
        fy_s, fy_e = itax.fy_date_bounds(fy_start)
        if me < fy_s or ms > fy_e:
            continue
        ms = max(ms, fy_s)
        me = min(me, fy_e)

        inc = float(
            db.scalar(
                select(func.coalesce(func.sum(PfIncomeTaxSource.amount), 0)).where(
                    PfIncomeTaxSource.profile_id == profile_id,
                    PfIncomeTaxSource.fy_start_year == fy_start,
                    PfIncomeTaxSource.source_date >= ms,
                    PfIncomeTaxSource.source_date <= me,
                )
            )
            or 0
        )
        ded = float(
            db.scalar(
                select(func.coalesce(func.sum(PfTaxDeduction.amount), 0)).where(
                    PfTaxDeduction.profile_id == profile_id,
                    PfTaxDeduction.fy_start_year == fy_start,
                    PfTaxDeduction.deduction_date >= ms,
                    PfTaxDeduction.deduction_date <= me,
                )
            )
            or 0
        )
        paid = 0.0
        refund = 0.0
        for r in db.scalars(
            select(PfTaxTransaction).where(
                PfTaxTransaction.profile_id == profile_id,
                PfTaxTransaction.fy_start_year == fy_start,
                PfTaxTransaction.txn_date >= ms,
                PfTaxTransaction.txn_date <= me,
            )
        ).all():
            if (r.txn_type or '').lower() == 'tax_refund':
                refund += float(r.amount)
            else:
                paid += float(r.amount)
        cg = float(
            db.scalar(
                select(func.coalesce(func.sum(PfCapitalGain.gain_amount), 0)).where(
                    PfCapitalGain.profile_id == profile_id,
                    PfCapitalGain.fy_start_year == fy_start,
                    PfCapitalGain.sell_date >= ms,
                    PfCapitalGain.sell_date <= me,
                )
            )
            or 0
        )
        cgt = float(
            db.scalar(
                select(func.coalesce(func.sum(PfCapitalGain.tax_amount), 0)).where(
                    PfCapitalGain.profile_id == profile_id,
                    PfCapitalGain.fy_start_year == fy_start,
                    PfCapitalGain.sell_date >= ms,
                    PfCapitalGain.sell_date <= me,
                )
            )
            or 0
        )
        label = f'{cy}-{cm:02d}'
        rows_out.append(
            {
                'label': label,
                'month_index': mi,
                'income': round(inc, 2),
                'deductions': round(ded, 2),
                'tax_paid': round(paid - refund, 2),
                'capital_gains': round(cg, 2),
                'capital_gains_tax': round(cgt, 2),
            }
        )
    return rows_out


def list_tax_transactions_month(
    db: Session, profile_id: int, fy_start: int, cal_year: int, cal_month: int
) -> list[PfTaxTransaction]:
    ms, me = itax.calendar_month_bounds_in_fy(fy_start, cal_year, cal_month)
    stmt = (
        select(PfTaxTransaction)
        .where(
            PfTaxTransaction.profile_id == profile_id,
            PfTaxTransaction.fy_start_year == fy_start,
            PfTaxTransaction.txn_date >= ms,
            PfTaxTransaction.txn_date <= me,
        )
        .order_by(PfTaxTransaction.txn_date.desc(), PfTaxTransaction.id.desc())
    )
    return list(db.scalars(stmt).all())
