-- Credit cards: profile-scoped cards, statement bills, swipe ledger, bank payments.
-- Bills must be created before transactions (FK bill_id).

CREATE TABLE IF NOT EXISTS credit_cards (
    id SERIAL PRIMARY KEY,
    profile_id INTEGER NOT NULL REFERENCES profiles (id),
    card_name VARCHAR(100) NOT NULL,
    bank_name VARCHAR(100),
    card_limit NUMERIC(14, 2) NOT NULL DEFAULT 0,
    billing_cycle_start INT NOT NULL DEFAULT 1,
    billing_cycle_end INT,
    due_days INT NOT NULL DEFAULT 15,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_credit_cards_profile_id ON credit_cards (profile_id);

CREATE TABLE IF NOT EXISTS credit_card_bills (
    id SERIAL PRIMARY KEY,
    card_id INTEGER NOT NULL REFERENCES credit_cards (id) ON DELETE CASCADE,
    bill_start_date DATE NOT NULL,
    bill_end_date DATE NOT NULL,
    total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
    due_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    liability_id INTEGER REFERENCES finance_liabilities (id) ON DELETE SET NULL,
    amount_paid NUMERIC(14, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_cc_bills_card_id ON credit_card_bills (card_id);

CREATE TABLE IF NOT EXISTS credit_card_transactions (
    id SERIAL PRIMARY KEY,
    card_id INTEGER NOT NULL REFERENCES credit_cards (id) ON DELETE CASCADE,
    amount NUMERIC(14, 2) NOT NULL,
    transaction_date DATE NOT NULL,
    category_id INTEGER REFERENCES pf_expense_categories (id),
    description TEXT,
    expense_id INTEGER REFERENCES finance_expenses (id) ON DELETE SET NULL,
    bill_id INTEGER REFERENCES credit_card_bills (id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_cc_tx_card_id ON credit_card_transactions (card_id);
CREATE INDEX IF NOT EXISTS ix_cc_tx_bill_id ON credit_card_transactions (bill_id);
CREATE INDEX IF NOT EXISTS ix_cc_tx_expense_id ON credit_card_transactions (expense_id);

CREATE TABLE IF NOT EXISTS credit_card_payments (
    id SERIAL PRIMARY KEY,
    card_id INTEGER NOT NULL REFERENCES credit_cards (id) ON DELETE CASCADE,
    bill_id INTEGER NOT NULL REFERENCES credit_card_bills (id) ON DELETE CASCADE,
    amount NUMERIC(14, 2) NOT NULL,
    payment_date DATE NOT NULL,
    from_account_id INTEGER NOT NULL REFERENCES finance_accounts (id),
    reference_number VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_cc_pay_bill ON credit_card_payments (bill_id);

-- Addendum: columns added after initial deploy (idempotent on PostgreSQL)
ALTER TABLE credit_cards ADD COLUMN IF NOT EXISTS closing_day INT;
ALTER TABLE credit_cards ADD COLUMN IF NOT EXISTS due_day INT;
ALTER TABLE credit_card_bills ADD COLUMN IF NOT EXISTS minimum_due NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE credit_card_bills ADD COLUMN IF NOT EXISTS interest NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE credit_card_bills ADD COLUMN IF NOT EXISTS late_fee NUMERIC(12, 2) NOT NULL DEFAULT 0;
