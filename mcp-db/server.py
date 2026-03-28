"""
MCP server: read-only SQL access to the same database as the FastAPI backend.

Resolves DATABASE_URL like backend/fastapi_service/core/config.py:
- If DATABASE_URL is unset, uses backend/gowthami_inflow.db (SQLite).
- postgresql:// is rewritten to postgresql+psycopg:// for SQLAlchemy.

Cursor: add an MCP server (Settings → MCP) pointing at this script with a venv
that has requirements.txt installed, or use `uv run` (see cursor-mcp-config.example.json).
"""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

from dotenv import load_dotenv
from mcp.server.fastmcp import FastMCP
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import Engine

# Project layout: <repo>/mcp-db/server.py → repo root is parent.parent
_REPO_ROOT = Path(__file__).resolve().parent.parent
_BACKEND_DIR = _REPO_ROOT / "backend"


def _default_sqlite_url() -> str:
    db_path = _BACKEND_DIR / "gowthami_inflow.db"
    return f"sqlite:///{db_path}"


def _normalize_database_url(url: str) -> str:
    u = url.strip()
    if u.startswith("postgres://"):
        u = "postgresql://" + u[len("postgres://") :]
    if u.startswith("postgresql://"):
        return "postgresql+psycopg://" + u[len("postgresql://") :]
    return u


def _get_database_url() -> str:
    load_dotenv(_BACKEND_DIR / ".env")
    raw = os.environ.get("DATABASE_URL", "").strip()
    if not raw:
        return _default_sqlite_url()
    return _normalize_database_url(raw)


def _engine() -> Engine:
    return create_engine(_get_database_url(), pool_pre_ping=True)


def _first_sql_token(sql: str) -> str | None:
    m = re.match(r"^\s*(\w+)", sql, re.IGNORECASE)
    return m.group(1).lower() if m else None


def _is_read_only_sql(sql: str) -> bool:
    s = sql.strip()
    if not s:
        return False
    parts = [p.strip() for p in s.split(";") if p.strip()]
    if len(parts) != 1:
        return False
    tok = _first_sql_token(parts[0])
    return tok in ("select", "with", "explain")


mcp = FastMCP(
    "Gowthami DB",
    instructions=(
        "Read-only access to the app database. Use db_list_tables and db_table_schema "
        "before writing SQL. Only SELECT / WITH / EXPLAIN queries are allowed."
    ),
)


@mcp.tool()
def db_list_tables(schema: str | None = None) -> str:
    """List all table names. For PostgreSQL, pass schema (default: public) when not using public."""
    eng = _engine()
    insp = inspect(eng)
    dialect = eng.dialect.name
    if dialect == "postgresql":
        sch = schema or "public"
        names = insp.get_table_names(schema=sch)
        return json.dumps({"dialect": dialect, "schema": sch, "tables": sorted(names)}, indent=2)
    names = insp.get_table_names()
    return json.dumps({"dialect": dialect, "tables": sorted(names)}, indent=2)


@mcp.tool()
def db_table_schema(table_name: str, schema: str | None = None) -> str:
    """Return column names and types for one table."""
    eng = _engine()
    insp = inspect(eng)
    dialect = eng.dialect.name
    kwargs: dict = {}
    if dialect == "postgresql":
        kwargs["schema"] = schema or "public"
    try:
        cols = insp.get_columns(table_name, **kwargs)
    except Exception as e:
        return json.dumps({"error": str(e), "table": table_name})
    slim = [
        {"name": c["name"], "type": str(c["type"]), "nullable": c.get("nullable", True)}
        for c in cols
    ]
    return json.dumps({"table": table_name, "columns": slim}, indent=2)


@mcp.tool()
def db_query(sql: str) -> str:
    """Run a single read-only SQL statement (SELECT, WITH, or EXPLAIN). Returns JSON rows (max 500)."""
    if not _is_read_only_sql(sql):
        return json.dumps(
            {
                "error": "Only a single SELECT, WITH, or EXPLAIN statement is allowed.",
                "hint": "Use db_list_tables / db_table_schema for metadata.",
            }
        )
    eng = _engine()
    stmt = text(sql.strip().rstrip(";"))
    max_rows = 500
    with eng.connect() as conn:
        result = conn.execute(stmt)
        keys = list(result.keys())
        rows = [dict(zip(keys, row)) for row in result.fetchmany(max_rows + 1)]
    truncated = len(rows) > max_rows
    if truncated:
        rows = rows[:max_rows]
    # JSON-serialize values (dates, decimals)
    def default(o):
        if hasattr(o, "isoformat"):
            return o.isoformat()
        return str(o)

    return json.dumps(
        {"rows": rows, "row_count": len(rows), "truncated": truncated},
        indent=2,
        default=default,
    )


def main() -> None:
    # Helpful stderr if backend folder is missing in a wrong checkout layout
    if not _BACKEND_DIR.is_dir():
        print(f"Warning: expected backend at {_BACKEND_DIR}", file=sys.stderr)
    mcp.run()


if __name__ == "__main__":
    main()
