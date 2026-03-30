-- Liability EMI schedule (flat / reducing balance) and extra liability fields.

CREATE TABLE IF NOT EXISTS liability_schedule (
    id SERIAL PRIMARY KEY,
    liability_id INTEGER NOT NULL REFERENCES finance_liabilities(id) ON DELETE CASCADE,
    emi_number INTEGER NOT NULL,
    due_date DATE NOT NULL,
    emi_amount NUMERIC(14, 2) NOT NULL,
    principal_amount NUMERIC(14, 2) NOT NULL,
    interest_amount NUMERIC(14, 2) NOT NULL,
    remaining_balance NUMERIC(14, 2) NOT NULL,
    payment_status VARCHAR(20) NOT NULL DEFAULT 'Pending',
    payment_date DATE,
    amount_paid NUMERIC(14, 2),
    finance_account_id INTEGER REFERENCES finance_accounts(id),
    credit_as_cash BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS ix_liability_schedule_liability_id ON liability_schedule(liability_id);
CREATE INDEX IF NOT EXISTS ix_liability_schedule_due_date ON liability_schedule(due_date);

ALTER TABLE finance_liabilities
  ADD COLUMN IF NOT EXISTS emi_interest_method VARCHAR(24) NOT NULL DEFAULT 'FLAT';

ALTER TABLE finance_liabilities
  ADD COLUMN IF NOT EXISTS interest_free_days INTEGER;

ALTER TABLE finance_liabilities
  ADD COLUMN IF NOT EXISTS term_months INTEGER;

ALTER TABLE finance_liabilities
  ADD COLUMN IF NOT EXISTS emi_schedule_start_date DATE;

