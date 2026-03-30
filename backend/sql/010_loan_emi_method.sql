-- Loan EMI: interest calculation method (flat vs reducing balance) and settlement direction.

ALTER TABLE loans
  ADD COLUMN IF NOT EXISTS emi_interest_method VARCHAR(24) NOT NULL DEFAULT 'FLAT';

ALTER TABLE loans
  ADD COLUMN IF NOT EXISTS emi_settlement VARCHAR(24) NOT NULL DEFAULT 'RECEIPT';

COMMENT ON COLUMN loans.emi_interest_method IS 'FLAT = flat total interest; REDUCING_BALANCE = monthly amortization';
COMMENT ON COLUMN loans.emi_settlement IS 'RECEIPT = repayment in (credits bank); PAYMENT = EMI paid out (expense + debit)';

