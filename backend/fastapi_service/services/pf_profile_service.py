from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from fastapi_service.models import User
from fastapi_service.models_extended import Profile, UserProfileAccess
from fastapi_service.repositories import profile_repo
from fastapi_service.repositories import role_repo


def ensure_personal_profile(db: Session, user: User) -> Profile:
    existing = profile_repo.first_profile_id_for_user(db, user.id)
    if existing:
        p = profile_repo.get_profile(db, existing)
        if p is not None:
            return p
    prof = Profile(
        profile_name=f'{user.name} - Personal',
        profile_type='PERSONAL',
        family_id=None,
        created_by_user_id=user.id,
        dairy_link_key=None,
    )
    prof = profile_repo.create_profile(db, prof)
    profile_repo.grant_access(
        db,
        UserProfileAccess(user_id=user.id, profile_id=prof.id, permission='owner'),
    )
    return prof


def create_farm_profile_link(db: Session, user: User, name: str, link_key: str = 'gowthami') -> Profile:
    """Logical link to dairy ERP — no FK into dairy tables."""
    prof = Profile(
        profile_name=name,
        profile_type='FARM',
        family_id=None,
        created_by_user_id=user.id,
        dairy_link_key=link_key,
    )
    prof = profile_repo.create_profile(db, prof)
    profile_repo.grant_access(
        db,
        UserProfileAccess(user_id=user.id, profile_id=prof.id, permission='owner'),
    )
    return prof


def list_mine(db: Session, user_id: int) -> list[dict]:
    rows = profile_repo.list_profiles_for_user(db, user_id)
    return [
        {
            'profile_id': p.id,
            'profile_name': p.profile_name,
            'profile_type': p.profile_type,
            'permission': perm,
            'dairy_link_key': p.dairy_link_key,
        }
        for p, perm in rows
    ]


def assert_profile_access(db: Session, user_id: int, profile_id: int) -> UserProfileAccess:
    acc = profile_repo.get_access(db, user_id, profile_id)
    if not acc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='No access to this profile')
    return acc


def assert_can_write(db: Session, user_id: int, profile_id: int) -> None:
    acc = assert_profile_access(db, user_id, profile_id)
    if acc.permission.lower() == 'viewer':
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Viewer cannot modify data')


def switch_profile(db: Session, user_id: int, profile_id: int) -> int:
    assert_profile_access(db, user_id, profile_id)
    return profile_id


def resolve_effective_role_name(db: Session, user: User) -> str:
    if user.role_id:
        r = role_repo.get_by_id(db, user.role_id)
        if r:
            return r.role_name.upper()
    return user.role.upper()


def assign_default_role_id(db: Session, user: User, role_name: str = 'USER') -> None:
    r = role_repo.get_by_name(db, role_name)
    if r:
        user.role_id = r.id
        db.commit()
        db.refresh(user)


def sync_legacy_role_to_role_id(db: Session, user: User) -> None:
    if user.role_id is not None:
        return
    rn = str(user.role).strip().upper()
    if rn == 'STAFF':
        rn = 'USER'
    valid = {'ADMIN', 'USER', 'ACCOUNTANT', 'MANAGER', 'VIEWER'}
    if rn not in valid:
        rn = 'USER'
    r = role_repo.get_by_name(db, rn)
    if r:
        user.role_id = r.id
        db.commit()
        db.refresh(user)
