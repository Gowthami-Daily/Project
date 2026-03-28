"""Seed SQLite with demo data for QA, centers, tanks (idempotent)."""

from datetime import date, datetime, timedelta
from decimal import Decimal

from sqlalchemy.orm import Session

from fastapi_service.models import CollectionCenter, InventoryTank, InventoryTransaction, QALabTest


def seed_if_empty(db: Session) -> None:
    if db.query(CollectionCenter).first():
        return

    main = CollectionCenter(
        name='Gowthami Main Center',
        latitude=Decimal('12.9716'),
        longitude=Decimal('77.5946'),
        manager_staff_id=1,
        status='ACTIVE',
    )
    b = CollectionCenter(
        name='Branch B — West Bank',
        latitude=Decimal('12.9352'),
        longitude=Decimal('77.6245'),
        manager_staff_id=3,
        status='ACTIVE',
    )
    c = CollectionCenter(
        name='Branch C — River Road',
        latitude=Decimal('13.0827'),
        longitude=Decimal('77.5877'),
        manager_staff_id=4,
        status='ACTIVE',
    )
    db.add_all([main, b, c])
    db.flush()

    now = datetime.now()
    today = date.today()

    # Tanks
    db.add(
        InventoryTank(
            tank_name='Tank A (Raw Chilling)',
            max_capacity_liters=800,
            current_liters=Decimal('600'),
            current_temperature_celsius=Decimal('3.8'),
            milk_type='BUFFALO',
            status='OPERATIONAL',
            collection_center_id=main.center_id,
        )
    )
    db.add(
        InventoryTank(
            tank_name='Tank B (Packaged Ready)',
            max_capacity_liters=500,
            current_liters=Decimal('450'),
            current_temperature_celsius=Decimal('4.1'),
            milk_type='MIXED',
            status='OPERATIONAL',
            collection_center_id=main.center_id,
        )
    )
    db.flush()

    txs = [
        InventoryTransaction(
            from_source='Center B Truck',
            to_destination='Tank A',
            quantity_liters=Decimal('400'),
            milk_type='BUFFALO',
            txn_type='Intake',
            occurred_at=datetime.combine(today, datetime.min.time()).replace(hour=8, minute=0),
            notes=None,
        ),
        InventoryTransaction(
            from_source='Tank A',
            to_destination='Tank B (Pasteurizer)',
            quantity_liters=Decimal('300'),
            milk_type='BUFFALO',
            txn_type='Internal Transfer',
            occurred_at=datetime.combine(today, datetime.min.time()).replace(hour=9, minute=30),
            notes=None,
        ),
        InventoryTransaction(
            from_source='Tank B',
            to_destination='Dispatch Vehicle R1',
            quantity_liters=Decimal('200'),
            milk_type='MIXED',
            txn_type='Dispatch',
            occurred_at=datetime.combine(today, datetime.min.time()).replace(hour=2, minute=0),
            notes=None,
        ),
    ]
    db.add_all(txs)

    # QA tests for "today"
    batches = [
        ('F1001', True, True, True, None, False, False, 'PASS'),
        ('F1002', True, True, True, Decimal('0.05'), False, False, 'PASS'),
        ('F1003', False, True, True, None, False, False, 'FAIL'),
        ('F1004', True, True, True, Decimal('0.12'), False, False, 'PASS'),
        ('F1005', True, True, True, None, True, False, 'FAIL'),
        ('F1006', True, True, True, None, False, False, 'PASS'),
        ('F1007', True, True, True, None, False, False, 'PASS'),
        ('F1008', True, True, True, Decimal('0.08'), False, False, 'PASS'),
    ]
    centers_cycle = [main.center_id, b.center_id, c.center_id]
    for i, (bid, cob, alc, org, urea, sugar, salt, final) in enumerate(batches):
        urea_d = bool(urea and urea > Decimal('0.12'))
        db.add(
            QALabTest(
                batch_id=bid,
                collection_center_id=centers_cycle[i % 3],
                tester_staff_id=2,
                cob_test_passed=cob,
                alcohol_test_passed=alc,
                organoleptic_test_passed=org,
                urea_detected=urea_d,
                urea_percentage=urea,
                sugar_detected=sugar,
                salt_detected=salt,
                final_result=final,
                tested_at=datetime.combine(today, datetime.min.time()) + timedelta(minutes=30 * i),
                lab_notes=None if final == 'PASS' else 'Hold for review',
            )
        )

    # Pad counts toward dashboard feel (duplicate pattern with unique batch ids)
    for j in range(37):
        idx = 2000 + j
        db.add(
            QALabTest(
                batch_id=f'F{idx}',
                collection_center_id=centers_cycle[j % 3],
                tester_staff_id=2,
                cob_test_passed=True,
                alcohol_test_passed=True,
                organoleptic_test_passed=True,
                urea_detected=False,
                urea_percentage=Decimal('0.08'),
                sugar_detected=False,
                salt_detected=False,
                final_result='PASS',
                tested_at=datetime.combine(today, datetime.min.time()) + timedelta(minutes=j + 10),
            )
        )

    db.commit()
