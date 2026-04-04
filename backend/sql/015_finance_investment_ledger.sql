-- Investment ledger: per-holding transactions (SIP, lump sum, top-up, withdraw, dividend, interest).
-- Run after 014_investments_market_value_sip.sql

CREATE TABLE IF NOT EXISTS finance_investment_transactions (
  id SERIAL PRIMARY KEY,
  investment_id INTEGER NOT NULL REFERENCES finance_investments(id) ON DELETE CASCADE,
  txn_date DATE NOT NULL,
  txn_type VARCHAR(32) NOT NULL,
  amount NUMERIC(14, 2) NOT NULL,
  units NUMERIC(18, 6) NULL,
  nav NUMERIC(18, 6) NULL,
  total_value NUMERIC(14, 2) NULL,
  notes TEXT NULL,
  attachment_url TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fin_inv_txn_investment ON finance_investment_transactions(investment_id);
CREATE INDEX IF NOT EXISTS idx_fin_inv_txn_date ON finance_investment_transactions(txn_date);

ALTER TABLE finance_investments
  ADD COLUMN IF NOT EXISTS sip_start_date DATE NULL,
  ADD COLUMN IF NOT EXISTS sip_day_of_month INT NULL,
  ADD COLUMN IF NOT EXISTS sip_frequency VARCHAR(24) NOT NULL DEFAULT 'MONTHLY',
  ADD COLUMN IF NOT EXISTS sip_auto_create BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_transaction_date DATE NULL,
  ADD COLUMN IF NOT EXISTS units_held NUMERIC(18, 6) NULL;

COMMENT ON TABLE finance_investment_transactions IS 'Ledger rows for an investment holding; drives statement and aggregates.';
COMMENT ON COLUMN finance_investment_transactions.amount IS 'Positive for buys/dividend/interest; negative for withdrawals/redemptions.';
COMMENT ON COLUMN finance_investment_transactions.total_value IS 'Optional portfolio value after this row (mark-to-market).';

-- One opening row per existing holding (idempotent)
INSERT INTO finance_investment_transactions (investment_id, txn_date, txn_type, amount, units, nav, total_value, notes)
SELECT
  fi.id,
  fi.investment_date,
  'lumpsum',
  fi.invested_amount,
  NULL,
  NULL,
  COALESCE(fi.current_value, fi.invested_amount),
  'Opening balance (imported)'
FROM finance_investments fi
WHERE NOT EXISTS (
  SELECT 1 FROM finance_investment_transactions x WHERE x.investment_id = fi.id
);

UPDATE finance_investments inv
SET last_transaction_date = sub.mx
FROM (
  SELECT investment_id, MAX(txn_date) AS mx
  FROM finance_investment_transactions
  GROUP BY investment_id
) sub
WHERE inv.id = sub.investment_id;
