@echo off
cd /d "%~dp0"
rem Django (/admin, /api/hello/) + FastAPI mounted at /fastapi (e.g. /fastapi/api/v1/...)
rem Vite default proxy expects FastAPI at root — use run_dev.bat for normal frontend dev.
".venv\Scripts\python.exe" -m uvicorn config.asgi:application --reload --host 127.0.0.1 --port 8000
