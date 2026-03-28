from sqlalchemy import select
from sqlalchemy.orm import Session

from fastapi_service.models_extended import Role


def get_by_name(db: Session, role_name: str) -> Role | None:
    stmt = select(Role).where(Role.role_name == role_name.upper())
    return db.scalars(stmt).first()


def get_by_id(db: Session, role_id: int) -> Role | None:
    return db.get(Role, role_id)


def list_all(db: Session) -> list[Role]:
    return list(db.scalars(select(Role).order_by(Role.role_name)).all())
