-- Loans: loan_type, borrower contact, notes (industry loan tracker fields).

ALTER TABLE loans
  ADD COLUMN IF NOT EXISTS loan_type VARCHAR(24) NOT NULL DEFAULT 'EMI';

ALTER TABLE loans
  ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE loans
  ADD COLUMN IF NOT EXISTS borrower_phone VARCHAR(40);

ALTER TABLE loans
  ADD COLUMN IF NOT EXISTS borrower_address VARCHAR(500);

-- Backfill loan_type from existing data shape
UPDATE loans l
SET loan_type = 'EMI'
WHERE EXISTS (SELECT 1 FROM loan_schedule s WHERE s.loan_id = l.id);

UPDATE loans l
SET loan_type = 'INTEREST_FREE'
WHERE loan_type = 'EMI'
  AND NOT EXISTS (SELECT 1 FROM loan_schedule s WHERE s.loan_id = l.id)
  AND COALESCE(l.interest_rate, 0) = 0;

UPDATE loans l
SET loan_type = 'SIMPLE_INTEREST'
WHERE loan_type = 'EMI'
  AND NOT EXISTS (SELECT 1 FROM loan_schedule s WHERE s.loan_id = l.id)
  AND COALESCE(l.interest_rate, 0) > 0;
