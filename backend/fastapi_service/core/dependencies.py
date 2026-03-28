from collections.abc import Generator
from typing import Annotated, Any

from fastapi import Depends, HTTPException, Query, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session

from fastapi_service.core.database import get_db
from fastapi_service.core.security import decode_access_token
from fastapi_service.models import User
from fastapi_service.models_extended import Profile
from fastapi_service.repositories import profile_repo
from fastapi_service.repositories import user_repo
from fastapi_service.services import pf_profile_service


DbSession = Annotated[Session, Depends(get_db)]

oauth2_scheme = OAuth2PasswordBearer(tokenUrl='/api/v1/auth/login')


def get_token_payload(token: Annotated[str, Depends(oauth2_scheme)]) -> dict[str, Any]:
    try:
        return decode_access_token(token)
    except (ValueError, JWTError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Could not validate credentials',
            headers={'WWW-Authenticate': 'Bearer'},
        )


def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: DbSession,
) -> User:
    try:
        payload = decode_access_token(token)
        uid = int(payload.get('sub', 0))
    except (ValueError, TypeError, JWTError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Could not validate credentials',
            headers={'WWW-Authenticate': 'Bearer'},
        )
    user = user_repo.get_by_id(db, uid)
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='User not found or inactive',
            headers={'WWW-Authenticate': 'Bearer'},
        )
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
TokenPayload = Annotated[dict[str, Any], Depends(get_token_payload)]


def get_active_profile_id(
    payload: TokenPayload,
    user: CurrentUser,
    db: DbSession,
) -> int:
    raw = payload.get('active_profile_id')
    if raw is not None:
        try:
            pid = int(raw)
        except (TypeError, ValueError):
            pid = None
        else:
            pf_profile_service.assert_profile_access(db, user.id, pid)
            return pid
    pf_profile_service.ensure_personal_profile(db, user)
    fallback = profile_repo.first_profile_id_for_user(db, user.id)
    if fallback is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='No profile available for this user',
        )
    return fallback


def get_current_pf_profile(
    user: CurrentUser,
    db: DbSession,
    profile_id: Annotated[int, Depends(get_active_profile_id)],
) -> Profile:
    p = profile_repo.get_profile(db, profile_id)
    if p is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Profile not found')
    return p


ActiveProfileId = Annotated[int, Depends(get_active_profile_id)]
CurrentPfProfile = Annotated[Profile, Depends(get_current_pf_profile)]


class PaginationParams:
    """Standard skip/limit for list endpoints (avoid loading huge tables)."""

    def __init__(
        self,
        skip: int = Query(0, ge=0, le=1_000_000, description='Rows to skip'),
        limit: int = Query(50, ge=1, le=500, description='Max rows to return'),
    ) -> None:
        self.skip = skip
        self.limit = limit


Pagination = Annotated[PaginationParams, Depends()]
