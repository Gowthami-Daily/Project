from calendar import monthrange
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from fastapi_service.database import get_db
from fastapi_service.sql_compat import filter_on_calendar_day
from fastapi_service.models import BusinessExpense, Customer, CustomerWalletTopup, ExpenseCategory
from fastapi_service.schemas_ledger import (
    ExpenseCategoryRead,
    ExpenseCreate,
    ExpenseRead,
    OpexSummary,
    PLKpis,
    PLLine,
    PLResponse,
    ScalingAnalytics,
    TopupRead,
    TopupReconcile,
    WalletKpis,
)

router = APIRouter(prefix='/ledger', tags=['ledger'])

REV_WALLET_SALES = 475_000.0
REV_MICRO_ORDERS = 10_000.0
COGS_RAW_MILK = 310_000.0
WALLET_FLOAT_DEMO = 320_000.0
LAB_OPEX_DEMO = 5_000.0


def _month_range(year: int, month: int) -> tuple[date, date]:
    start = date(year, month, 1)
    end = date(year, month, monthrange(year, month)[1])
    return start, end


def _opex_approved_sum(db: Session, start: date, end: date) -> float:
    q = (
        db.query(func.coalesce(func.sum(BusinessExpense.amount), 0))
        .filter(
            BusinessExpense.expense_date >= start,
            BusinessExpense.expense_date <= end,
            BusinessExpense.approval_status == 'APPROVED',
        )
        .scalar()
    )
    return float(q or 0)


@router.get('/pl/mtd', response_model=PLResponse)
def pl_mtd(
    db: Session = Depends(get_db),
    year: int | None = None,
    month: int | None = None,
):
    today = date.today()
    y = year or today.year
    m = month or today.month
    start, end = _month_range(y, m)
    period_label = start.strftime('%b %Y')

    opex_total = _opex_approved_sum(db, start, end)
    revenue = REV_WALLET_SALES + REV_MICRO_ORDERS
    gross = revenue - COGS_RAW_MILK
    net = gross - opex_total
    margin = (net / revenue * 100) if revenue else 0.0

    rows = (
        db.query(BusinessExpense, ExpenseCategory)
        .join(ExpenseCategory, BusinessExpense.category_id == ExpenseCategory.category_id)
        .filter(
            BusinessExpense.expense_date >= start,
            BusinessExpense.expense_date <= end,
            BusinessExpense.approval_status == 'APPROVED',
        )
        .all()
    )
    by_label: dict[str, float] = {}
    for exp, cat in rows:
        key = cat.name
        by_label[key] = by_label.get(key, 0.0) + float(exp.amount)

    lines: list[PLLine] = [
        PLLine(label='Customer Wallets (Milk Sales)', amount=REV_WALLET_SALES, line_type='revenue'),
        PLLine(label='One-time Micro-Orders', amount=REV_MICRO_ORDERS, line_type='revenue'),
        PLLine(label='Farmer Payouts (Raw Milk)', amount=-COGS_RAW_MILK, line_type='cogs'),
        PLLine(label='Gross Profit', amount=gross, line_type='subtotal'),
    ]
    for label, amt in sorted(by_label.items(), key=lambda x: -x[1]):
        lines.append(PLLine(label=label, amount=-amt, line_type='opex'))
    lines.append(PLLine(label='NET PROFIT', amount=net, line_type='net'))

    return PLResponse(
        kpis=PLKpis(
            total_revenue=revenue,
            cogs=COGS_RAW_MILK,
            opex=opex_total,
            net_profit=net,
            margin_pct=round(margin, 2),
            period_label=period_label,
        ),
        lines=lines,
    )


