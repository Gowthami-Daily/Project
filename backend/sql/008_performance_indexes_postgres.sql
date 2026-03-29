-- Extra PostgreSQL indexes (run after SQLAlchemy create_all / init_db).
-- Idempotent: CREATE INDEX IF NOT EXISTS.
--
-- What is already covered by ORM index=True / unique constraints (not repeated here):
--   sql/005: liability_payments (liability_id, payment_date)
--   sql/006: finance_assets.linked_liability_id
--   sql/007: user_permissions (user_id), audit_logs (user_id, created_at ASC)
--
-- sql/001 is a legacy ERP blueprint; do not run wholesale against this codebase.
-- sql/002–004 are query snippets / one-off alters, not index bootstrap.

-- sql/006: composite filters (profile + asset type)
CREATE INDEX IF NOT EXISTS ix_finance_assets_profile_type ON finance_assets (profile_id, asset_type);

-- Foreign keys without index=True on the child column (join / filter performance)
CREATE INDEX IF NOT EXISTS ix_subscriptions_customer_id ON subscriptions (customer_id);
CREATE INDEX IF NOT EXISTS ix_customer_wallet_topups_customer_id ON customer_wallet_topups (customer_id);
CREATE INDEX IF NOT EXISTS ix_customer_messages_customer_id ON customer_messages (customer_id);
CREATE INDEX IF NOT EXISTS ix_micro_orders_customer_id ON micro_orders (customer_id);

-- Upcoming EMI-style queries: filter by loan + due window
CREATE INDEX IF NOT EXISTS ix_loan_schedule_loan_due ON loan_schedule (loan_id, due_date);
