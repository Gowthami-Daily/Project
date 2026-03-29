"""
ASGI entry shim for platforms that expect ``main:app`` (e.g. Render default).

The full FastAPI application is defined in ``fastapi_service.main``.
"""

from fastapi_service.main import app

__all__ = ['app']