@router.get('/wallets/summary', response_model=WalletKpis)
def wallet_summary(db: Session = Depends(get_db)):
    today = date.today()
    q = db.query(CustomerWalletTopup).filter(filter_on_calendar_day(CustomerWalletTopup.timestamp, today))
    topups = q.all()
    if not topups:
        return WalletKpis(
            total_active_float=WALLET_FLOAT_DEMO,
            topups_today=0,
            upi_pct=80.0,
            cash_pct=20.0,
        )
    topups_today = sum(float(t.amount) for t in topups)
    upi_like = sum(
        float(t.amount) for t in topups if 'UPI' in t.payment_method.upper() or t.payment_method == 'NEFT'
    )
    cash_like = sum(float(t.amount) for t in topups if 'CASH' in t.payment_method.upper())
    tot = upi_like + cash_like or 1.0
    upi_pct = round((upi_like / tot) * 100, 1)
    cash_pct = round((cash_like / tot) * 100, 1)
    return WalletKpis(
        total_active_float=WALLET_FLOAT_DEMO,
        topups_today=topups_today,
        upi_pct=upi_pct,
        cash_pct=cash_pct,
    )


@router.get('/wallets/topups', response_model=list[TopupRead])
def wallet_topups(db: Session = Depends(get_db), limit: int = Query(100, le=500)):
    rows = (
        db.query(CustomerWalletTopup)
        .options(joinedload(CustomerWalletTopup.customer))
        .order_by(CustomerWalletTopup.timestamp.desc())
        .limit(limit)
        .all()
    )
    out = []
    for t in rows:
        c = t.customer
        out.append(
            TopupRead(
                topup_id=t.topup_id,
                customer_id=t.customer_id,
                customer_name=c.display_name,
                customer_code=c.customer_code,
                timestamp=t.timestamp,
                payment_method=t.payment_method,
                reference_id=t.reference_id,
                amount=float(t.amount),
                collected_by_staff_id=t.collected_by_staff_id,
                staff_reconciled_by=t.staff_reconciled_by,
                reconciliation_status=t.reconciliation_status,
                notes=t.notes,
            )
        )
    return out


@router.patch('/wallets/topups/{topup_id}', response_model=TopupRead)
def wallet_topup_reconcile(topup_id: int, body: TopupReconcile, db: Session = Depends(get_db)):
    t = db.get(CustomerWalletTopup, topup_id)
    if not t:
        raise HTTPException(status_code=404, detail='Top-up not found')
    t.reconciliation_status = body.reconciliation_status
    t.staff_reconciled_by = body.staff_reconciled_by
    db.commit()
    db.refresh(t)
    c = t.customer
    return TopupRead(
        topup_id=t.topup_id,
        customer_id=t.customer_id,
        customer_name=c.display_name,
        customer_code=c.customer_code,
        timestamp=t.timestamp,
        payment_method=t.payment_method,
        reference_id=t.reference_id,
        amount=float(t.amount),
        collected_by_staff_id=t.collected_by_staff_id,
        staff_reconciled_by=t.staff_reconciled_by,
        reconciliation_status=t.reconciliation_status,
        notes=t.notes,
    )


@router.get('/opex/categories', response_model=list[ExpenseCategoryRead])
def opex_categories(db: Session = Depends(get_db)):
    return db.query(ExpenseCategory).order_by(ExpenseCategory.name).all()


@router.get('/opex/summary', response_model=OpexSummary)
def opex_summary(
    db: Session = Depends(get_db),
    year: int | None = None,
    month: int | None = None,
):
    today = date.today()
    y = year or today.year
    m = month or today.month
    start, end = _month_range(y, m)

    cats = {c.slug: c.category_id for c in db.query(ExpenseCategory).all()}

    def sum_cat(slugs: list[str]) -> float:
        ids = [cats[s] for s in slugs if s in cats]
        if not ids:
            return 0.0
        q = (
            db.query(func.coalesce(func.sum(BusinessExpense.amount), 0))
            .filter(
                BusinessExpense.category_id.in_(ids),
                BusinessExpense.expense_date >= start,
                BusinessExpense.expense_date <= end,
                BusinessExpense.approval_status == 'APPROVED',
            )
            .scalar()
        )
        return float(q or 0)

    fleet = sum_cat(['fuel', 'maintenance'])
    hygiene = sum_cat(['supplies'])
    total = _opex_approved_sum(db, start, end)

    return OpexSummary(
        fleet_total=fleet,
        hygiene_packaging=hygiene,
        lab_pasteurization=LAB_OPEX_DEMO,
        opex_mtd_total=total,
    )


