-- Personal finance: investments — add name/notes/timestamps, rename date column, drop current_value.
-- Run once against an existing database that already has finance_investments (legacy shape).

ALTER TABLE finance_investments
  ADD COLUMN IF NOT EXISTS name VARCHAR(200) NOT NULL DEFAULT '';

ALTER TABLE finance_investments
  ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE finance_investments
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE finance_investments
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'finance_investments'
      AND column_name = 'as_of_date'
  ) THEN
    ALTER TABLE finance_investments RENAME COLUMN as_of_date TO investment_date;
  END IF;
END $$;

ALTER TABLE finance_investments DROP COLUMN IF EXISTS current_value;
