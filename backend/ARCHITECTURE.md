# Backend architecture (FastAPI ERP)

This service follows a **layered** layout so business rules stay out of routers and SQL stays out of services.

## Layers

```text
API (FastAPI routers)     ← HTTP, validation, status codes
        ↓
Service                   ← rules, orchestration, HTTPException mapping
        ↓
Repository                ← SQLAlchemy queries, pagination
        ↓
Models + PostgreSQL/SQLite
```

## Layout (inside `fastapi_service/`)

| Path | Role |
|------|------|
| `core/config.py` | `pydantic-settings` — `DATABASE_URL`, JWT secrets, Redis URL |
| `core/database.py` | `engine`, `SessionLocal`, `Base`, `get_db` |
| `core/dependencies.py` | Shared `Depends()` (DB session, pagination) |
| `core/security.py` | JWT encode/decode |
| `core/password.py` | bcrypt hashing via **bcrypt** |
| `models.py` | SQLAlchemy ORM (migrate to `models/` package when convenient) |
| `schemas_*.py` / `schemas_farmer.py` | Pydantic request/response DTOs |
| `repositories/` | DB access functions |
| `services/` | Business logic |
| `api/v1/` | Versioned routers — mount at `/api/v1` |
| `routers/` | Legacy feature routers (`/inflow`, etc.) — keep until migrated |

`database.py` at package root **re-exports** `core.database` so existing imports keep working.

## Reference vertical slice: procurement farmers

| Layer | File |
|------|------|
| Model | `models.py` → `ProcurementFarmer` (`procurement_farmers`) |
| Schema | `schemas_farmer.py` |
| Repository | `repositories/farmer_repo.py` |
| Service | `services/farmer_service.py` |
| API | `api/v1/farmers.py` |

**Endpoints:** `GET/POST /api/v1/farmers`, `GET/PUT/DELETE /api/v1/farmers/{id}`  
**Auth:** all farmer routes require **`Authorization: Bearer <JWT>`** (see `api/v1/auth.py`).  
**Pagination:** `skip`, `limit` (default limit 50, max 500). **Total:** response header `X-Total-Count`.

## JWT authentication (implemented)

| Path | Purpose |
|------|---------|
| `POST /api/v1/auth/login` | OAuth2 password form (`username` = email) |
| `POST /api/v1/auth/login/json` | JSON body `{ email, password }` |
| `POST /api/v1/auth/register` | Create user (restrict in production) |
| `GET /api/v1/auth/me` | Current user from Bearer token |

**Dev seed:** `admin@gowthami.local` / `ChangeMe!Admin123` (`seed_auth.py`).

## PostgreSQL blueprint SQL

| File | Purpose |
|------|---------|
| `sql/001_postgres_erp_blueprint.sql` | Full target DDL (users, farmers, milk, tanks, production, customers, dispatch, wallet, expenses, cattle) |
| `sql/002_dashboard_queries.sql` | Example aggregates for executive dashboard |

**Endpoint catalog:** `docs/API_ENDPOINTS.md`.

## Development order (recommended)

1. ~~Auth~~ — JWT login + protected routes pattern in place.  
2. Settings / org.  
3. Farmers & milk collection.  
4. Tanks & inventory transactions.  
5. Customers & subscriptions.  
6. Dispatch & delivery logs.  
7. Wallet & expenses.  
8. Cattle / feed / health.  
9. Dashboard aggregates (materialized or summary tables).

## Performance checklist

- Indexes on foreign keys and filter columns (`date`, `customer_id`, `route_id`, …).  
- **Always** paginate list endpoints.  
- Heavy dashboards: pre-aggregated tables or SQL `SUM`/`COUNT` with narrow date windows.  
- Optional **Redis** for cache (settings `redis_url`) — 5 min dashboard, 1 h reports.  
- Move long tasks to **Celery** when you add PDF/email/webhooks.

## Production configuration

- Set `DATABASE_URL` to PostgreSQL (e.g. `postgresql+psycopg://user:pass@host:5432/db`).  
- Set `SECRET_KEY` for JWT.  
- Run migrations with **Alembic** (add under `backend/alembic/` when schema stabilizes).
