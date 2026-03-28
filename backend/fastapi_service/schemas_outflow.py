from datetime import date, datetime

from pydantic import BaseModel, Field


class CrmAutomationSummary(BaseModel):
    low_wallet_alerts_today: int
    dispatch_confirmation_sms_today: int
    critical_delay_alerts: int
    critical_delay_route_code: str | None = None


class CommunicationTriggerRead(BaseModel):
    trigger_key: str
    label: str
    message_template: str
    channel: str
    is_active: bool


class CommunicationTriggerPatch(BaseModel):
    is_active: bool


class BroadcastRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)


class BroadcastResponse(BaseModel):
    queued: bool
    detail: str


class CrateKpis(BaseModel):
    total_crates_owned: int
    crates_en_route: int
    crates_damaged_or_repair: int


class CrateDispatchRow(BaseModel):
    dispatch_id: int
    route_code: str
    agent_name: str
    vehicle_reg: str
    dispatch_date: date
    crates_issued_morn: int
    crates_returned_eve: int | None = None
    variance: int | None = None
    variance_resolution: str | None = None


class CrateDispatchResolve(BaseModel):
    variance_resolution: str = Field(pattern='^(LOST|DAMAGED)$')


class FleetKpis(BaseModel):
    avg_cost_per_delivery_stop_inr: float
    fuel_efficiency_kmpl: float
    vehicles_pending_maintenance: int


class AgentPerformanceRow(BaseModel):
    agent_name: str
    route_code: str | None
    avg_stops_per_hour: float
    on_time_delivery_pct: float
    distance_km_total: float
    avg_speed_kmh: float
    note: str | None = None


class RouteReplayPoint(BaseModel):
    latitude: float
    longitude: float
    timestamp: datetime | None = None


class RouteReplayResponse(BaseModel):
    route_code: str
    replay_date: date
    actual_path: list[RouteReplayPoint]
    optimized_path: list[RouteReplayPoint]
    note: str


class SubscriptionPauseRead(BaseModel):
    pause_id: int
    customer_code: str
    customer_name: str
    start_date: date
    end_date: date
    reason: str | None
    display_status: str


class MicroOrderRead(BaseModel):
    micro_order_id: int
    customer_code: str
    customer_name: str
    fulfillment_date: date
    milk_type: str
    quantity_liters: float
    original_subscription_liters: float | None
    total_price: float
    payment_status: str | None
    fulfillment_status: str


class MicroOrderCreate(BaseModel):
    customer_id: int
    fulfillment_date: date
    milk_type: str
    quantity_liters: float
    total_price: float
    payment_status: str = 'DEDUCTED_FROM_WALLET'
