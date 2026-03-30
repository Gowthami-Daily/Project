"""Best-effort SQLite column adds for dev DBs (``create_all`` does not alter existing tables)."""

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine


def ensure_users_role_id_column(engine: Engine) -> None:
    if not str(engine.url).startswith('sqlite'):
        return
    insp = inspect(engine)
    cols = {c['name'] for c in insp.get_columns('users')}
    if 'role_id' in cols:
        return
    with engine.begin() as conn:
        conn.execute(text('ALTER TABLE users ADD COLUMN role_id INTEGER'))


def ensure_users_last_login_column(engine: Engine) -> None:
    dialect = engine.dialect.name
    if dialect not in ('sqlite', 'postgresql'):
        return
    insp = inspect(engine)
    if 'users' not in insp.get_table_names():
        return
    cols = {c['name'] for c in insp.get_columns('users')}
    if 'last_login' in cols:
        return
    type_sql = 'TIMESTAMPTZ' if dialect == 'postgresql' else 'TIMESTAMP'
    with engine.begin() as conn:
        conn.execute(text(f'ALTER TABLE users ADD COLUMN last_login {type_sql}'))


def _pf_loan_extension_column_defs(dialect_name: str) -> list[tuple[str, str]]:
    """SQL types for new nullable columns on ``loans`` (must match ``models_extended.Loan``)."""
    if dialect_name == 'postgresql':
        return [
            ('term_months', 'INTEGER'),
            ('commission_percent', 'NUMERIC(6,3)'),
            ('commission_amount', 'NUMERIC(14,2)'),
            ('total_interest', 'NUMERIC(14,2)'),
            ('total_amount', 'NUMERIC(14,2)'),
            ('emi_amount', 'NUMERIC(14,2)'),
            ('remaining_amount', 'NUMERIC(14,2)'),
        ]
    return [
        ('term_months', 'INTEGER'),
        ('commission_percent', 'REAL'),
        ('commission_amount', 'REAL'),
        ('total_interest', 'REAL'),
        ('total_amount', 'REAL'),
        ('emi_amount', 'REAL'),
        ('remaining_amount', 'REAL'),
    ]


def ensure_pf_loan_extension_columns(engine: Engine) -> None:
    """Add nullable loan columns for EMI schedules (SQLite + PostgreSQL; ``create_all`` does not alter tables)."""
    dialect = engine.dialect.name
    if dialect not in ('sqlite', 'postgresql'):
        return
    insp = inspect(engine)
    if not insp.has_table('loans'):
        return
    cols = {c['name'] for c in insp.get_columns('loans')}
    alters = _pf_loan_extension_column_defs(dialect)
    with engine.begin() as conn:
        for name, typ in alters:
            if name not in cols:
                conn.execute(text(f'ALTER TABLE loans ADD COLUMN {name} {typ}'))


def ensure_loan_bank_account_columns(engine: Engine) -> None:
    """Add ``finance_account_id`` to EMI schedule and payment rows (SQLite + PostgreSQL)."""
    dialect = engine.dialect.name
    if dialect not in ('sqlite', 'postgresql'):
        return
    insp = inspect(engine)
    tables = ('loan_schedule', 'loan_payments')
    to_alter: list[str] = []
    for table in tables:
        if not insp.has_table(table):
            continue
        cols = {c['name'] for c in insp.get_columns(table)}
        if 'finance_account_id' not in cols:
            to_alter.append(table)
    if not to_alter:
        return
    with engine.begin() as conn:
        for table in to_alter:
            conn.execute(text(f'ALTER TABLE {table} ADD COLUMN finance_account_id INTEGER'))


