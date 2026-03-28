from datetime import date, datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from fastapi_service.database import get_db
from fastapi_service.sql_compat import filter_on_calendar_day
from fastapi_service.models import CollectionCenter, InventoryTank, InventoryTransaction, QALabTest
from fastapi_service.schemas import (
    CenterAnalyticsResponse,
    CenterAnalyticsRow,
    CollectionCenterRead,
    InventoryTankRead,
    InventoryTransactionCreate,
    InventoryTransactionRead,
    QALabTestCreate,
    QALabTestRead,
    QASummary,
)

router = APIRouter(prefix='/inflow', tags=['inflow'])


def _parse_day(d: str | None) -> date:
    if not d:
        return date.today()
    return date.fromisoformat(d)


def _compute_final_result(payload: QALabTestCreate, urea_detected: bool) -> str:
    if not payload.cob_test_passed or not payload.alcohol_test_passed or not payload.organoleptic_normal:
        return 'FAIL'
    if (
        urea_detected
        or payload.sugar_detected
        or payload.salt_detected
        or payload.starch_detected
        or payload.detergent_detected
    ):
        return 'FAIL'
    return 'PASS'


@router.get('/qa/summary', response_model=QASummary)
def qa_summary(
    db: Session = Depends(get_db),
    center_id: int | None = None,
    day: str | None = Query(None, alias='date', description='ISO date YYYY-MM-DD'),
):
    d = _parse_day(day)
    q = db.query(QALabTest).filter(filter_on_calendar_day(QALabTest.tested_at, d))
    if center_id is not None:
        q = q.filter(QALabTest.collection_center_id == center_id)
    tests = q.all()
    samples_tested = len(tests)
    rejected = [t for t in tests if t.final_result == 'FAIL']
    rejected_batches = len(rejected)
    est_loss = rejected_batches * 40

    urea_vals = [
        float(t.urea_percentage)
        for t in tests
        if t.urea_percentage is not None and t.final_result == 'PASS'
    ]
    avg_urea = sum(urea_vals) / len(urea_vals) if urea_vals else 0.0
    if avg_urea < 0.08:
        label = f'Low ({avg_urea:.1f})'
    elif avg_urea < 0.15:
        label = f'Moderate ({avg_urea:.2f})'
    else:
        label = f'High ({avg_urea:.2f})'

    return QASummary(
        samples_tested=samples_tested,
        samples_planned=50,
        rejected_batches=rejected_batches,
        estimated_loss_liters=est_loss,
        adulteration_index_label=label,
        adulteration_index_value=round(avg_urea, 3),
    )


@router.get('/qa/tests', response_model=list[QALabTestRead])
def qa_tests_list(
    db: Session = Depends(get_db),
    center_id: int | None = None,
    day: str | None = Query(None, alias='date'),
):
    d = _parse_day(day)
    q = db.query(QALabTest).filter(filter_on_calendar_day(QALabTest.tested_at, d))
    if center_id is not None:
        q = q.filter(QALabTest.collection_center_id == center_id)
    rows = q.order_by(QALabTest.tested_at.desc()).limit(200).all()
    out = []
    for t in rows:
        out.append(
            QALabTestRead(
                test_id=t.test_id,
                batch_id=t.batch_id,
                collection_center_id=t.collection_center_id,
                tested_at=t.tested_at,
                cob_test_passed=t.cob_test_passed,
                alcohol_test_passed=t.alcohol_test_passed,
                organoleptic_test_passed=t.organoleptic_test_passed,
                urea_percentage=float(t.urea_percentage) if t.urea_percentage is not None else None,
                sugar_detected=t.sugar_detected,
                salt_detected=t.salt_detected,
                final_result=t.final_result,
                lab_notes=t.lab_notes,
            )
        )
    return out


