from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from fastapi_service.models import ProcurementFarmer


def list_farmers(
    db: Session,
    *,
    skip: int = 0,
    limit: int = 50,
    search: str | None = None,
) -> list[ProcurementFarmer]:
    stmt = select(ProcurementFarmer).order_by(ProcurementFarmer.name)
    if search:
        q = f'%{search.strip()}%'
        stmt = stmt.where(
            or_(
                ProcurementFarmer.name.ilike(q),
                ProcurementFarmer.farmer_code.ilike(q),
                ProcurementFarmer.phone.ilike(q),
            )
        )
    stmt = stmt.offset(skip).limit(limit)
    return list(db.scalars(stmt).all())


def count_farmers(db: Session, *, search: str | None = None) -> int:
    stmt = select(func.count()).select_from(ProcurementFarmer)
    if search:
        q = f'%{search.strip()}%'
        stmt = stmt.where(
            or_(
                ProcurementFarmer.name.ilike(q),
                ProcurementFarmer.farmer_code.ilike(q),
                ProcurementFarmer.phone.ilike(q),
            )
        )
    return int(db.scalar(stmt) or 0)


def get_by_id(db: Session, farmer_id: int) -> ProcurementFarmer | None:
    return db.get(ProcurementFarmer, farmer_id)


def get_by_code(db: Session, farmer_code: str) -> ProcurementFarmer | None:
    stmt = select(ProcurementFarmer).where(ProcurementFarmer.farmer_code == farmer_code)
    return db.scalars(stmt).first()


def create(db: Session, *, row: ProcurementFarmer) -> ProcurementFarmer:
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def save(db: Session, *, row: ProcurementFarmer) -> ProcurementFarmer:
    db.commit()
    db.refresh(row)
    return row


def delete(db: Session, *, row: ProcurementFarmer) -> None:
    db.delete(row)
    db.commit()
