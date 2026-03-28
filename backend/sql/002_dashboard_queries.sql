-- Dashboard-oriented SQL (PostgreSQL) — tune table/column names to match deployed schema.
-- Milk procured today
SELECT COALESCE(SUM(quantity), 0) AS milk_procured_liters
FROM milk_collection
WHERE collection_date = CURRENT_DATE;

-- Planned / recorded dispatch quantity today (delivery schedule)
SELECT COALESCE(SUM(quantity), 0) AS scheduled_delivery_liters
FROM delivery_schedule
WHERE schedule_date = CURRENT_DATE;

-- Revenue proxy: wallet deductions today (adjust ``type`` values to your ledger convention)
SELECT COALESCE(SUM(amount), 0) AS revenue_from_wallet
FROM wallet_ledger
WHERE entry_date = CURRENT_DATE
  AND type = 'DEDUCTION';

-- Expenses today
SELECT COALESCE(SUM(amount), 0) AS expenses_today
FROM expenses
WHERE expense_date = CURRENT_DATE;

-- Simple P&L snapshot today (wallet deductions minus expenses)
SELECT
    COALESCE((
        SELECT SUM(amount) FROM wallet_ledger
        WHERE entry_date = CURRENT_DATE AND type = 'DEDUCTION'
    ), 0)
    -
    COALESCE((
        SELECT SUM(amount) FROM expenses WHERE expense_date = CURRENT_DATE
    ), 0) AS profit_today;

-- Total bulk stock (tanks)
SELECT COALESCE(SUM(current_level), 0) AS total_tank_liters
FROM tanks;

-- Active customers
SELECT COUNT(*) AS active_customers
FROM customers
WHERE status = 'ACTIVE';

-- Farmers supplying today
SELECT COUNT(DISTINCT farmer_id) AS farmers_today
FROM milk_collection
WHERE collection_date = CURRENT_DATE;
