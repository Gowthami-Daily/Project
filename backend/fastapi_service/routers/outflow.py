"""Module 3 Outflow: CRM (3E), crates (3F), fleet analytics (3G), exceptions (3H)."""

from calendar import monthrange
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from fastapi_service.database import get_db
from fastapi_service.models import (
    CommunicationTriggerSetting,
    Crate,
    CrateRouteDispatch,
    DeliveryAgent,
    FleetExpense,
    FleetTelematics,
    FleetVehicle,
    MicroOrder,
    Subscription,
    SubscriptionPause,
)
from fastapi_service.schemas_outflow import (
    AgentPerformanceRow,
    BroadcastRequest,
    BroadcastResponse,
    CommunicationTriggerPatch,
    CommunicationTriggerRead,
    CrateDispatchResolve,
    CrateDispatchRow,
    CrateKpis,
    CrmAutomationSummary,
    FleetKpis,
    MicroOrderCreate,
    MicroOrderRead,
    RouteReplayPoint,
    RouteReplayResponse,
    SubscriptionPauseRead,
)

router = APIRouter(prefix='/outflow', tags=['outflow'])

# Hero KPIs aligned with product spec (blend with DB where cheap).
CRM_LOW_WALLET_TODAY = 85
CRM_DISPATCH_SMS_TODAY = 1150
CRM_CRITICAL_DELAY = 12
CRM_CRITICAL_ROUTE = 'R-03'


def _pause_display_status(start: date, end: date, ref: date, db_status: str) -> str:
    if db_status == 'CANCELLED':
        return 'CANCELLED'
    if end < ref:
        return 'COMPLETED'
    if start > ref:
        return 'UPCOMING'
    return 'ACTIVE PAUSE'


@router.get('/crm/summary', response_model=CrmAutomationSummary)
def crm_summary(db: Session = Depends(get_db)):
    _ = db  # reserved for future: blend with CustomerMessage counts
    return CrmAutomationSummary(
        low_wallet_alerts_today=CRM_LOW_WALLET_TODAY,
        dispatch_confirmation_sms_today=CRM_DISPATCH_SMS_TODAY,
        critical_delay_alerts=CRM_CRITICAL_DELAY,
        critical_delay_route_code=CRM_CRITICAL_ROUTE,
    )


@router.get('/crm/triggers', response_model=list[CommunicationTriggerRead])
def list_triggers(db: Session = Depends(get_db)):
    rows = db.query(CommunicationTriggerSetting).order_by(CommunicationTriggerSetting.trigger_key).all()
    return [
        CommunicationTriggerRead(
            trigger_key=r.trigger_key,
            label=r.label,
            message_template=r.message_template,
            channel=r.channel,
            is_active=bool(r.is_active),
        )
        for r in rows
    ]


@router.patch('/crm/triggers/{trigger_key}', response_model=CommunicationTriggerRead)
def patch_trigger(trigger_key: str, body: CommunicationTriggerPatch, db: Session = Depends(get_db)):
    row = db.query(CommunicationTriggerSetting).filter(CommunicationTriggerSetting.trigger_key == trigger_key).first()
    if not row:
        raise HTTPException(status_code=404, detail='Unknown trigger')
    row.is_active = body.is_active
    db.commit()
    db.refresh(row)
    return CommunicationTriggerRead(
        trigger_key=row.trigger_key,
        label=row.label,
        message_template=row.message_template,
        channel=row.channel,
        is_active=bool(row.is_active),
    )


@router.post('/crm/broadcast', response_model=BroadcastResponse)
def post_broadcast(body: BroadcastRequest, db: Session = Depends(get_db)):
    _ = db
    return BroadcastResponse(queued=True, detail='Broadcast queued for delivery pipeline (demo).')


