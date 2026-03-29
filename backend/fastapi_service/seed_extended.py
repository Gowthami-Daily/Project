"""Roles + profile bootstrap for multi-tenant personal finance (idempotent)."""

from sqlalchemy.orm import Session

from fastapi_service.models import User
from fastapi_service.models_extended import Role
from fastapi_service.repositories import profile_repo
from fastapi_service.repositories import role_repo
from fastapi_service.seed_auth import BOOTSTRAP_SUPER_ADMIN_EMAIL
from fastapi_service.services import pf_profile_service


def seed_roles_if_empty(db: Session) -> None:
    if db.query(Role).first() is not None:
        return
    for name in ('ADMIN', 'USER', 'ACCOUNTANT', 'MANAGER', 'VIEWER'):
        db.add(Role(role_name=name))
    db.commit()


def seed_user_profiles_bootstrap(db: Session) -> None:
    """Attach ``role_id``, personal profile, and optional farm profile for admin."""
    users = db.query(User).all()
    for user in users:
        pf_profile_service.sync_legacy_role_to_role_id(db, user)
        pf_profile_service.ensure_personal_profile(db, user)
        if user.email and user.email.lower() == BOOTSTRAP_SUPER_ADMIN_EMAIL.lower():
            rows = profile_repo.list_profiles_for_user(db, user.id)
            if not any(p.profile_type == 'FARM' for p, _ in rows):
                pf_profile_service.create_farm_profile_link(
                    db, user, 'Gowthami Dairy Farm', 'gowthami'
                )


def seed_extended(db: Session) -> None:
    seed_roles_if_empty(db)
    seed_user_profiles_bootstrap(db)
