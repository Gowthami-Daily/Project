"""Idempotent demo rows for procurement farmers (layered API)."""

from decimal import Decimal

from sqlalchemy.orm import Session

from fastapi_service.models import ProcurementFarmer


def seed_procurement_farmers_if_empty(db: Session) -> None:
    if db.query(ProcurementFarmer).first() is not None:
        return
    db.add_all(
        [
            ProcurementFarmer(
                farmer_code='F-1001',
                name='G. Venkata Raju',
                phone='9988776655',
                village='Kistapur',
                milk_type='BUFFALO',
                status='ACTIVE',
                balance=Decimal('15000.00'),
                purchase_cost=Decimal('45000.00'),
            ),
            ProcurementFarmer(
                farmer_code='F-1002',
                name='K. Lakshmi',
                phone='9876543210',
                village='Bowrampet',
                milk_type='COW',
                status='ACTIVE',
                balance=Decimal('0'),
                purchase_cost=Decimal('38000.00'),
            ),
            ProcurementFarmer(
                farmer_code='F-1003',
                name='P. Krishna',
                phone='9123456789',
                village='Ameenpur',
                milk_type='BUFFALO',
                status='SUSPENDED',
                balance=Decimal('8200.00'),
                purchase_cost=Decimal('52000.00'),
            ),
        ]
    )
    db.commit()
