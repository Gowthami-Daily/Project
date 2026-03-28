from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from fastapi_service.models import ProcurementFarmer
from fastapi_service.repositories import farmer_repo
from fastapi_service.schemas_farmer import FarmerCreate, FarmerUpdate


def list_farmers(
    db: Session,
    *,
    skip: int = 0,
    limit: int = 50,
    search: str | None = None,
) -> tuple[list[ProcurementFarmer], int]:
    rows = farmer_repo.list_farmers(db, skip=skip, limit=limit, search=search)
    total = farmer_repo.count_farmers(db, search=search)
    return rows, total


def get_farmer(db: Session, farmer_id: int) -> ProcurementFarmer:
    row = farmer_repo.get_by_id(db, farmer_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Farmer not found')
    return row


def create_farmer(db: Session, payload: FarmerCreate) -> ProcurementFarmer:
    if farmer_repo.get_by_code(db, payload.farmer_code):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f'Farmer code already exists: {payload.farmer_code}',
        )
    row = ProcurementFarmer(
        farmer_code=payload.farmer_code.strip(),
        name=payload.name.strip(),
        phone=payload.phone.strip() if payload.phone else None,
        village=payload.village.strip() if payload.village else None,
        milk_type=payload.milk_type.strip().upper(),
        status=payload.status.strip().upper(),
        balance=payload.balance,
        purchase_cost=payload.purchase_cost,
    )
    return farmer_repo.create(db, row=row)


def update_farmer(db: Session, farmer_id: int, payload: FarmerUpdate) -> ProcurementFarmer:
    row = get_farmer(db, farmer_id)
    data = payload.model_dump(exclude_unset=True)
    if 'farmer_code' in data and data['farmer_code']:
        other = farmer_repo.get_by_code(db, data['farmer_code'].strip())
        if other and other.farmer_id != farmer_id:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail='Farmer code already in use')
    for key, value in data.items():
        if value is None:
            continue
        if key == 'farmer_code':
            setattr(row, key, str(value).strip())
        elif key in ('name', 'village') and isinstance(value, str):
            setattr(row, key, value.strip())
        elif key == 'phone' and isinstance(value, str):
            setattr(row, key, value.strip() or None)
        elif key in ('milk_type', 'status') and isinstance(value, str):
            setattr(row, key, value.strip().upper())
        else:
            setattr(row, key, value)
    return farmer_repo.save(db, row=row)


def delete_farmer(db: Session, farmer_id: int) -> None:
    row = get_farmer(db, farmer_id)
    farmer_repo.delete(db, row=row)
