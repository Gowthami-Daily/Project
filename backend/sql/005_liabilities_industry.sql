-- Industry-level liabilities: total vs outstanding, dues, lender, payment ledger.
-- Safe to re-run: uses IF NOT EXISTS / conditional copy from legacy ``amount``.

ALTER TABLE finance_liabilities ADD COLUMN IF NOT EXISTS total_amount NUMERIC(14, 2);
ALTER TABLE finance_liabilities ADD COLUMN IF NOT EXISTS outstanding_amount NUMERIC(14, 2);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'finance_liabilities' AND column_name = 'amount'
  ) THEN
    UPDATE finance_liabilities SET total_amount = COALESCE(total_amount, amount) WHERE total_amount IS NULL;
    UPDATE finance_liabilities SET outstanding_amount = COALESCE(outstanding_amount, amount) WHERE outstanding_amount IS NULL;
    ALTER TABLE finance_liabilities DROP COLUMN amount;
  END IF;
END $$;

UPDATE finance_liabilities SET total_amount = 0 WHERE total_amount IS NULL;
UPDATE finance_liabilities SET outstanding_amount = 0 WHERE outstanding_amount IS NULL;
ALTER TABLE finance_liabilities ALTER COLUMN total_amount SET DEFAULT 0;
ALTER TABLE finance_liabilities ALTER COLUMN outstanding_amount SET DEFAULT 0;
ALTER TABLE finance_liabilities ALTER COLUMN total_amount SET NOT NULL;
ALTER TABLE finance_liabilities ALTER COLUMN outstanding_amount SET NOT NULL;

ALTER TABLE finance_liabilities ADD COLUMN IF NOT EXISTS minimum_due NUMERIC(14, 2);
ALTER TABLE finance_liabilities ADD COLUMN IF NOT EXISTS billing_cycle_day INTEGER;
ALTER TABLE finance_liabilities ADD COLUMN IF NOT EXISTS lender_name VARCHAR(200);
ALTER TABLE finance_liabilities ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE finance_liabilities ADD COLUMN IF NOT EXISTS installment_amount NUMERIC(14, 2);
ALTER TABLE finance_liabilities ADD COLUMN IF NOT EXISTS status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE finance_liabilities ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE finance_liabilities ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS liability_payments (
  id SERIAL PRIMARY KEY,
  liability_id INTEGER NOT NULL REFERENCES finance_liabilities (id) ON DELETE CASCADE,
  payment_date DATE NOT NULL,
  amount_paid NUMERIC(14, 2) NOT NULL,
  interest_paid NUMERIC(14, 2) NOT NULL DEFAULT 0,
  payment_mode VARCHAR(16) NOT NULL DEFAULT 'CASH',
  finance_account_id INTEGER REFERENCES finance_accounts (id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_liability_payments_liability_id ON liability_payments (liability_id);
CREATE INDEX IF NOT EXISTS ix_liability_payments_payment_date ON liability_payments (payment_date);
