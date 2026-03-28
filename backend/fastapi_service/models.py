from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from fastapi_service.database import Base


class CollectionCenter(Base):
    __tablename__ = 'collection_centers'

    center_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    latitude: Mapped[float | None] = mapped_column(Numeric(10, 7), nullable=True)
    longitude: Mapped[float | None] = mapped_column(Numeric(10, 7), nullable=True)
    manager_staff_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(10), default='ACTIVE')
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    qa_tests: Mapped[list['QALabTest']] = relationship(back_populates='center')
    tanks: Mapped[list['InventoryTank']] = relationship(back_populates='center')


class QALabTest(Base):
    __tablename__ = 'qa_lab_tests'

    test_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    reference_log_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    batch_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    collection_center_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey('collection_centers.center_id'), nullable=True
    )
    tested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    tester_staff_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    cob_test_passed: Mapped[bool] = mapped_column(Boolean, default=True)
    alcohol_test_passed: Mapped[bool] = mapped_column(Boolean, default=True)
    organoleptic_test_passed: Mapped[bool] = mapped_column(Boolean, default=True)

    urea_detected: Mapped[bool] = mapped_column(Boolean, default=False)
    urea_percentage: Mapped[float | None] = mapped_column(Numeric(4, 2), nullable=True)
    sugar_detected: Mapped[bool] = mapped_column(Boolean, default=False)
    salt_detected: Mapped[bool] = mapped_column(Boolean, default=False)
    starch_detected: Mapped[bool] = mapped_column(Boolean, default=False)
    detergent_detected: Mapped[bool] = mapped_column(Boolean, default=False)

    final_result: Mapped[str] = mapped_column(String(10), default='PASS')
    lab_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    center: Mapped['CollectionCenter | None'] = relationship(back_populates='qa_tests')


class InventoryTank(Base):
    __tablename__ = 'inventory_tanks'

    tank_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tank_name: Mapped[str] = mapped_column(String(50), nullable=False)
    max_capacity_liters: Mapped[int] = mapped_column(Integer, nullable=False)
    current_liters: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    current_temperature_celsius: Mapped[float | None] = mapped_column(Numeric(4, 1), nullable=True)
    milk_type: Mapped[str | None] = mapped_column(String(10), nullable=True)
    last_cleaned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default='OPERATIONAL')
    collection_center_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey('collection_centers.center_id'), nullable=True
    )

    center: Mapped['CollectionCenter | None'] = relationship(back_populates='tanks')


class InventoryTransaction(Base):
    __tablename__ = 'inventory_transactions'

    transaction_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    from_source: Mapped[str | None] = mapped_column(String(100), nullable=True)
    to_destination: Mapped[str | None] = mapped_column(String(100), nullable=True)
    quantity_liters: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    milk_type: Mapped[str] = mapped_column(String(10), nullable=False)
    txn_type: Mapped[str | None] = mapped_column(String(40), nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    created_by_user_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class Customer(Base):
    __tablename__ = 'customers'

    customer_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    customer_code: Mapped[str] = mapped_column(String(32), nullable=False, unique=True)

    topups: Mapped[list['CustomerWalletTopup']] = relationship(back_populates='customer')
    messages: Mapped[list['CustomerMessage']] = relationship(back_populates='customer')
    subscriptions: Mapped[list['Subscription']] = relationship(back_populates='customer')
    micro_orders: Mapped[list['MicroOrder']] = relationship(back_populates='customer')


class ExpenseCategory(Base):
    __tablename__ = 'expense_categories'

    category_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    slug: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)

    expenses: Mapped[list['BusinessExpense']] = relationship(back_populates='category')


class CustomerWalletTopup(Base):
    __tablename__ = 'customer_wallet_topups'

    topup_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    customer_id: Mapped[int] = mapped_column(Integer, ForeignKey('customers.customer_id'), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    payment_method: Mapped[str] = mapped_column(String(40), nullable=False)
    reference_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    collected_by_staff_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    staff_reconciled_by: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reconciliation_status: Mapped[str] = mapped_column(String(24), default='CONFIRMED')
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    customer: Mapped['Customer'] = relationship(back_populates='topups')


class BusinessExpense(Base):
    __tablename__ = 'business_expenses'

    expense_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    category_id: Mapped[int] = mapped_column(Integer, ForeignKey('expense_categories.category_id'), nullable=False)
    expense_date: Mapped[date] = mapped_column(Date, nullable=False)
    supplier_staff_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    payment_method: Mapped[str | None] = mapped_column(String(24), nullable=True)
    proof_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_recurring: Mapped[bool] = mapped_column(Boolean, default=False)
    created_by_user_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    approval_status: Mapped[str] = mapped_column(String(20), default='APPROVED')

    category: Mapped['ExpenseCategory'] = relationship(back_populates='expenses')


class DeliveryAgent(Base):
    __tablename__ = 'delivery_agents'

    agent_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    route_code: Mapped[str | None] = mapped_column(String(32), nullable=True)


class FleetVehicle(Base):
    __tablename__ = 'fleet_vehicles'

    vehicle_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    registration: Mapped[str] = mapped_column(String(32), nullable=False, unique=True)
    vehicle_type: Mapped[str] = mapped_column(String(16), nullable=False)
    agent_id: Mapped[int | None] = mapped_column(Integer, ForeignKey('delivery_agents.agent_id'), nullable=True)


class Subscription(Base):
    __tablename__ = 'subscriptions'

    subscription_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    customer_id: Mapped[int] = mapped_column(Integer, ForeignKey('customers.customer_id'), nullable=False)
    default_liters: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False)
    milk_type: Mapped[str] = mapped_column(String(16), nullable=False)
    route_tag: Mapped[str | None] = mapped_column(String(32), nullable=True)
    status: Mapped[str] = mapped_column(String(16), default='ACTIVE')

    customer: Mapped['Customer'] = relationship(back_populates='subscriptions')
    pauses: Mapped[list['SubscriptionPause']] = relationship(back_populates='subscription')