def ensure_loan_credit_as_cash_columns(engine: Engine) -> None:
    """Add ``credit_as_cash`` to EMI schedule and payment rows (SQLite + PostgreSQL)."""
    dialect = engine.dialect.name
    if dialect not in ('sqlite', 'postgresql'):
        return
    insp = inspect(engine)
    typ = 'INTEGER NOT NULL DEFAULT 0' if dialect == 'sqlite' else 'BOOLEAN NOT NULL DEFAULT FALSE'
    for table in ('loan_schedule', 'loan_payments'):
        if not insp.has_table(table):
            continue
        cols = {c['name'] for c in insp.get_columns(table)}
        if 'credit_as_cash' in cols:
            continue
        with engine.begin() as conn:
            conn.execute(text(f'ALTER TABLE {table} ADD COLUMN credit_as_cash {typ}'))


def ensure_pf_finance_expense_income_columns(engine: Engine) -> None:
    """Add expense/income enhancement columns (SQLite + PostgreSQL)."""
    dialect = engine.dialect.name
    if dialect not in ('sqlite', 'postgresql'):
        return
    insp = inspect(engine)

    def add_cols(table: str, specs: list[tuple[str, str]]) -> None:
        if not insp.has_table(table):
            return
        cols = {c['name'] for c in insp.get_columns(table)}
        with engine.begin() as conn:
            for name, sql_typ in specs:
                if name in cols:
                    continue
                conn.execute(text(f'ALTER TABLE {table} ADD COLUMN {name} {sql_typ}'))

    if dialect == 'sqlite':
        exp_specs = [
            ('expense_category_id', 'INTEGER'),
            ('paid_by', 'TEXT'),
            ('payment_method', 'TEXT'),
            ('bill_image_url', 'TEXT'),
            ('is_recurring', 'INTEGER NOT NULL DEFAULT 0'),
            ('recurring_type', 'TEXT'),
            ('payment_status', "TEXT NOT NULL DEFAULT 'PAID'"),
        ]
        inc_specs = [
            ('income_category_id', 'INTEGER'),
            ('received_from', 'TEXT'),
            ('payment_method', 'TEXT'),
            ('receipt_image_url', 'TEXT'),
            ('is_recurring', 'INTEGER NOT NULL DEFAULT 0'),
            ('recurring_type', 'TEXT'),
        ]
    else:
        exp_specs = [
            ('expense_category_id', 'INTEGER'),
            ('paid_by', 'VARCHAR(120)'),
            ('payment_method', 'VARCHAR(24)'),
            ('bill_image_url', 'TEXT'),
            ('is_recurring', 'BOOLEAN NOT NULL DEFAULT FALSE'),
            ('recurring_type', 'VARCHAR(20)'),
            ('payment_status', "VARCHAR(20) NOT NULL DEFAULT 'PAID'"),
        ]
        inc_specs = [
            ('income_category_id', 'INTEGER'),
            ('received_from', 'VARCHAR(200)'),
            ('payment_method', 'VARCHAR(24)'),
            ('receipt_image_url', 'TEXT'),
            ('is_recurring', 'BOOLEAN NOT NULL DEFAULT FALSE'),
            ('recurring_type', 'VARCHAR(20)'),
        ]

    add_cols('finance_expenses', exp_specs)
    add_cols('finance_income', inc_specs)


def ensure_pf_payment_instrument_column(engine: Engine) -> None:
    """Add ``payment_instrument_id`` on ``finance_expenses`` (SQLite + PostgreSQL)."""
    dialect = engine.dialect.name
    if dialect not in ('sqlite', 'postgresql'):
        return
    insp = inspect(engine)
    if not insp.has_table('finance_expenses'):
        return
    cols = {c['name'] for c in insp.get_columns('finance_expenses')}
    if 'payment_instrument_id' in cols:
        return
    typ = 'INTEGER'
    with engine.begin() as conn:
        conn.execute(text(f'ALTER TABLE finance_expenses ADD COLUMN payment_instrument_id {typ}'))