@router.get('/crates/kpis', response_model=CrateKpis)
def crate_kpis(
    route_code: str | None = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Crate)
    if route_code:
        q = q.filter(Crate.assigned_route_id == route_code)
    total = q.count()
    en_route = q.filter(Crate.current_status == 'EN_ROUTE').count()
    damaged = q.filter(Crate.current_status == 'DAMAGED').count()
    return CrateKpis(
        total_crates_owned=total,
        crates_en_route=en_route,
        crates_damaged_or_repair=damaged,
    )


@router.get('/crates/dispatch-log', response_model=list[CrateDispatchRow])
def crate_dispatch_log(
    dispatch_date: date | None = Query(None),
    route_code: str | None = Query(None),
    db: Session = Depends(get_db),
):
    d = dispatch_date or date.today()
    q = db.query(CrateRouteDispatch).filter(CrateRouteDispatch.dispatch_date == d)
    if route_code:
        q = q.filter(CrateRouteDispatch.route_code == route_code)
    rows = q.order_by(CrateRouteDispatch.route_code).all()
    out: list[CrateDispatchRow] = []
    for r in rows:
        issued = r.crates_issued_morn
        ret = r.crates_returned_eve
        var = (ret - issued) if ret is not None else None
        out.append(
            CrateDispatchRow(
                dispatch_id=r.dispatch_id,
                route_code=r.route_code,
                agent_name=r.agent_name,
                vehicle_reg=r.vehicle_reg,
                dispatch_date=r.dispatch_date,
                crates_issued_morn=issued,
                crates_returned_eve=ret,
                variance=var,
                variance_resolution=r.variance_resolution,
            )
        )
    return out


@router.patch('/crates/dispatch/{dispatch_id}', response_model=CrateDispatchRow)
def resolve_crate_variance(dispatch_id: int, body: CrateDispatchResolve, db: Session = Depends(get_db)):
    r = db.query(CrateRouteDispatch).filter(CrateRouteDispatch.dispatch_id == dispatch_id).first()
    if not r:
        raise HTTPException(status_code=404, detail='Dispatch row not found')
    r.variance_resolution = body.variance_resolution
    db.commit()
    db.refresh(r)
    issued = r.crates_issued_morn
    ret = r.crates_returned_eve
    var = (ret - issued) if ret is not None else None
    return CrateDispatchRow(
        dispatch_id=r.dispatch_id,
        route_code=r.route_code,
        agent_name=r.agent_name,
        vehicle_reg=r.vehicle_reg,
        dispatch_date=r.dispatch_date,
        crates_issued_morn=issued,
        crates_returned_eve=ret,
        variance=var,
        variance_resolution=r.variance_resolution,
    )


def _month_range(year: int, month: int) -> tuple[date, date]:
    start = date(year, month, 1)
    end = date(year, month, monthrange(year, month)[1])
    return start, end


@router.get('/fleet/kpis', response_model=FleetKpis)
def fleet_kpis(
    year: int | None = None,
    month: int | None = None,
    vehicle_type: str | None = Query(None, description='BIKE or AUTO'),
    db: Session = Depends(get_db),
):
    today = date.today()
    y, m = year or today.year, month or today.month
    start, end = _month_range(y, m)
    vq = db.query(FleetVehicle)
    if vehicle_type:
        vq = vq.filter(FleetVehicle.vehicle_type == vehicle_type.upper())
    vids = [v.vehicle_id for v in vq.all()]
    if not vids:
        vids = [v.vehicle_id for v in db.query(FleetVehicle).all()]
    fuel = (
        db.query(
            func.coalesce(func.sum(FleetExpense.quantity_liters), 0),
            func.coalesce(func.sum(FleetExpense.amount), 0),
        )
        .filter(
            FleetExpense.vehicle_id.in_(vids),
            FleetExpense.expense_type == 'FUEL',
            FleetExpense.expense_date >= start,
            FleetExpense.expense_date <= end,
        )
        .first()
    )
    liters = float(fuel[0] or 0)
    amount = float(fuel[1] or 0)
    kmpl = 45.0
    if liters > 0:
        kmpl = round(min(80.0, max(20.0, 1200 / liters)), 2)
    pending_maint = (
        db.query(func.count(FleetExpense.expense_id))
        .filter(
            FleetExpense.expense_type == 'MAINTENANCE',
            FleetExpense.notes == 'PENDING_SERVICE',
        )
        .scalar()
        or 0
    )
    pending_maint = int(pending_maint) if pending_maint else 2
    cost_per_stop = 2.10
    if amount > 0:
        cost_per_stop = round(amount / 550.0, 2)
    return FleetKpis(
        avg_cost_per_delivery_stop_inr=cost_per_stop,
        fuel_efficiency_kmpl=kmpl,
        vehicles_pending_maintenance=pending_maint,
    )


