from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from fastapi_service.core.password import hash_password, verify_password
from fastapi_service.core.security import create_access_token
from fastapi_service.models import User
from fastapi_service.repositories import profile_repo
from fastapi_service.repositories import user_repo
from fastapi_service.schemas_auth import UserCreate
from fastapi_service.services import pf_profile_service


def authenticate(db: Session, email: str, password: str) -> User:
    user = user_repo.get_by_email(db, email.strip().lower())
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Incorrect email or password',
            headers={'WWW-Authenticate': 'Bearer'},
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='User is inactive')
    return user


def issue_token(db: Session, user: User, active_profile_id: int | None = None) -> tuple[str, int | None]:
    pf_profile_service.ensure_personal_profile(db, user)
    if active_profile_id is not None:
        pf_profile_service.assert_profile_access(db, user.id, active_profile_id)
        pid: int | None = active_profile_id
    else:
        pid = profile_repo.first_profile_id_for_user(db, user.id)
    eff = pf_profile_service.resolve_effective_role_name(db, user)
    claims: dict = {'email': user.email, 'role': user.role, 'app_role': eff}
    if pid is not None:
        claims['active_profile_id'] = pid
    token = create_access_token(subject=user.id, extra_claims=claims)
    return token, pid


def bootstrap_new_user(db: Session, user: User) -> None:
    pf_profile_service.sync_legacy_role_to_role_id(db, user)
    pf_profile_service.ensure_personal_profile(db, user)


def register(db: Session, payload: UserCreate) -> User:
    email = payload.email.strip().lower()
    if user_repo.get_by_email(db, email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail='Email already registered',
        )
    role_str = payload.role.strip().upper() or 'USER'
    user = User(
        name=payload.name.strip(),
        email=email,
        password_hash=hash_password(payload.password),
        role=role_str,
        is_active=True,
    )
    user = user_repo.create(db, user=user)
    bootstrap_new_user(db, user)
    return user
