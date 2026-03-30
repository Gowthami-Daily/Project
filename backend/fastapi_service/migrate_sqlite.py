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
