"""Seed ledger tables (customers, categories, topups, expenses). Idempotent."""

from datetime import date, datetime, timedelta

from decimal import Decimal

from sqlalchemy.orm import Session

from fastapi_service.models import (
    BusinessExpense,
    Customer,
    CustomerWalletTopup,
    ExpenseCategory,
)


def seed_ledger_if_empty(db: Session) -> None:
    if db.query(ExpenseCategory).first():
        return

    cats = [
        ExpenseCategory(name='Fleet Fuel', slug='fuel'),
        ExpenseCategory(name='Delivery Agent Commission', slug='commission'),
        ExpenseCategory(name='Staff Salary (Lab/Accounting)', slug='salary'),
        ExpenseCategory(name='Vehicle Maintenance', slug='maintenance'),
        ExpenseCategory(name='Packaging / Hygiene Supplies', slug='supplies'),
        ExpenseCategory(name='Pasteurizer / Electricity', slug='lab_power'),
    ]
    db.add_all(cats)
    db.flush()

    by_slug = {c.slug: c for c in cats}

    today = date.today()

    expenses_data = [
        ('fuel', 'Agent Raju', Decimal('25000'), 'Route 3 aggregate MTD', 'UPI_BUSINESS'),
        ('commission', 'All agents', Decimal('30000'), 'MTD commissions', 'NEFT'),
        ('salary', 'Lab Technician Anjali', Decimal('15000'), 'salary_slip_mar', 'NEFT'),
        ('maintenance', 'Workshop AP-XX', Decimal('5000'), 'R3-F-XX', 'UPI_BUSINESS'),
        ('supplies', 'PackMart', Decimal('10000'), 'Hygiene order #442', 'NEFT'),
    ]
    for slug, who, amt, ref, pm in expenses_data:
        db.add(
            BusinessExpense(
                category_id=by_slug[slug].category_id,
                expense_date=today,
                supplier_staff_name=who,
                amount=amt,
                payment_method=pm,
                proof_url=f'/proofs/{slug}_{today.isoformat()}.pdf',
                notes=ref,
                approval_status='APPROVED',
                created_by_user_id=1,
            )
        )

    db.add(
        BusinessExpense(
            category_id=by_slug['fuel'].category_id,
            expense_date=today,
            supplier_staff_name='Agent Raju',
            amount=Decimal('1200'),
            payment_method='CASH',
            proof_url='/proofs/fuel_r3_28.jpg',
            notes='R3-F-XX',
            approval_status='PENDING_APPROVAL',
            created_by_user_id=2,
        )
    )

    cust_l = Customer(display_name='Lakshmi', customer_code='C3002')
    cust_s = Customer(display_name='Satyanarayana', customer_code='C2001')
    cust_p = Customer(display_name='Sridevi', customer_code='C3010')
    db.add_all([cust_l, cust_s, cust_p])
    db.flush()

    now = datetime.now()
    db.add_all(
        [
            CustomerWalletTopup(
                customer_id=cust_l.customer_id,
                payment_method='UPI',
                reference_id='Ref-UPI-LAK-001',
                amount=Decimal('1000'),
                reconciliation_status='CONFIRMED',
                timestamp=now,
            ),
            CustomerWalletTopup(
                customer_id=cust_s.customer_id,
                payment_method='CASH_COLLECTED_BY_AGENT',
                reference_id=None,
                amount=Decimal('500'),
                collected_by_staff_id=3,
                reconciliation_status='PENDING_DEPOSIT',
                notes='Agent Raju — pending bank deposit',
                timestamp=now,
            ),
            CustomerWalletTopup(
                customer_id=cust_p.customer_id,
                payment_method='UPI',
                reference_id='Ref-UPI-SRI-882',
                amount=Decimal('2000'),
                reconciliation_status='CONFIRMED',
                timestamp=now - timedelta(hours=3),
            ),
            CustomerWalletTopup(
                customer_id=cust_l.customer_id,
                payment_method='NEFT',
                reference_id='NEFT-998877',
                amount=Decimal('2500'),
                reconciliation_status='CONFIRMED',
                timestamp=now - timedelta(days=1),
            ),
        ]
    )

    db.commit()