def ensure_loan_interest_free_days_column(engine: Engine) -> None:
    """Add ``interest_free_days`` on ``loans`` (grace period before interest accrual for EMI)."""
    dialect = engine.dialect.name
    if dialect not in ('sqlite', 'postgresql'):
        return
    insp = inspect(engine)
    if not insp.has_table('loans'):
        return
    cols = {c['name'] for c in insp.get_columns('loans')}
    if 'interest_free_days' in cols:
        return
    typ = 'INTEGER'
    with engine.begin() as conn:
        conn.execute(text(f'ALTER TABLE loans ADD COLUMN interest_free_days {typ}'))


def ensure_loan_emi_interest_and_settlement_columns(engine: Engine) -> None:
    """Add ``emi_interest_method`` and ``emi_settlement`` on ``loans``."""
    dialect = engine.dialect.name
    if dialect not in ('sqlite', 'postgresql'):
        return
    insp = inspect(engine)
    if not insp.has_table('loans'):
        return
    cols = {c['name'] for c in insp.get_columns('loans')}
    meth = "TEXT NOT NULL DEFAULT 'FLAT'" if dialect == 'sqlite' else "VARCHAR(24) NOT NULL DEFAULT 'FLAT'"
    sett = "TEXT NOT NULL DEFAULT 'RECEIPT'" if dialect == 'sqlite' else "VARCHAR(24) NOT NULL DEFAULT 'RECEIPT'"
    with engine.begin() as conn:
        if 'emi_interest_method' not in cols:
            conn.execute(text(f'ALTER TABLE loans ADD COLUMN emi_interest_method {meth}'))
        if 'emi_settlement' not in cols:
            conn.execute(text(f'ALTER TABLE loans ADD COLUMN emi_settlement {sett}'))


def ensure_liability_emi_columns(engine: Engine) -> None:
    """Add EMI-related columns on ``finance_liabilities`` (schedule table via metadata.create_all)."""
    dialect = engine.dialect.name
    if dialect not in ('sqlite', 'postgresql'):
        return
    insp = inspect(engine)
    if not insp.has_table('finance_liabilities'):
        return
    cols = {c['name'] for c in insp.get_columns('finance_liabilities')}
    meth = "TEXT NOT NULL DEFAULT 'FLAT'" if dialect == 'sqlite' else "VARCHAR(24) NOT NULL DEFAULT 'FLAT'"
    ifd = 'INTEGER'
    tm = 'INTEGER'
    esd = 'TEXT' if dialect == 'sqlite' else 'DATE'
    with engine.begin() as conn:
        if 'emi_interest_method' not in cols:
            conn.execute(text(f'ALTER TABLE finance_liabilities ADD COLUMN emi_interest_method {meth}'))
        if 'interest_free_days' not in cols:
            conn.execute(text(f'ALTER TABLE finance_liabilities ADD COLUMN interest_free_days {ifd}'))
        if 'term_months' not in cols:
            conn.execute(text(f'ALTER TABLE finance_liabilities ADD COLUMN term_months {tm}'))
        if 'emi_schedule_start_date' not in cols:
            conn.execute(text(f'ALTER TABLE finance_liabilities ADD COLUMN emi_schedule_start_date {esd}'))


def ensure_pf_payment_instrument_finance_account_column(engine: Engine) -> None:
    """Add ``finance_account_id`` on ``pf_payment_instruments``."""
    dialect = engine.dialect.name
    if dialect not in ('sqlite', 'postgresql'):
        return
    insp = inspect(engine)
    if not insp.has_table('pf_payment_instruments'):
        return
    cols = {c['name'] for c in insp.get_columns('pf_payment_instruments')}
    if 'finance_account_id' in cols:
        return
    typ = 'INTEGER'
    with engine.begin() as conn:
        conn.execute(text(f'ALTER TABLE pf_payment_instruments ADD COLUMN finance_account_id {typ}'))


def ensure_finance_expense_credit_card_id_column(engine: Engine) -> None:
    """Add ``credit_card_id`` on ``finance_expenses`` (credit card module)."""
    dialect = engine.dialect.name
    if dialect not in ('sqlite', 'postgresql'):
        return
    insp = inspect(engine)
    if not insp.has_table('finance_expenses'):
        return
    cols = {c['name'] for c in insp.get_columns('finance_expenses')}
    if 'credit_card_id' in cols:
        return
    with engine.begin() as conn:
        conn.execute(text('ALTER TABLE finance_expenses ADD COLUMN credit_card_id INTEGER'))


