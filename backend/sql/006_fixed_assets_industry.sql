-- Fixed assets: purchase/depreciation, location, linked borrowing (liability).
-- Run after finance_liabilities exists (for FK).

CREATE TABLE IF NOT EXISTS finance_assets (
  id SERIAL PRIMARY KEY,
  profile_id INTEGER NOT NULL REFERENCES profiles (id),
  asset_name VARCHAR(200) NOT NULL,
  asset_type VARCHAR(80) NOT NULL,
  value NUMERIC(14, 2) NOT NULL DEFAULT 0
);

ALTER TABLE finance_assets ADD COLUMN IF NOT EXISTS purchase_value NUMERIC(14, 2);
ALTER TABLE finance_assets ADD COLUMN IF NOT EXISTS current_value NUMERIC(14, 2);
ALTER TABLE finance_assets ADD COLUMN IF NOT EXISTS purchase_date DATE;
ALTER TABLE finance_assets ADD COLUMN IF NOT EXISTS depreciation_rate NUMERIC(8, 4);
ALTER TABLE finance_assets ADD COLUMN IF NOT EXISTS location VARCHAR(200);
ALTER TABLE finance_assets ADD COLUMN IF NOT EXISTS linked_liability_id INTEGER REFERENCES finance_liabilities (id) ON DELETE SET NULL;
ALTER TABLE finance_assets ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE finance_assets ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE finance_assets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'finance_assets'
      AND column_name = 'value'
  ) THEN
    UPDATE finance_assets
    SET
      purchase_value = COALESCE(purchase_value, value),
      current_value = COALESCE(current_value, value)
    WHERE purchase_value IS NULL OR current_value IS NULL;
    ALTER TABLE finance_assets DROP COLUMN value;
  END IF;
END $$;

UPDATE finance_assets
SET purchase_value = COALESCE(purchase_value, 0),
    current_value = COALESCE(current_value, 0)
WHERE purchase_value IS NULL OR current_value IS NULL;

ALTER TABLE finance_assets ALTER COLUMN purchase_value SET DEFAULT 0;
ALTER TABLE finance_assets ALTER COLUMN current_value SET DEFAULT 0;
ALTER TABLE finance_assets ALTER COLUMN purchase_value SET NOT NULL;
ALTER TABLE finance_assets ALTER COLUMN current_value SET NOT NULL;

CREATE INDEX IF NOT EXISTS ix_finance_assets_profile_type ON finance_assets (profile_id, asset_type);
CREATE INDEX IF NOT EXISTS ix_finance_assets_linked_liability ON finance_assets (linked_liability_id);
