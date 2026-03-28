"""Best-effort SQLite column adds for dev DBs (``create_all`` does not alter existing tables)."""

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine


def ensure_users_role_id_column(engine: Engine) -> None:
    if not str(engine.url).startswith('sqlite'):
        return
    insp = inspect(engine)
    cols = {c['name'] for c in insp.get_columns('users')}
    if 'role_id' in cols:
        return
    with engine.begin() as conn:
        conn.execute(text('ALTER TABLE users ADD COLUMN role_id INTEGER'))
