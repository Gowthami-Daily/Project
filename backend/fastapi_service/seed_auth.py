"""Default admin user for local development (idempotent)."""

from sqlalchemy.orm import Session

from fastapi_service.core.password import hash_password
from fastapi_service.models import User
from fastapi_service.repositories import user_repo

BOOTSTRAP_SUPER_ADMIN_EMAIL = 'admin@gowthami.local'


def seed_default_admin_if_empty(db: Session) -> None:
    if db.query(User).first() is not None:
        return
    db.add(
        User(
            name='System Admin',
            email=BOOTSTRAP_SUPER_ADMIN_EMAIL,
            password_hash=hash_password('ChangeMe!Admin123'),
            role='SUPER_ADMIN',
            is_active=True,
        )
    )
    db.commit()


def ensure_platform_super_admin_account(db: Session) -> None:
    """
    Idempotent: legacy DBs may have ``admin@gowthami.local`` as ADMIN/USER from older seeds.
    Platform super-admin UI checks ``user.role == SUPER_ADMIN`` (see /auth/me).
    """
    u = user_repo.get_by_email(db, BOOTSTRAP_SUPER_ADMIN_EMAIL)
    if u is None:
        return
    if str(u.role or '').strip().upper() == 'SUPER_ADMIN':
        return
    u.role = 'SUPER_ADMIN'
    db.add(u)
    db.commit()
