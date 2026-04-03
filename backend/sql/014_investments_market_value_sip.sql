-- Optional mark-to-market value and recurring SIP hint per holding (Personal Finance).

ALTER TABLE finance_investments
  ADD COLUMN IF NOT EXISTS current_value NUMERIC(14, 2) NULL;

ALTER TABLE finance_investments
  ADD COLUMN IF NOT EXISTS sip_monthly_amount NUMERIC(14, 2) NULL;

COMMENT ON COLUMN finance_investments.current_value IS 'Manual NAV / market value; NULL means treat as invested_amount for display.';
COMMENT ON COLUMN finance_investments.sip_monthly_amount IS 'Optional recurring monthly contribution for this line (informational).';
