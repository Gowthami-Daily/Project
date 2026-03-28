"""Default admin user for local development (idempotent)."""

from sqlalchemy.orm import Session

from fastapi_service.core.password import hash_password
from fastapi_service.models import User


def seed_default_admin_if_empty(db: Session) -> None:
    if db.query(User).first() is not None:
        return
    db.add(
        User(
            name='System Admin',
            email='admin@gowthami.local',
            password_hash=hash_password('ChangeMe!Admin123'),
            role='ADMIN',
            is_active=True,
        )
    )
    db.commit()