def ensure_credit_card_extra_columns(engine: Engine) -> None:
    """Add ``closing_day``, ``due_day`` on ``credit_cards``."""
    dialect = engine.dialect.name
    if dialect not in ('sqlite', 'postgresql'):
        return
    insp = inspect(engine)
    if not insp.has_table('credit_cards'):
        return
    cols = {c['name'] for c in insp.get_columns('credit_cards')}
    with engine.begin() as conn:
        if 'closing_day' not in cols:
            conn.execute(text('ALTER TABLE credit_cards ADD COLUMN closing_day INTEGER'))
        if 'due_day' not in cols:
            conn.execute(text('ALTER TABLE credit_cards ADD COLUMN due_day INTEGER'))


def ensure_credit_card_bill_extra_columns(engine: Engine) -> None:
    """Add ``minimum_due``, ``interest``, ``late_fee`` on ``credit_card_bills``."""
    dialect = engine.dialect.name
    if dialect not in ('sqlite', 'postgresql'):
        return
    insp = inspect(engine)
    if not insp.has_table('credit_card_bills'):
        return
    cols = {c['name'] for c in insp.get_columns('credit_card_bills')}
    amt = 'REAL NOT NULL DEFAULT 0' if dialect == 'sqlite' else 'NUMERIC(14, 2) NOT NULL DEFAULT 0'
    with engine.begin() as conn:
        if 'minimum_due' not in cols:
            conn.execute(text(f'ALTER TABLE credit_card_bills ADD COLUMN minimum_due {amt}'))
        if 'interest' not in cols:
            conn.execute(text(f'ALTER TABLE credit_card_bills ADD COLUMN interest {amt}'))
        if 'late_fee' not in cols:
            conn.execute(text(f'ALTER TABLE credit_card_bills ADD COLUMN late_fee {amt}'))


MOVEMENT_INTERNAL = 'internal_transfer'


def ensure_account_movements_schema(engine: Engine) -> None:
    """Rename ``account_transfers`` → ``account_movements`` and ``transfer_id`` → ``movement_id`` when needed."""
    dialect = engine.dialect.name
    if dialect not in ('sqlite', 'postgresql'):
        return
    insp = inspect(engine)
    if not insp.has_table('finance_accounts'):
        return

    has_old = insp.has_table('account_transfers')
    has_new = insp.has_table('account_movements')
    if has_old and has_new:
        # Rare; prefer new table — leave as-is if both exist (manual fix).
        return

    if dialect == 'sqlite':
        if has_old and not has_new:
            _sqlite_migrate_transfers_to_movements(engine)
        elif has_new:
            _sqlite_patch_movement_columns(engine)
        _sqlite_migrate_account_tx_movement_id(engine)
    else:
        if has_old and not has_new:
            _pg_migrate_transfers_to_movements(engine)
        elif has_new:
            _pg_patch_movement_columns(engine)
        _pg_migrate_account_tx_movement_id(engine)


