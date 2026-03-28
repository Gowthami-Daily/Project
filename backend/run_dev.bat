@echo off
cd /d "%~dp0"
".venv\Scripts\python.exe" -m uvicorn config.asgi:application --reload --host 127.0.0.1 --port 8000