class CustomerMessage(Base):
    __tablename__ = 'customer_messages'

    message_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    customer_id: Mapped[int] = mapped_column(Integer, ForeignKey('customers.customer_id'), nullable=False)
    trigger_event: Mapped[str | None] = mapped_column(String(50), nullable=True)
    message_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    channel: Mapped[str | None] = mapped_column(String(15), nullable=True)
    sent_timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    delivery_status: Mapped[str | None] = mapped_column(String(15), nullable=True)
    related_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    customer: Mapped['Customer'] = relationship(back_populates='messages')


class CommunicationTriggerSetting(Base):
    __tablename__ = 'communication_trigger_settings'

    trigger_key: Mapped[str] = mapped_column(String(50), primary_key=True)
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    message_template: Mapped[str] = mapped_column(Text, nullable=False)
    channel: Mapped[str] = mapped_column(String(64), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Crate(Base):
    __tablename__ = 'crates'

    crate_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    crate_number_barcode: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    current_status: Mapped[str] = mapped_column(String(24), default='IN_WAREHOUSE')
    assigned_route_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    last_cleaned_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    movements: Mapped[list['CrateMovement']] = relationship(back_populates='crate')


class CrateMovement(Base):
    __tablename__ = 'crate_movements'

    movement_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    crate_id: Mapped[int] = mapped_column(Integer, ForeignKey('crates.crate_id'), nullable=False)
    staff_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    route_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    movement_type: Mapped[str] = mapped_column(String(32), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    crate: Mapped['Crate'] = relationship(back_populates='movements')


class FleetTelematics(Base):
    __tablename__ = 'fleet_telematics'

    telematics_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    agent_id: Mapped[int] = mapped_column(Integer, ForeignKey('delivery_agents.agent_id'), nullable=False)
    vehicle_id: Mapped[int] = mapped_column(Integer, ForeignKey('fleet_vehicles.vehicle_id'), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    latitude: Mapped[float | None] = mapped_column(Numeric(10, 8), nullable=True)
    longitude: Mapped[float | None] = mapped_column(Numeric(11, 8), nullable=True)
    speed_kmh: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    distance_traveled_since_last_km: Mapped[float | None] = mapped_column(Numeric(7, 3), nullable=True)
    battery_level_percent: Mapped[int | None] = mapped_column(Integer, nullable=True)


class FleetExpense(Base):
    __tablename__ = 'fleet_expenses'

    expense_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    vehicle_id: Mapped[int] = mapped_column(Integer, ForeignKey('fleet_vehicles.vehicle_id'), nullable=False)
    expense_type: Mapped[str] = mapped_column(String(24), nullable=False)
    expense_date: Mapped[date] = mapped_column(Date, nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    odometer_reading: Mapped[int | None] = mapped_column(Integer, nullable=True)
    quantity_liters: Mapped[float | None] = mapped_column(Numeric(7, 2), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class SubscriptionPause(Base):
    __tablename__ = 'subscription_pauses'

    pause_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    subscription_id: Mapped[int] = mapped_column(Integer, ForeignKey('subscriptions.subscription_id'), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(16), default='ACTIVE')
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    subscription: Mapped['Subscription'] = relationship(back_populates='pauses')


class MicroOrder(Base):
    __tablename__ = 'micro_orders'

    micro_order_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    customer_id: Mapped[int] = mapped_column(Integer, ForeignKey('customers.customer_id'), nullable=False)
    fulfillment_date: Mapped[date] = mapped_column(Date, nullable=False)
    milk_type: Mapped[str] = mapped_column(String(16), nullable=False)
    quantity_liters: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    total_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    payment_status: Mapped[str | None] = mapped_column(String(24), nullable=True)
    fulfillment_status: Mapped[str] = mapped_column(String(16), default='CONFIRMED')

    customer: Mapped['Customer'] = relationship(back_populates='micro_orders')


class CrateRouteDispatch(Base):
    """Daily per-route crate issue/return for dispatch log UI."""

    __tablename__ = 'crate_route_dispatches'

    dispatch_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    route_code: Mapped[str] = mapped_column(String(16), nullable=False)
    agent_name: Mapped[str] = mapped_column(String(120), nullable=False)
    vehicle_reg: Mapped[str] = mapped_column(String(32), nullable=False)
    dispatch_date: Mapped[date] = mapped_column(Date, nullable=False)
    crates_issued_morn: Mapped[int] = mapped_column(Integer, nullable=False)
    crates_returned_eve: Mapped[int | None] = mapped_column(Integer, nullable=True)
    variance_resolution: Mapped[str | None] = mapped_column(String(32), nullable=True)


class ProcurementFarmer(Base):
    """Milk supplier (procurement) — layered API under ``/api/v1/farmers``."""

    __tablename__ = 'procurement_farmers'

    farmer_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    farmer_code: Mapped[str] = mapped_column(String(32), nullable=False, unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    village: Mapped[str | None] = mapped_column(String(255), nullable=True)
    milk_type: Mapped[str] = mapped_column(String(16), nullable=False, default='COW')
    status: Mapped[str] = mapped_column(String(16), nullable=False, default='ACTIVE')
    balance: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    purchase_cost: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class User(Base):
    """ERP login accounts — JWT subject is ``user.id``."""

    __tablename__ = 'users'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(120), nullable=False, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False, default='STAFF')
    role_id: Mapped[int | None] = mapped_column(Integer, ForeignKey('roles.id'), nullable=True, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
