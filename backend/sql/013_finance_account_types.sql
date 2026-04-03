-- Phase A: canonical finance account types + NW / liquid flags
-- Run on PostgreSQL after prior migrations.

ALTER TABLE finance_accounts
  ADD COLUMN IF NOT EXISTS include_in_networth BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE finance_accounts
  ADD COLUMN IF NOT EXISTS include_in_liquid BOOLEAN NOT NULL DEFAULT TRUE;

-- Normalize legacy free-text types to canonical set
UPDATE finance_accounts
SET account_type = CASE
  WHEN lower(trim(account_type)) IN (
    'savings', 'saving', 'current', 'checking', 'bank', 'other', 'salary'
  ) THEN 'BANK'
  WHEN lower(trim(account_type)) IN ('cash', 'petty', 'hand') THEN 'CASH'
  WHEN lower(trim(account_type)) IN ('wallet') THEN 'WALLET'
  WHEN lower(trim(account_type)) IN ('credit_card', 'cc', 'card') THEN 'CREDIT_CARD'
  WHEN lower(trim(account_type)) IN ('loan_given', 'loangiven', 'loan lent') THEN 'LOAN_GIVEN'
  WHEN lower(trim(account_type)) IN ('loan_taken', 'loantaken', 'loan taken') THEN 'LOAN_TAKEN'
  WHEN lower(trim(account_type)) IN ('investment', 'investments', 'mf', 'equity') THEN 'INVESTMENT'
  WHEN lower(trim(account_type)) IN ('asset', 'assets') THEN 'ASSET'
  ELSE account_type
END;

-- Anything still not in the allowed set becomes BANK (safe default)
UPDATE finance_accounts
SET account_type = 'BANK'
WHERE upper(trim(account_type)) NOT IN (
  'BANK',
  'CASH',
  'WALLET',
  'CREDIT_CARD',
  'LOAN_GIVEN',
  'LOAN_TAKEN',
  'INVESTMENT',
  'ASSET'
);
