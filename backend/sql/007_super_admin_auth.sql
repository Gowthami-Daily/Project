-- Platform auth: last login, optional audit & module permissions (Postgres).
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS user_permissions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  module_name VARCHAR(64) NOT NULL,
  can_view BOOLEAN NOT NULL DEFAULT TRUE,
  can_edit BOOLEAN NOT NULL DEFAULT TRUE,
  can_delete BOOLEAN NOT NULL DEFAULT FALSE,
  can_export BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT uq_user_permissions_user_module UNIQUE (user_id, module_name)
);

CREATE INDEX IF NOT EXISTS ix_user_permissions_user ON user_permissions (user_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users (id) ON DELETE SET NULL,
  action VARCHAR(64) NOT NULL,
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_audit_logs_created ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS ix_audit_logs_user ON audit_logs (user_id);
