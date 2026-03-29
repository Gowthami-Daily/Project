from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordRequestForm

from fastapi_service.core.dependencies import CurrentUser, DbSession
from fastapi_service.schemas_auth import LoginRequest, TokenResponse, UserPublic
from fastapi_service.services import auth_service

router = APIRouter(prefix='/auth', tags=['auth'])


@router.post('/login', response_model=TokenResponse)
def login(
    db: DbSession,
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
) -> TokenResponse:
    """OAuth2 password flow: **username** = email, **password** = password."""
    user = auth_service.authenticate(db, form_data.username, form_data.password)
    auth_service.finalize_successful_login(db, user)
    token, pid = auth_service.issue_token(db, user)
    return TokenResponse(access_token=token, active_profile_id=pid)


@router.post('/login/json', response_model=TokenResponse)
def login_json(db: DbSession, body: LoginRequest) -> TokenResponse:
    """JSON login for SPA/mobile clients."""
    user = auth_service.authenticate(db, body.email, body.password)
    auth_service.finalize_successful_login(db, user)
    token, pid = auth_service.issue_token(db, user)
    return TokenResponse(access_token=token, active_profile_id=pid)


@router.get('/me', response_model=UserPublic)
def me(user: CurrentUser) -> UserPublic:
    return user
