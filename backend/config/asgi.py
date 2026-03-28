"""
ASGI config: Django (default routes) + FastAPI mounted at /fastapi.

Run with uvicorn so both stacks are active, e.g.:
  uvicorn config.asgi:application --reload --host 127.0.0.1 --port 8000

``manage.py runserver`` uses WSGI and does not include the FastAPI mounts.
"""

import os

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

from django.core.asgi import get_asgi_application
from starlette.applications import Starlette
from starlette.routing import Mount

from fastapi_service.main import app as fastapi_application

django_application = get_asgi_application()

application = Starlette(
    routes=[
        Mount('/fastapi', fastapi_application),
        Mount('/', django_application),
    ],
)
