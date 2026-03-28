"""Backward-compatible re-exports — canonical definitions live in ``core.database``."""

from fastapi_service.core.database import Base, SessionLocal, engine, get_db

__all__ = ['Base', 'SessionLocal', 'engine', 'get_db']
