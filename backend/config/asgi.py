"""
ASGI config: Django at ``/`` + FastAPI mounted at ``/fastapi``.

- API paths become ``/fastapi/api/v1/...``, ``/fastapi/inflow/...``, etc.
- For the same URLs as production (no ``/fastapi`` prefix), run::

    uvicorn main:app --reload --host 127.0.0.1 --port 8000

  See ``run_dev.bat`` (FastAPI only) vs ``run_asgi_combined.bat`` (this file).

``manage.py runserver`` uses WSGI and does not include these mounts.
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
