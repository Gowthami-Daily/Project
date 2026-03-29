@echo off
cd /d "%~dp0"
rem FastAPI only (same URLs as Render: /api/v1, /inflow, /hello, …)
rem For Django+FastAPI on one port (API under /fastapi/...), use: run_asgi_combined.bat
".venv\Scripts\python.exe" -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
