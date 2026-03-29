"""Platform super-admin API. Requires ``user.role == SUPER_ADMIN`` (JWT + DB user)."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from fastapi_service.core.dependencies import DbSession, get_current_user
from fastapi_service.models import User
from fastapi_service.repositories import user_repo
from fastapi_service.schemas_auth import (
    AdminResetPasswordBody,
    AdminUserCreateBody,
    AdminUserOut,
    AdminUserPatchBody,
    AuditLogOut,
    UserPermissionOut,
    UserPermissionUpsertBody,
)
from fastapi_service.services import super_admin_service

router = APIRouter(prefix='/super-admin', tags=['super-admin'])


def require_super_admin(user: User = Depends(get_current_user)) -> User:
    if str(user.role or '').strip().upper() != 'SUPER_ADMIN':
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Super admin access required')
    return user


SuperAdminUser = Annotated[User, Depends(require_super_admin)]


@router.get('/stats')
def admin_stats(db: DbSession, admin: SuperAdminUser) -> dict:
    _ = admin
    return super_admin_service.system_stats(db)


@router.get('/users', response_model=list[AdminUserOut])
def admin_list_users(db: DbSession, admin: SuperAdminUser) -> list[User]:
    _ = admin
    return super_admin_service.list_users(db)


@router.post('/users', response_model=AdminUserOut, status_code=201)
def admin_create_user(
    db: DbSession,
    admin: SuperAdminUser,
    body: AdminUserCreateBody,
) -> User:
    return super_admin_service.create_user(db, body, actor=admin)


@router.patch('/users/{user_id}', response_model=AdminUserOut)
def admin_patch_user(
    db: DbSession,
    admin: SuperAdminUser,
    user_id: int,
    body: AdminUserPatchBody,
) -> User:
    target = user_repo.get_by_id(db, user_id)
    if target is None:
        raise HTTPException(status_code=404, detail='User not found')
    return super_admin_service.patch_user(db, target, body, actor=admin)


@router.post('/users/{user_id}/reset-password', status_code=204)
def admin_reset_password(
    db: DbSession,
    admin: SuperAdminUser,
    user_id: int,
    body: AdminResetPasswordBody,
) -> None:
    target = user_repo.get_by_id(db, user_id)
    if target is None:
        raise HTTPException(status_code=404, detail='User not found')
    super_admin_service.reset_password(db, target, body.password, actor=admin)


@router.delete('/users/{user_id}', status_code=204)
def admin_delete_user(db: DbSession, admin: SuperAdminUser, user_id: int) -> None:
    target = user_repo.get_by_id(db, user_id)
    if target is None:
        raise HTTPException(status_code=404, detail='User not found')
    super_admin_service.soft_delete_user(db, target, actor=admin)


@router.get('/users/{user_id}/permissions', response_model=list[UserPermissionOut])
def admin_list_permissions(db: DbSession, admin: SuperAdminUser, user_id: int) -> list:
    _ = admin
    if user_repo.get_by_id(db, user_id) is None:
        raise HTTPException(status_code=404, detail='User not found')
    return super_admin_service.list_permissions(db, user_id)


@router.put('/users/{user_id}/permissions', response_model=list[UserPermissionOut])
def admin_put_permissions(
    db: DbSession,
    admin: SuperAdminUser,
    user_id: int,
    body: list[UserPermissionUpsertBody],
) -> list:
    if user_repo.get_by_id(db, user_id) is None:
        raise HTTPException(status_code=404, detail='User not found')
    return super_admin_service.replace_permissions(db, user_id, body, actor=admin)


@router.get('/audit-logs', response_model=list[AuditLogOut])
def admin_audit_logs(
    db: DbSession,
    admin: SuperAdminUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
) -> list:
    _ = admin
    return super_admin_service.list_audit_logs(db, skip=skip, limit=limit)


@router.post('/backup')
def admin_backup_request(db: DbSession, admin: SuperAdminUser) -> dict:
    _ = admin
    _ = db
    return super_admin_service.backup_not_configured_payload()
