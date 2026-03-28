"""JWT helpers — use with HTTPBearer dependency on protected routers."""

from datetime import UTC, datetime, timedelta
from typing import Any

from jose import JWTError, jwt

from fastapi_service.core.config import get_settings


def create_access_token(subject: str | int, extra_claims: dict[str, Any] | None = None) -> str:
    settings = get_settings()
    now = datetime.now(tz=UTC)
    expire = now + timedelta(minutes=settings.access_token_expire_minutes)
    payload: dict[str, Any] = {
        'sub': str(subject),
        'exp': expire,
        'iat': now,
    }
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
    except JWTError as e:
        raise ValueError('Invalid token') from e
