from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class QALabTestCreate(BaseModel):
    reference_log_id: int | None = None
    batch_id: str | None = Field(None, max_length=50)
    collection_center_id: int | None = None
    tester_staff_id: int | None = None
    cob_test_passed: bool = True
    alcohol_test_passed: bool = True
    organoleptic_normal: bool = True
    urea_percentage: Decimal | None = None
    sugar_detected: bool = False
    salt_detected: bool = False
    starch_detected: bool = False
    detergent_detected: bool = False
    lab_notes: str | None = None


class QALabTestRead(BaseModel):
    test_id: int
    batch_id: str | None
    collection_center_id: int | None
    tested_at: datetime
    cob_test_passed: bool
    alcohol_test_passed: bool
    organoleptic_test_passed: bool
    urea_percentage: float | None
    sugar_detected: bool
    salt_detected: bool
    final_result: str
    lab_notes: str | None
    test_panel: str = 'COB / Alcohol / Organoleptic'

    model_config = {'from_attributes': True}


class QASummary(BaseModel):
    samples_tested: int
    samples_planned: int
    rejected_batches: int
    estimated_loss_liters: int
    adulteration_index_label: str
    adulteration_index_value: float


class CollectionCenterRead(BaseModel):
    center_id: int
    name: str
    status: str

    model_config = {'from_attributes': True}


class CenterAnalyticsRow(BaseModel):
    center_name: str
    active_farmers: int
    avg_liters_per_day: int
    total_procured_mtd_liters: int
    avg_fat_pct: float
    staff_label: str


class CenterAnalyticsResponse(BaseModel):
    volume_by_center: list[dict]
    quality_by_center: list[dict]
    heatmap: dict
    branch_rows: list[CenterAnalyticsRow]


class InventoryTankRead(BaseModel):
    tank_id: int
    tank_name: str
    max_capacity_liters: int
    current_liters: float
    current_temperature_celsius: float | None
    milk_type: str | None
    status: str
    fill_pct: float

    model_config = {'from_attributes': True}


class InventoryTransactionRead(BaseModel):
    transaction_id: int
    from_source: str | None
    to_destination: str | None
    quantity_liters: float
    milk_type: str
    txn_type: str | None
    occurred_at: datetime
    notes: str | None

    model_config = {'from_attributes': True}


class InventoryTransactionCreate(BaseModel):
    from_source: str | None = None
    to_destination: str | None = None
    quantity_liters: Decimal
    milk_type: str = Field(..., max_length=10)
    txn_type: str | None = Field(None, max_length=40)
    notes: str | None = None
    created_by_user_id: int | None = None
