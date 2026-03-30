-- Account transfers + ledger (Postgres). SQLAlchemy create_all also creates these; use for manual DBA review.
CREATE TABLE IF NOT EXISTS account_transfers (
  id SERIAL PRIMARY KEY,
  profile_id INTEGER NOT NULL REFERENCES profiles (id),
  from_account_id INTEGER NOT NULL REFERENCES finance_accounts (id),
  to_account_id INTEGER NOT NULL REFERENCES finance_accounts (id),
  amount NUMERIC(14, 2) NOT NULL,
  transfer_date DATE NOT NULL,
  transfer_method VARCHAR(40) NOT NULL DEFAULT 'INTERNAL',
  reference_number VARCHAR(128),
  notes TEXT,
  attachment_url TEXT,
  created_by INTEGER REFERENCES users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_account_transfers_profile ON account_transfers (profile_id);
CREATE INDEX IF NOT EXISTS ix_account_transfers_date ON account_transfers (transfer_date DESC);

CREATE TABLE IF NOT EXISTS account_transactions (
  id SERIAL PRIMARY KEY,
  profile_id INTEGER NOT NULL REFERENCES profiles (id),
  account_id INTEGER NOT NULL REFERENCES finance_accounts (id),
  transaction_type VARCHAR(24) NOT NULL,
  amount NUMERIC(14, 2) NOT NULL,
  transfer_id INTEGER REFERENCES account_transfers (id) ON DELETE SET NULL,
  entry_date DATE NOT NULL,
  reference_number VARCHAR(128),
  notes TEXT,
  created_by INTEGER REFERENCES users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_account_tx_profile_account ON account_transactions (profile_id, account_id);
CREATE INDEX IF NOT EXISTS ix_account_tx_entry_date ON account_transactions (entry_date DESC);
