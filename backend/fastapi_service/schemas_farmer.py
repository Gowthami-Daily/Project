from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class FarmerBase(BaseModel):
    farmer_code: str = Field(..., max_length=32, description='External ID / tag shown in UI')
    name: str = Field(..., max_length=255)
    phone: str | None = Field(None, max_length=32)
    village: str | None = Field(None, max_length=255)
    milk_type: str = Field(default='COW', max_length=16)
    status: str = Field(default='ACTIVE', max_length=16)
    purchase_cost: float | None = None


class FarmerCreate(FarmerBase):
    balance: float = 0.0


class FarmerUpdate(BaseModel):
    farmer_code: str | None = Field(None, max_length=32)
    name: str | None = Field(None, max_length=255)
    phone: str | None = Field(None, max_length=32)
    village: str | None = Field(None, max_length=255)
    milk_type: str | None = Field(None, max_length=16)
    status: str | None = Field(None, max_length=16)
    balance: float | None = None
    purchase_cost: float | None = None


class FarmerRead(FarmerBase):
    model_config = ConfigDict(from_attributes=True)

    farmer_id: int
    balance: float
    created_at: datetime
