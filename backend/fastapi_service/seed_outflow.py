"""Outflow Module 3E–3H seed (requires customers from seed_ledger)."""

from datetime import date, datetime, timedelta

from decimal import Decimal

from sqlalchemy.orm import Session

from fastapi_service.models import (
    CommunicationTriggerSetting,
    Crate,
    CrateRouteDispatch,
    Customer,
    CustomerMessage,
    DeliveryAgent,
    FleetExpense,
    FleetTelematics,
    FleetVehicle,
    MicroOrder,
    Subscription,
    SubscriptionPause,
)


def seed_outflow_if_empty(db: Session) -> None:
    if db.query(DeliveryAgent).first():
        return

    c2001 = db.query(Customer).filter(Customer.customer_code == 'C2001').first()
    c3002 = db.query(Customer).filter(Customer.customer_code == 'C3002').first()
    c3010 = db.query(Customer).filter(Customer.customer_code == 'C3010').first()
    if not c2001 or not c3002:
        return

    agents = [
        DeliveryAgent(name='Raju', route_code='R-01'),
        DeliveryAgent(name='Satyam', route_code='R-02'),
        DeliveryAgent(name='Ravi', route_code='R-03'),
    ]
    db.add_all(agents)
    db.flush()

    vehicles = [
        FleetVehicle(registration='AP-XX-1234', vehicle_type='BIKE', agent_id=agents[0].agent_id),
        FleetVehicle(registration='AP-YY-5678', vehicle_type='AUTO', agent_id=agents[1].agent_id),
        FleetVehicle(registration='AP-ZZ-9012', vehicle_type='BIKE', agent_id=agents[2].agent_id),
    ]
    db.add_all(vehicles)
    db.flush()

    subs = [
        Subscription(
            customer_id=c2001.customer_id,
            default_liters=Decimal('1'),
            milk_type='BUFFALO',
            route_tag='R-01',
        ),
        Subscription(
            customer_id=c3002.customer_id,
            default_liters=Decimal('1'),
            milk_type='BUFFALO',
            route_tag='R-01',
        ),
    ]
    db.add_all(subs)
    db.flush()

    today = date.today()
    tomorrow = today + timedelta(days=1)

    db.add(
        SubscriptionPause(
            subscription_id=subs[0].subscription_id,
            start_date=today,
            end_date=today + timedelta(days=2),
            reason='OUT_OF_TOWN',
            status='ACTIVE',
        )
    )
    db.add(
        SubscriptionPause(
            subscription_id=subs[1].subscription_id,
            start_date=tomorrow,
            end_date=tomorrow + timedelta(days=2),
            reason='GUESTS',
            status='ACTIVE',
        )
    )

    db.add(
        MicroOrder(
            customer_id=c3002.customer_id,
            fulfillment_date=tomorrow,
            milk_type='BUFFALO',
            quantity_liters=Decimal('2'),
            total_price=Decimal('80'),
            payment_status='DEDUCTED_FROM_WALLET',
            fulfillment_status='CONFIRMED',
        )
    )

    db.add_all(
        [
            CommunicationTriggerSetting(
                trigger_key='LOW_WALLET',
                label='Low Wallet Balance (<₹100)',
                message_template=(
                    'Hi [Name], your Gowthami Daily wallet is low (₹[Balance]). '
                    'Recharge now to ensure uninterrupted morning delivery.'
                ),
                channel='SMS + WhatsApp',
                is_active=True,
            ),
            CommunicationTriggerSetting(
                trigger_key='VACATION_PAUSE',
                label='Subscription Paused (Vacation)',
                message_template=(
                    'Hi [Name], your delivery is paused from [Start_Date] to [End_Date]. Enjoy your time off!'
                ),
                channel='IN_APP',
                is_active=True,
            ),
        ]
    )

    now = datetime.now()
    for i in range(8):
        db.add(
            CustomerMessage(
                customer_id=c3002.customer_id,
                trigger_event='LOW_WALLET',
                message_content='Wallet low reminder',
                channel='SMS',
                delivery_status='DELIVERED',
                sent_timestamp=now - timedelta(minutes=i * 5),
            )
        )
    for i in range(5):
        db.add(
            CustomerMessage(
                customer_id=c3010.customer_id,
                trigger_event='DISPATCH_CONFIRM',
                message_content='Your milk is en route',
                channel='SMS',
                delivery_status='DELIVERED',
                sent_timestamp=now - timedelta(minutes=10 + i),
            )
        )
    for i in range(3):
        db.add(
            CustomerMessage(
                customer_id=c2001.customer_id,
                trigger_event='DELAY_CRITICAL',
                message_content='Route R-03 delayed 15m',
                channel='WHATSAPP',
                delivery_status='SENT',
                sent_timestamp=now - timedelta(minutes=30 + i),
            )
        )

    for n in range(1, 251):
        if n <= 180:
            status = 'EN_ROUTE'
        elif n <= 185:
            status = 'DAMAGED'
        else:
            status = 'IN_WAREHOUSE'
        route = None
        if status == 'EN_ROUTE':
            if n % 3 == 0:
                route = 'R-01'
            elif n % 3 == 1:
                route = 'R-02'
            else:
                route = 'R-03'
        db.add(
            Crate(
                crate_number_barcode=f'GD-CR-{n:03d}',
                current_status=status,
                assigned_route_id=route,
                last_cleaned_date=today - timedelta(days=7),
            )
        )

    db.add_all(
        [
            CrateRouteDispatch(
                route_code='R-01',
                agent_name='Raju',
                vehicle_reg='AP-XX-1234',
                dispatch_date=today,
                crates_issued_morn=15,
                crates_returned_eve=15,
                variance_resolution=None,
            ),
            CrateRouteDispatch(
                route_code='R-02',
                agent_name='Satyam',
                vehicle_reg='AP-YY-5678',
                dispatch_date=today,
                crates_issued_morn=12,
                crates_returned_eve=12,
                variance_resolution=None,
            ),
            CrateRouteDispatch(
                route_code='R-03',
                agent_name='Ravi',
                vehicle_reg='AP-ZZ-9012',
                dispatch_date=today,
                crates_issued_morn=20,
                crates_returned_eve=18,
                variance_resolution=None,
            ),
        ]
    )

    lat0, lng0 = Decimal('12.9716'), Decimal('77.5946')
    for i in range(10):
        db.add(
            FleetTelematics(
                agent_id=agents[2].agent_id,
                vehicle_id=vehicles[2].vehicle_id,
                latitude=lat0 + Decimal(str(i * 2)) / Decimal('10000'),
                longitude=lng0 + Decimal(str(i * 15)) / Decimal('100000'),
                speed_kmh=Decimal('22.0') + Decimal(str(i % 4)),
                distance_traveled_since_last_km=Decimal('0.08') + Decimal(str(i)) / Decimal('1000'),
                battery_level_percent=78 - i,
            )
        )
    db.add_all(
        [
            FleetExpense(
                vehicle_id=vehicles[0].vehicle_id,
                expense_type='FUEL',
                expense_date=today,
                amount=Decimal('1200'),
                odometer_reading=12400,
                quantity_liters=Decimal('2.5'),
                notes='Route 1 morning',
            ),
            FleetExpense(
                vehicle_id=vehicles[1].vehicle_id,
                expense_type='MAINTENANCE',
                expense_date=today + timedelta(days=14),
                amount=Decimal('0'),
                odometer_reading=8900,
                quantity_liters=None,
                notes='PENDING_SERVICE',
            ),
            FleetExpense(
                vehicle_id=vehicles[2].vehicle_id,
                expense_type='MAINTENANCE',
                expense_date=today + timedelta(days=10),
                amount=Decimal('0'),
                odometer_reading=10200,
                quantity_liters=None,
                notes='PENDING_SERVICE',
            ),
        ]
    )

    db.commit()