@router.get('/opex/expenses', response_model=list[ExpenseRead])
def opex_expenses(
    db: Session = Depends(get_db),
    category_id: int | None = None,
    year: int | None = None,
    month: int | None = None,
    limit: int = Query(100, le=500),
):
    today = date.today()
    y = year or today.year
    m = month or today.month
    start, end = _month_range(y, m)

    q = (
        db.query(BusinessExpense)
        .options(joinedload(BusinessExpense.category))
        .filter(BusinessExpense.expense_date >= start, BusinessExpense.expense_date <= end)
    )
    if category_id is not None:
        q = q.filter(BusinessExpense.category_id == category_id)
    rows = q.order_by(BusinessExpense.expense_date.desc()).limit(limit).all()
    return [
        ExpenseRead(
            expense_id=r.expense_id,
            category_id=r.category_id,
            category_name=r.category.name,
            expense_date=r.expense_date,
            supplier_staff_name=r.supplier_staff_name,
            amount=float(r.amount),
            payment_method=r.payment_method,
            proof_url=r.proof_url,
            approval_status=r.approval_status,
            notes=r.notes,
        )
        for r in rows
    ]


@router.post('/opex/expenses', response_model=ExpenseRead, status_code=201)
def opex_expense_create(payload: ExpenseCreate, db: Session = Depends(get_db)):
    cat = db.get(ExpenseCategory, payload.category_id)
    if not cat:
        raise HTTPException(status_code=400, detail='Invalid category_id')
    row = BusinessExpense(
        category_id=payload.category_id,
        expense_date=payload.expense_date,
        supplier_staff_name=payload.supplier_staff_name,
        amount=payload.amount,
        payment_method=payload.payment_method,
        proof_url=payload.proof_url,
        notes=payload.notes,
        is_recurring=payload.is_recurring,
        created_by_user_id=payload.created_by_user_id,
        approval_status='PENDING_APPROVAL',
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return ExpenseRead(
        expense_id=row.expense_id,
        category_id=row.category_id,
        category_name=cat.name,
        expense_date=row.expense_date,
        supplier_staff_name=row.supplier_staff_name,
        amount=float(row.amount),
        payment_method=row.payment_method,
        proof_url=row.proof_url,
        approval_status=row.approval_status,
        notes=row.notes,
    )


@router.get('/analytics/scaling', response_model=ScalingAnalytics)
def scaling_analytics():
    dispatched_liters = 12_000.0
    net_for_ppl = 90_000.0
    ppl = round(net_for_ppl / dispatched_liters, 2)
    return ScalingAnalytics(
        profit_per_liter=ppl,
        dispatched_liters_mtd=dispatched_liters,
        product_mix=[
            {'name': 'Buffalo Milk', 'profit_contribution_pct': 75, 'fill': '#004080'},
            {'name': 'Cow Milk', 'profit_contribution_pct': 25, 'fill': '#38bdf8'},
        ],
        route_profitability=[
            {'route': 'R1 Main Town', 'net_margin_inr': 28500},
            {'route': 'R2 Temple Road', 'net_margin_inr': 24200},
            {'route': 'R3 East Sector', 'net_margin_inr': 18500},
            {'route': 'R4 River Colony', 'net_margin_inr': 19800},
        ],
        wastage_rows=[
            {
                'type': 'Logistics Spoilage (R3 Accident)',
                'quantity_l': 45,
                'est_cost': 2100,
                'trend': 'up',
            },
            {
                'type': 'QA Rejection (Farmer 1005 Urea)',
                'quantity_l': 50,
                'est_cost': 1900,
                'trend': 'down',
            },
        ],
    )
