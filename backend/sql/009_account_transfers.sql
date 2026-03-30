-- Money movements (internal + external) + per-account ledger (Postgres reference).
CREATE TABLE IF NOT EXISTS account_movements (
  id SERIAL PRIMARY KEY,
  profile_id INTEGER NOT NULL REFERENCES profiles (id),
  movement_type VARCHAR(32) NOT NULL,
  from_account_id INTEGER REFERENCES finance_accounts (id),
  to_account_id INTEGER REFERENCES finance_accounts (id),
  liability_id INTEGER REFERENCES finance_liabilities (id),
  loan_id INTEGER REFERENCES loans (id),
  credit_card_id INTEGER REFERENCES credit_cards (id),
  credit_card_bill_id INTEGER REFERENCES credit_card_bills (id),
  amount NUMERIC(14, 2) NOT NULL,
  movement_date DATE NOT NULL,
  reference_number VARCHAR(128),
  notes TEXT,
  external_counterparty VARCHAR(120),
  attachment_url TEXT,
  created_by INTEGER REFERENCES users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_account_movements_profile ON account_movements (profile_id);
CREATE INDEX IF NOT EXISTS ix_account_movements_date ON account_movements (movement_date DESC);
CREATE INDEX IF NOT EXISTS ix_account_movements_type ON account_movements (movement_type);

CREATE TABLE IF NOT EXISTS account_transactions (
  id SERIAL PRIMARY KEY,
  profile_id INTEGER NOT NULL REFERENCES profiles (id),
  account_id INTEGER NOT NULL REFERENCES finance_accounts (id),
  transaction_type VARCHAR(40) NOT NULL,
  amount NUMERIC(14, 2) NOT NULL,
  movement_id INTEGER REFERENCES account_movements (id) ON DELETE SET NULL,
  entry_date DATE NOT NULL,
  reference_number VARCHAR(128),
  notes TEXT,
  created_by INTEGER REFERENCES users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_account_tx_profile_account ON account_transactions (profile_id, account_id);
CREATE INDEX IF NOT EXISTS ix_account_tx_entry_date ON account_transactions (entry_date DESC);