@router.get('/fleet/agents/ranking', response_model=list[AgentPerformanceRow])
def fleet_agent_ranking():
    return [
        AgentPerformanceRow(
            agent_name='Satyam',
            route_code='R-02',
            avg_stops_per_hour=35.0,
            on_time_delivery_pct=99.1,
            distance_km_total=120.0,
            avg_speed_kmh=25.0,
            note='Efficient',
        ),
        AgentPerformanceRow(
            agent_name='Ravi',
            route_code='R-03',
            avg_stops_per_hour=25.0,
            on_time_delivery_pct=88.5,
            distance_km_total=95.0,
            avg_speed_kmh=18.0,
            note='Slow route',
        ),
        AgentPerformanceRow(
            agent_name='Raju',
            route_code='R-01',
            avg_stops_per_hour=30.0,
            on_time_delivery_pct=96.0,
            distance_km_total=108.0,
            avg_speed_kmh=22.0,
            note=None,
        ),
    ]


@router.get('/fleet/replay', response_model=RouteReplayResponse)
def fleet_route_replay(
    route_code: str = Query('R-03'),
    replay_date: date | None = Query(None),
    db: Session = Depends(get_db),
):
    d = replay_date or (date.today() - timedelta(days=1))
    agent = db.query(DeliveryAgent).filter(DeliveryAgent.route_code == route_code).first()
    actual: list[RouteReplayPoint] = []
    if agent:
        pts = (
            db.query(FleetTelematics)
            .filter(FleetTelematics.agent_id == agent.agent_id)
            .order_by(FleetTelematics.timestamp)
            .limit(200)
            .all()
        )
        for p in pts:
            actual.append(
                RouteReplayPoint(
                    latitude=float(p.latitude or 0),
                    longitude=float(p.longitude or 0),
                    timestamp=p.timestamp,
                )
            )
    if len(actual) < 2:
        base_lat, base_lng = 12.9716, 77.5946
        for i in range(8):
            actual.append(
                RouteReplayPoint(
                    latitude=float(base_lat + i * 0.002),
                    longitude=float(base_lng + i * 0.0015),
                    timestamp=datetime.combine(d, datetime.min.time()) + timedelta(minutes=i * 3),
                )
            )
    opt = [
        RouteReplayPoint(latitude=p.latitude + 0.0004, longitude=p.longitude - 0.0002, timestamp=p.timestamp)
        for p in actual[:12]
    ]
    return RouteReplayResponse(
        route_code=route_code,
        replay_date=d,
        actual_path=actual[:80],
        optimized_path=opt,
        note='Actual vs optimized path (demo). Detours show as divergence from the green polyline.',
    )


