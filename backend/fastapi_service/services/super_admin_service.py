"""Platform super-admin: user management, stats, audit read, permission rows."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from fastapi_service.models import User
from fastapi_service.models_extended import (
    AuditLog,
    FinanceAsset,
    FinanceExpense,
    FinanceIncome,
    FinanceLiability,
    Loan,
    UserPermission,
)
from fastapi_service.repositories import user_repo
from fastapi_service.schemas_auth import (
    AdminUserCreateBody,
    AdminUserPatchBody,
    UserCreate,
    UserPermissionUpsertBody,
)
from fastapi_service.services import auth_service


def system_stats(db: Session) -> dict:
    return {
        'total_users': int(db.scalar(select(func.count(User.id))) or 0),
        'total_loans': int(db.scalar(select(func.count(Loan.id))) or 0),
        'total_income_rows': int(db.scalar(select(func.count(FinanceIncome.id))) or 0),
        'total_expense_rows': int(db.scalar(select(func.count(FinanceExpense.id))) or 0),
        'total_assets': int(db.scalar(select(func.count(FinanceAsset.id))) or 0),
        'total_liabilities': int(db.scalar(select(func.count(FinanceLiability.id))) or 0),
    }


def list_users(db: Session) -> list[User]:
    return user_repo.list_all(db)


def create_user(db: Session, body: AdminUserCreateBody, *, actor: User) -> User:
    role = (body.role or 'USER').strip().upper()
    if role == 'SUPER_ADMIN':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Cannot create another SUPER_ADMIN via API; promote in database.',
        )
    payload = UserCreate(name=body.name, email=str(body.email), password=body.password, role=role)
    user = auth_service.register(db, payload)
    db.add(
        AuditLog(
            user_id=actor.id,
            action='admin_create_user target_user_id=' + str(user.id),
            detail=user.email,
        )
    )
    db.commit()
    return user


def patch_user(db: Session, target: User, body: AdminUserPatchBody, *, actor: User) -> User:
    if target.id == actor.id and body.is_active is False:
        raise HTTPException(status_code=400, detail='Cannot deactivate yourself')
    if body.name is not None:
        target.name = body.name.strip()
    if body.role is not None:
        r = body.role.strip().upper()
        if r == 'SUPER_ADMIN':
            raise HTTPException(status_code=400, detail='Cannot assign SUPER_ADMIN via API')
        target.role = r
    if body.is_active is not None:
        target.is_active = body.is_active
    db.add(target)
    db.add(
        AuditLog(
            user_id=actor.id,
            action='admin_patch_user',
            detail=f'user_id={target.id}',
        )
    )
    db.commit()
    db.refresh(target)
    return target


def reset_password(db: Session, target: User, new_password: str, *, actor: User) -> None:
    from fastapi_service.core.password import hash_password

    target.password_hash = hash_password(new_password)
    db.add(target)
    db.add(
        AuditLog(
            user_id=actor.id,
            action='admin_reset_password',
            detail=f'user_id={target.id}',
        )
    )
    db.commit()


def soft_delete_user(db: Session, target: User, *, actor: User) -> None:
    if target.id == actor.id:
        raise HTTPException(status_code=400, detail='Cannot delete yourself')
    if (target.role or '').upper() == 'SUPER_ADMIN':
        raise HTTPException(status_code=400, detail='Cannot remove SUPER_ADMIN account')
    target.is_active = False
    db.add(target)
    db.add(
        AuditLog(
            user_id=actor.id,
            action='admin_deactivate_user',
            detail=f'user_id={target.id}',
        )
    )
    db.commit()


def list_permissions(db: Session, user_id: int) -> list[UserPermission]:
    stmt = select(UserPermission).where(UserPermission.user_id == user_id).order_by(UserPermission.module_name)
    return list(db.scalars(stmt).all())


def replace_permissions(
    db: Session,
    user_id: int,
    rows: list[UserPermissionUpsertBody],
    *,
    actor: User,
) -> list[UserPermission]:
    db.execute(delete(UserPermission).where(UserPermission.user_id == user_id))
    for r in rows:
        db.add(
            UserPermission(
                user_id=user_id,
                module_name=r.module_name.strip()[:64],
                can_view=bool(r.can_view),
                can_edit=bool(r.can_edit),
                can_delete=bool(r.can_delete),
                can_export=bool(r.can_export),
            )
        )
    db.add(
        AuditLog(
            user_id=actor.id,
            action='admin_set_permissions',
            detail=f'user_id={user_id} modules={len(rows)}',
        )
    )
    db.commit()
    return list_permissions(db, user_id)


def list_audit_logs(db: Session, *, skip: int = 0, limit: int = 100) -> list[AuditLog]:
    stmt = select(AuditLog).order_by(AuditLog.created_at.desc()).offset(skip).limit(min(limit, 500))
    return list(db.scalars(stmt).all())


def backup_not_configured_payload() -> dict:
    return {
        'status': 'not_configured',
        'message': 'Server-side backup requires DBA/pg_dump. Use managed DB backups or run 007_super_admin_auth.sql on schedule.',
        'generated_at': datetime.now(timezone.utc).isoformat(),
    }
