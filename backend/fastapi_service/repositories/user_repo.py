from sqlalchemy import select
from sqlalchemy.orm import Session

from fastapi_service.models import User


def list_all(db: Session) -> list[User]:
    return list(db.scalars(select(User).order_by(User.id.asc())).all())


def get_by_id(db: Session, user_id: int) -> User | None:
    return db.get(User, user_id)


def get_by_email(db: Session, email: str) -> User | None:
    stmt = select(User).where(User.email == email.strip().lower())
    return db.scalars(stmt).first()


def create(db: Session, *, user: User) -> User:
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def save(db: Session, user: User) -> User:
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def delete_hard(db: Session, user: User) -> None:
    db.delete(user)
    db.commit()
