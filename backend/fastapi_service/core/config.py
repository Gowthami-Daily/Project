from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


def _default_sqlite_url() -> str:
    backend_dir = Path(__file__).resolve().parent.parent.parent
    db_path = backend_dir / 'gowthami_inflow.db'
    return f'sqlite:///{db_path}'


def _normalize_database_url(url: str) -> str:
    """
    Render/Heroku supply ``postgresql://...``. SQLAlchemy + psycopg v3 expects
    ``postgresql+psycopg://...``. Legacy ``postgres://`` is normalized too.
    """
    u = url.strip()
    if u.startswith('postgres://'):
        u = 'postgresql://' + u[len('postgres://') :]
    if u.startswith('postgresql://'):
        return 'postgresql+psycopg://' + u[len('postgresql://') :]
    return u


class Settings(BaseSettings):
    """Application settings — override via environment or `.env` in `backend/`."""

    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).resolve().parent.parent.parent / '.env'),
        env_file_encoding='utf-8',
        extra='ignore',
    )

    app_name: str = 'Gowthami Daily API'
    debug: bool = False

    # DB: unset = SQLite file in backend/. Env: DATABASE_URL (Render External/Internal URL).
    database_url: str | None = None

    # JWT (wire routes under /api/v1/auth when ready)
    secret_key: str = 'change-me-in-production-use-openssl-rand-hex-32'
    jwt_algorithm: str = 'HS256'
    access_token_expire_minutes: int = 60 * 24

    # Redis cache URL (optional — services can no-op if missing)
    redis_url: str | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()


def get_database_url() -> str:
    s = get_settings()
    if not s.database_url:
        return _default_sqlite_url()
    return _normalize_database_url(s.database_url)