def _sqlite_migrate_transfers_to_movements(engine: Engine) -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE account_movements (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    profile_id INTEGER NOT NULL REFERENCES profiles (id),
                    movement_type VARCHAR(32) NOT NULL DEFAULT 'internal_transfer',
                    from_account_id INTEGER REFERENCES finance_accounts (id),
                    to_account_id INTEGER REFERENCES finance_accounts (id),
                    liability_id INTEGER,
                    loan_id INTEGER,
                    credit_card_id INTEGER,
                    credit_card_bill_id INTEGER,
                    amount REAL NOT NULL,
                    movement_date DATE NOT NULL,
                    reference_number VARCHAR(128),
                    notes TEXT,
                    external_counterparty VARCHAR(120),
                    attachment_url TEXT,
                    created_by INTEGER REFERENCES users (id) ON DELETE SET NULL,
                    created_at TIMESTAMP
                )
                """
            )
        )
        conn.execute(
            text(
                f"""
                INSERT INTO account_movements (
                    id, profile_id, movement_type, from_account_id, to_account_id,
                    liability_id, loan_id, credit_card_id, credit_card_bill_id,
                    amount, movement_date, reference_number, notes, external_counterparty,
                    attachment_url, created_by, created_at
                )
                SELECT
                    id, profile_id, '{MOVEMENT_INTERNAL}', from_account_id, to_account_id,
                    NULL, NULL, NULL, NULL,
                    amount, transfer_date, reference_number,
                    CASE
                        WHEN transfer_method IS NOT NULL AND TRIM(transfer_method) != ''
                            AND UPPER(TRIM(transfer_method)) NOT IN ('INTERNAL', 'INTERNAL_TRANSFER')
                        THEN '[' || transfer_method || '] ' || COALESCE (notes, '')
                        ELSE notes
                    END,
                    NULL,
                    attachment_url, created_by, created_at
                FROM account_transfers
                """
            )
        )
        conn.execute(text('DROP TABLE account_transfers'))
        conn.execute(text('CREATE INDEX IF NOT EXISTS ix_am_profile ON account_movements (profile_id)'))
        conn.execute(text('CREATE INDEX IF NOT EXISTS ix_am_date ON account_movements (movement_date DESC)'))


def _sqlite_patch_movement_columns(engine: Engine) -> None:
    insp = inspect(engine)
    cols = {c['name'] for c in insp.get_columns('account_movements')}
    alters = [
        ('movement_type', "VARCHAR(32) NOT NULL DEFAULT 'internal_transfer'"),
        ('liability_id', 'INTEGER'),
        ('loan_id', 'INTEGER'),
        ('credit_card_id', 'INTEGER'),
        ('credit_card_bill_id', 'INTEGER'),
        ('external_counterparty', 'VARCHAR(120)'),
    ]
    with engine.begin() as conn:
        if 'movement_date' not in cols and 'transfer_date' in cols:
            conn.execute(text('ALTER TABLE account_movements RENAME COLUMN transfer_date TO movement_date'))
        for name, typ in alters:
            if name not in cols:
                conn.execute(text(f'ALTER TABLE account_movements ADD COLUMN {name} {typ}'))


def _sqlite_migrate_account_tx_movement_id(engine: Engine) -> None:
    insp = inspect(engine)
    if not insp.has_table('account_transactions'):
        return
    cols = {c['name'] for c in insp.get_columns('account_transactions')}
    if 'movement_id' in cols and 'transfer_id' not in cols:
        return
    with engine.begin() as conn:
        if 'movement_id' not in cols:
            conn.execute(text('ALTER TABLE account_transactions ADD COLUMN movement_id INTEGER'))
        if 'transfer_id' in cols:
            conn.execute(
                text(
                    """
                    UPDATE account_transactions
                    SET movement_id = transfer_id
                    WHERE transfer_id IS NOT NULL AND movement_id IS NULL
                    """
                )
            )
            # SQLite 3.35+ DROP COLUMN
            try:
                conn.execute(text('ALTER TABLE account_transactions DROP COLUMN transfer_id'))
            except Exception:
                pass


def _pg_migrate_transfers_to_movements(engine: Engine) -> None:
    with engine.begin() as conn:
        conn.execute(text('ALTER TABLE account_transfers RENAME TO account_movements'))
        conn.execute(text('ALTER TABLE account_movements RENAME COLUMN transfer_date TO movement_date'))
        conn.execute(text(f"ALTER TABLE account_movements ADD COLUMN movement_type VARCHAR(32) NOT NULL DEFAULT '{MOVEMENT_INTERNAL}'"))
        conn.execute(
            text(
                """
                UPDATE account_movements SET movement_type = 'internal_transfer'
                WHERE movement_type IS NULL OR movement_type = ''
                """
            )
        )
        conn.execute(
            text(
                """
                UPDATE account_movements SET notes = CASE
                    WHEN transfer_method IS NOT NULL AND TRIM(transfer_method) <> ''
                         AND UPPER(TRIM(transfer_method)) NOT IN ('INTERNAL', 'INTERNAL_TRANSFER')
                    THEN '[' || transfer_method || '] ' || COALESCE(notes, '')
                    ELSE notes
                END
                """
            )
        )
        conn.execute(text('ALTER TABLE account_movements DROP COLUMN IF EXISTS transfer_method'))
        conn.execute(text('ALTER TABLE account_movements ALTER COLUMN from_account_id DROP NOT NULL'))
        conn.execute(text('ALTER TABLE account_movements ALTER COLUMN to_account_id DROP NOT NULL'))
        for stmt in (
            'ALTER TABLE account_movements ADD COLUMN IF NOT EXISTS liability_id INTEGER REFERENCES finance_liabilities (id)',
            'ALTER TABLE account_movements ADD COLUMN IF NOT EXISTS loan_id INTEGER REFERENCES loans (id)',
            'ALTER TABLE account_movements ADD COLUMN IF NOT EXISTS credit_card_id INTEGER REFERENCES credit_cards (id)',
            'ALTER TABLE account_movements ADD COLUMN IF NOT EXISTS credit_card_bill_id INTEGER REFERENCES credit_card_bills (id)',
            'ALTER TABLE account_movements ADD COLUMN IF NOT EXISTS external_counterparty VARCHAR(120)',
        ):
            conn.execute(text(stmt))


def _pg_patch_movement_columns(engine: Engine) -> None:
    insp = inspect(engine)
    if not insp.has_table('account_movements'):
        return
    cols = {c['name'] for c in insp.get_columns('account_movements')}
    with engine.begin() as conn:
        if 'movement_date' not in cols and 'transfer_date' in cols:
            conn.execute(text('ALTER TABLE account_movements RENAME COLUMN transfer_date TO movement_date'))
        for stmt in (
            "ALTER TABLE account_movements ADD COLUMN IF NOT EXISTS movement_type VARCHAR(32) NOT NULL DEFAULT 'internal_transfer'",
            'ALTER TABLE account_movements ADD COLUMN IF NOT EXISTS liability_id INTEGER REFERENCES finance_liabilities (id)',
            'ALTER TABLE account_movements ADD COLUMN IF NOT EXISTS loan_id INTEGER REFERENCES loans (id)',
            'ALTER TABLE account_movements ADD COLUMN IF NOT EXISTS credit_card_id INTEGER REFERENCES credit_cards (id)',
            'ALTER TABLE account_movements ADD COLUMN IF NOT EXISTS credit_card_bill_id INTEGER REFERENCES credit_card_bills (id)',
            'ALTER TABLE account_movements ADD COLUMN IF NOT EXISTS external_counterparty VARCHAR(120)',
        ):
            conn.execute(text(stmt))


def _pg_migrate_account_tx_movement_id(engine: Engine) -> None:
    insp = inspect(engine)
    if not insp.has_table('account_transactions'):
        return
    cols = {c['name'] for c in insp.get_columns('account_transactions')}
    if 'movement_id' in cols and 'transfer_id' not in cols:
        return
    with engine.begin() as conn:
        if 'movement_id' not in cols:
            conn.execute(
                text(
                    """
                    ALTER TABLE account_transactions
                    ADD COLUMN movement_id INTEGER REFERENCES account_movements (id) ON DELETE SET NULL
                    """
                )
            )
        if 'transfer_id' in cols:
            conn.execute(
                text(
                    """
                    UPDATE account_transactions SET movement_id = transfer_id
                    WHERE transfer_id IS NOT NULL
                    """
                )
            )
            conn.execute(text('ALTER TABLE account_transactions DROP COLUMN IF EXISTS transfer_id'))