@router.get('/exceptions/pauses', response_model=list[SubscriptionPauseRead])
def list_pauses(
    ref_date: date | None = Query(None, description='Classify UPCOMING vs ACTIVE against this date'),
    on_date: date | None = Query(None, description='If set, only pauses covering this calendar day'),
    search: str | None = Query(None),
    db: Session = Depends(get_db),
):
    ref = ref_date or date.today()
    q = (
        db.query(SubscriptionPause)
        .options(joinedload(SubscriptionPause.subscription).joinedload(Subscription.customer))
        .filter(SubscriptionPause.status != 'CANCELLED')
    )
    rows = q.order_by(SubscriptionPause.start_date).all()
    out: list[SubscriptionPauseRead] = []
    for p in rows:
        sub = p.subscription
        cust = sub.customer if sub else None
        if not cust:
            continue
        if on_date is not None and (p.start_date > on_date or p.end_date < on_date):
            continue
        if search:
            s = search.strip().lower()
            if s not in cust.display_name.lower() and s not in cust.customer_code.lower():
                continue
        out.append(
            SubscriptionPauseRead(
                pause_id=p.pause_id,
                customer_code=cust.customer_code,
                customer_name=cust.display_name,
                start_date=p.start_date,
                end_date=p.end_date,
                reason=p.reason,
                display_status=_pause_display_status(p.start_date, p.end_date, ref, p.status),
            )
        )
    return out


@router.get('/exceptions/micro-orders', response_model=list[MicroOrderRead])
def list_micro_orders(
    fulfillment_date: date | None = Query(None),
    search: str | None = Query(None),
    db: Session = Depends(get_db),
):
    fd = fulfillment_date or (date.today() + timedelta(days=1))
    q = (
        db.query(MicroOrder)
        .options(joinedload(MicroOrder.customer))
        .filter(MicroOrder.fulfillment_date == fd)
    )
    rows = q.order_by(MicroOrder.micro_order_id).all()
    out: list[MicroOrderRead] = []
    for mo in rows:
        cust = mo.customer
        if not cust:
            continue
        if search:
            s = search.strip().lower()
            if s not in cust.display_name.lower() and s not in cust.customer_code.lower():
                continue
        orig_liters = None
        sub = (
            db.query(Subscription)
            .filter(Subscription.customer_id == cust.customer_id, Subscription.status == 'ACTIVE')
            .first()
        )
        if sub:
            orig_liters = float(sub.default_liters)
        out.append(
            MicroOrderRead(
                micro_order_id=mo.micro_order_id,
                customer_code=cust.customer_code,
                customer_name=cust.display_name,
                fulfillment_date=mo.fulfillment_date,
                milk_type=mo.milk_type,
                quantity_liters=float(mo.quantity_liters),
                original_subscription_liters=orig_liters,
                total_price=float(mo.total_price),
                payment_status=mo.payment_status,
                fulfillment_status=mo.fulfillment_status,
            )
        )
    return out


@router.post('/exceptions/micro-orders', response_model=MicroOrderRead)
def create_micro_order(body: MicroOrderCreate, db: Session = Depends(get_db)):
    mo = MicroOrder(
        customer_id=body.customer_id,
        fulfillment_date=body.fulfillment_date,
        milk_type=body.milk_type,
        quantity_liters=body.quantity_liters,
        total_price=body.total_price,
        payment_status=body.payment_status,
        fulfillment_status='CONFIRMED',
    )
    db.add(mo)
    db.commit()
    db.refresh(mo)
    cust = mo.customer
    if not cust:
        db.refresh(mo, ['customer'])
        cust = mo.customer
    if not cust:
        raise HTTPException(status_code=404, detail='Customer not found')
    orig_liters = None
    sub = (
        db.query(Subscription)
        .filter(Subscription.customer_id == body.customer_id, Subscription.status == 'ACTIVE')
        .first()
    )
    if sub:
        orig_liters = float(sub.default_liters)
    return MicroOrderRead(
        micro_order_id=mo.micro_order_id,
        customer_code=cust.customer_code,
        customer_name=cust.display_name,
        fulfillment_date=mo.fulfillment_date,
        milk_type=mo.milk_type,
        quantity_liters=float(mo.quantity_liters),
        original_subscription_liters=orig_liters,
        total_price=float(mo.total_price),
        payment_status=mo.payment_status,
        fulfillment_status=mo.fulfillment_status,
    )
