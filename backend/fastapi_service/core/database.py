from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from fastapi_service.core.config import get_database_url


def _engine_kwargs(url: str) -> dict:
    if url.startswith('sqlite'):
        return {'connect_args': {'check_same_thread': False}}
    # PostgreSQL (Render, etc.): avoid stale connections after idle timeouts
    return {'pool_pre_ping': True}


SQLALCHEMY_DATABASE_URL = get_database_url()

engine = create_engine(SQLALCHEMY_DATABASE_URL, **_engine_kwargs(SQLALCHEMY_DATABASE_URL))

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