@router.post('/qa/tests', response_model=QALabTestRead, status_code=201)
def qa_tests_create(payload: QALabTestCreate, db: Session = Depends(get_db)):
    urea_pct = payload.urea_percentage
    urea_detected = bool(urea_pct is not None and float(urea_pct) > Decimal('0.12'))
    final = _compute_final_result(payload, urea_detected)

    row = QALabTest(
        reference_log_id=payload.reference_log_id,
        batch_id=payload.batch_id,
        collection_center_id=payload.collection_center_id,
        tester_staff_id=payload.tester_staff_id,
        cob_test_passed=payload.cob_test_passed,
        alcohol_test_passed=payload.alcohol_test_passed,
        organoleptic_test_passed=payload.organoleptic_normal,
        urea_detected=urea_detected,
        urea_percentage=urea_pct,
        sugar_detected=payload.sugar_detected,
        salt_detected=payload.salt_detected,
        starch_detected=payload.starch_detected,
        detergent_detected=payload.detergent_detected,
        final_result=final,
        lab_notes=payload.lab_notes,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return QALabTestRead(
        test_id=row.test_id,
        batch_id=row.batch_id,
        collection_center_id=row.collection_center_id,
        tested_at=row.tested_at,
        cob_test_passed=row.cob_test_passed,
        alcohol_test_passed=row.alcohol_test_passed,
        organoleptic_test_passed=row.organoleptic_test_passed,
        urea_percentage=float(row.urea_percentage) if row.urea_percentage is not None else None,
        sugar_detected=row.sugar_detected,
        salt_detected=row.salt_detected,
        final_result=row.final_result,
        lab_notes=row.lab_notes,
    )


BRANCH_METRICS = {
    1: {'active_farmers': 120, 'avg_liters_per_day': 1800, 'mtd': 54000, 'avg_fat': 6.5, 'staff': 'Admin 1'},
    2: {'active_farmers': 80, 'avg_liters_per_day': 1200, 'mtd': 36000, 'avg_fat': 6.8, 'staff': 'Staff 3'},
    3: {'active_farmers': 55, 'avg_liters_per_day': 900, 'mtd': 27000, 'avg_fat': 6.4, 'staff': 'Staff 4'},
}

# Demo heatmap: centers x hours 5–12
HEATMAP_HOURS = ['5:00', '6:00', '7:00', '8:00', '9:00', '10:00', '11:00', '12:00']
HEATMAP_VALUES = [
    [12, 35, 88, 120, 95, 60, 40, 22],
    [8, 42, 95, 78, 70, 55, 30, 15],
    [5, 28, 62, 90, 85, 48, 25, 10],
]


@router.get('/centers', response_model=list[CollectionCenterRead])
def centers_list(db: Session = Depends(get_db)):
    rows = db.query(CollectionCenter).filter(CollectionCenter.status == 'ACTIVE').order_by(CollectionCenter.center_id)
    return list(rows)


@router.get('/centers/analytics', response_model=CenterAnalyticsResponse)
def centers_analytics(
    db: Session = Depends(get_db),
    year: int | None = None,
    month: int | None = None,
):
    centers = (
        db.query(CollectionCenter).filter(CollectionCenter.status == 'ACTIVE').order_by(CollectionCenter.center_id).all()
    )
    volume_by_center = []
    quality_by_center = []
    branch_rows: list[CenterAnalyticsRow] = []

    for c in centers:
        m = BRANCH_METRICS.get(
            c.center_id,
            {'active_farmers': 40, 'avg_liters_per_day': 500, 'mtd': 15000, 'avg_fat': 6.2, 'staff': 'Staff'},
        )
        volume_by_center.append({'name': c.name, 'liters': m['mtd']})
        quality_by_center.append(
            {
                'name': c.name,
                'avg_fat': m['avg_fat'],
                'avg_snf': round(8.5 + (c.center_id % 3) * 0.1, 1),
            }
        )
        branch_rows.append(
            CenterAnalyticsRow(
                center_name=c.name,
                active_farmers=m['active_farmers'],
                avg_liters_per_day=m['avg_liters_per_day'],
                total_procured_mtd_liters=m['mtd'],
                avg_fat_pct=m['avg_fat'],
                staff_label=m['staff'],
            )
        )

    center_names = [c.name for c in centers]
    heatmap = {
        'centers': center_names,
        'hours': HEATMAP_HOURS,
        'values': HEATMAP_VALUES[: len(center_names)],
    }

    return CenterAnalyticsResponse(
        volume_by_center=volume_by_center,
        quality_by_center=quality_by_center,
        heatmap=heatmap,
        branch_rows=branch_rows,
    )


@router.get('/inventory/tanks', response_model=list[InventoryTankRead])
def inventory_tanks(db: Session = Depends(get_db)):
    rows = db.query(InventoryTank).order_by(InventoryTank.tank_id).all()
    out = []
    for t in rows:
        cap = t.max_capacity_liters
        cur = float(t.current_liters)
        fill = round((cur / cap) * 100, 1) if cap else 0
        out.append(
            InventoryTankRead(
                tank_id=t.tank_id,
                tank_name=t.tank_name,
                max_capacity_liters=cap,
                current_liters=cur,
                current_temperature_celsius=float(t.current_temperature_celsius)
                if t.current_temperature_celsius is not None
                else None,
                milk_type=t.milk_type,
                status=t.status,
                fill_pct=fill,
            )
        )
    return out


@router.get('/inventory/transactions', response_model=list[InventoryTransactionRead])
def inventory_transactions(db: Session = Depends(get_db), limit: int = Query(50, le=200)):
    rows = (
        db.query(InventoryTransaction)
        .order_by(InventoryTransaction.occurred_at.desc())
        .limit(limit)
        .all()
    )
    return [
        InventoryTransactionRead(
            transaction_id=r.transaction_id,
            from_source=r.from_source,
            to_destination=r.to_destination,
            quantity_liters=float(r.quantity_liters),
            milk_type=r.milk_type,
            txn_type=r.txn_type,
            occurred_at=r.occurred_at,
            notes=r.notes,
        )
        for r in rows
    ]


@router.post('/inventory/transactions', response_model=InventoryTransactionRead, status_code=201)
def inventory_transactions_create(payload: InventoryTransactionCreate, db: Session = Depends(get_db)):
    row = InventoryTransaction(
        from_source=payload.from_source,
        to_destination=payload.to_destination,
        quantity_liters=payload.quantity_liters,
        milk_type=payload.milk_type,
        txn_type=payload.txn_type,
        created_by_user_id=payload.created_by_user_id,
        notes=payload.notes,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return InventoryTransactionRead(
        transaction_id=row.transaction_id,
        from_source=row.from_source,
        to_destination=row.to_destination,
        quantity_liters=float(row.quantity_liters),
        milk_type=row.milk_type,
        txn_type=row.txn_type,
        occurred_at=row.occurred_at,
        notes=row.notes,
    )
