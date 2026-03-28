from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class PLKpis(BaseModel):
    total_revenue: float
    cogs: float
    opex: float
    net_profit: float
    margin_pct: float
    period_label: str


class PLLine(BaseModel):
    label: str
    amount: float
    line_type: str  # revenue, cogs, subtotal, opex, net


class PLResponse(BaseModel):
    kpis: PLKpis
    lines: list[PLLine]


class WalletKpis(BaseModel):
    total_active_float: float
    topups_today: float
    upi_pct: float
    cash_pct: float


class TopupRead(BaseModel):
    topup_id: int
    customer_id: int
    customer_name: str
    customer_code: str
    timestamp: datetime
    payment_method: str
    reference_id: str | None
    amount: float
    collected_by_staff_id: int | None
    staff_reconciled_by: int | None = None
    reconciliation_status: str
    notes: str | None


class TopupReconcile(BaseModel):
    reconciliation_status: str
    staff_reconciled_by: int | None = None


class ExpenseCategoryRead(BaseModel):
    category_id: int
    name: str
    slug: str

    model_config = {'from_attributes': True}


class ExpenseRead(BaseModel):
    expense_id: int
    category_id: int
    category_name: str
    expense_date: date
    supplier_staff_name: str | None
    amount: float
    payment_method: str | None
    proof_url: str | None
    approval_status: str
    notes: str | None

    model_config = {'from_attributes': True}


class ExpenseCreate(BaseModel):
    category_id: int
    expense_date: date
    supplier_staff_name: str | None = None
    amount: Decimal
    payment_method: str | None = Field(None, max_length=24)
    proof_url: str | None = Field(None, max_length=512)
    notes: str | None = None
    is_recurring: bool = False
    created_by_user_id: int | None = None


class OpexSummary(BaseModel):
    fleet_total: float
    hygiene_packaging: float
    lab_pasteurization: float
    opex_mtd_total: float


class ScalingAnalytics(BaseModel):
    profit_per_liter: float
    dispatched_liters_mtd: float
    product_mix: list[dict]
    route_profitability: list[dict]
    wastage_rows: list[dict]
