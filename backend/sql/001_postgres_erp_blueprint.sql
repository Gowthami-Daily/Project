-- Gowthami Daily — PostgreSQL ERP blueprint (target schema)
-- Apply with: psql -f 001_postgres_erp_blueprint.sql
-- Aligns ORM modules incrementally; existing SQLite dev DB may use different table names until migrated.

BEGIN;

-- ---------------------------------------------------------------------------
-- Reference / master data
-- ---------------------------------------------------------------------------

CREATE TABLE routes (
    id SERIAL PRIMARY KEY,
    code VARCHAR(32) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE staff (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL,
    phone VARCHAR(20),
    salary NUMERIC(12, 2),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE vehicles (
    id SERIAL PRIMARY KEY,
    vehicle_number VARCHAR(20) NOT NULL UNIQUE,
    type VARCHAR(50) NOT NULL,
    fuel_avg NUMERIC(5, 2),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------------
-- Users & auth (JWT accounts)
-- ---------------------------------------------------------------------------

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'STAFF',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users (email);

-- ---------------------------------------------------------------------------
-- Procurement (farmers) — canonical name ``farmers`` for greenfield PG
-- (SQLite dev may still use ``procurement_farmers`` until Alembic migration.)
-- ---------------------------------------------------------------------------

CREATE TABLE farmers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    village VARCHAR(100),
    milk_type VARCHAR(20) NOT NULL,
    bank_name VARCHAR(100),
    account_number VARCHAR(50),
    ifsc_code VARCHAR(20),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_farmers_phone ON farmers (phone);
CREATE INDEX idx_farmers_status ON farmers (status);

CREATE TABLE milk_collection (
    id SERIAL PRIMARY KEY,
    farmer_id INT NOT NULL REFERENCES farmers (id) ON DELETE RESTRICT,
    collection_date DATE NOT NULL,
    shift VARCHAR(10) NOT NULL,
    milk_type VARCHAR(20) NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL,
    fat NUMERIC(5, 2),
    snf NUMERIC(5, 2),
    rate NUMERIC(10, 2),
    amount NUMERIC(10, 2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_milk_collection_date ON milk_collection (collection_date);
CREATE INDEX idx_milk_collection_farmer ON milk_collection (farmer_id);

-- ---------------------------------------------------------------------------
-- Tanks & production
-- ---------------------------------------------------------------------------

CREATE TABLE tanks (
    id SERIAL PRIMARY KEY,
    tank_name VARCHAR(50) NOT NULL,
    capacity NUMERIC(10, 2) NOT NULL,
    current_level NUMERIC(10, 2) NOT NULL DEFAULT 0,
    temperature NUMERIC(5, 2),
    status VARCHAR(20) NOT NULL DEFAULT 'OPERATIONAL',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE production_batches (
    id SERIAL PRIMARY KEY,
    tank_id INT REFERENCES tanks (id) ON DELETE SET NULL,
    input_milk NUMERIC(10, 2) NOT NULL,
    output_milk NUMERIC(10, 2),
    loss NUMERIC(10, 2),
    status VARCHAR(20) NOT NULL DEFAULT 'PROCESSING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_production_batches_created ON production_batches (created_at);

CREATE TABLE packing (
    id SERIAL PRIMARY KEY,
    batch_id INT NOT NULL REFERENCES production_batches (id) ON DELETE CASCADE,
    pack_size VARCHAR(10) NOT NULL,
    quantity INT NOT NULL,
    total_liters NUMERIC(10, 2) NOT NULL
);

CREATE TABLE product_inventory (
    id SERIAL PRIMARY KEY,
    product_name VARCHAR(50) NOT NULL,
    pack_size VARCHAR(10) NOT NULL,
    quantity INT NOT NULL DEFAULT 0,
    liters NUMERIC(10, 2) NOT NULL DEFAULT 0,
    location VARCHAR(100),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------------
-- Customers, subscriptions, delivery
-- ---------------------------------------------------------------------------

CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    address TEXT,
    route_id INT REFERENCES routes (id) ON DELETE SET NULL,
    wallet_balance NUMERIC(10, 2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_customers_route ON customers (route_id);
CREATE INDEX idx_customers_status ON customers (status);

CREATE TABLE subscriptions (
    id SERIAL PRIMARY KEY,
    customer_id INT NOT NULL REFERENCES customers (id) ON DELETE CASCADE,
    product_name VARCHAR(50) NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL,
    schedule VARCHAR(50) NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_subscriptions_customer ON subscriptions (customer_id);

CREATE TABLE delivery_schedule (
    id SERIAL PRIMARY KEY,
    schedule_date DATE NOT NULL,
    route_id INT REFERENCES routes (id) ON DELETE SET NULL,
    customer_id INT NOT NULL REFERENCES customers (id) ON DELETE CASCADE,
    product_name VARCHAR(50) NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_delivery_schedule_date ON delivery_schedule (schedule_date);
CREATE INDEX idx_delivery_schedule_route ON delivery_schedule (route_id);
CREATE INDEX idx_delivery_schedule_customer ON delivery_schedule (customer_id);

CREATE TABLE dispatch (
    id SERIAL PRIMARY KEY,
    dispatch_date DATE NOT NULL,
    route_id INT REFERENCES routes (id) ON DELETE SET NULL,
    vehicle_id INT REFERENCES vehicles (id) ON DELETE SET NULL,
    driver_id INT REFERENCES staff (id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PLANNED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_dispatch_date ON dispatch (dispatch_date);

CREATE TABLE delivery_logs (
    id SERIAL PRIMARY KEY,
    schedule_id INT NOT NULL REFERENCES delivery_schedule (id) ON DELETE CASCADE,
    delivered_qty NUMERIC(10, 2) NOT NULL,
    status VARCHAR(20) NOT NULL,
    delivered_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_delivery_logs_schedule ON delivery_logs (schedule_id);

-- ---------------------------------------------------------------------------
-- Finance
-- ---------------------------------------------------------------------------

CREATE TABLE wallet_ledger (
    id SERIAL PRIMARY KEY,
    customer_id INT NOT NULL REFERENCES customers (id) ON DELETE CASCADE,
    entry_date DATE NOT NULL,
    type VARCHAR(20) NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    balance_after NUMERIC(10, 2) NOT NULL,
    reference VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_wallet_ledger_customer ON wallet_ledger (customer_id);
CREATE INDEX idx_wallet_ledger_date ON wallet_ledger (entry_date);

CREATE TABLE expenses (
    id SERIAL PRIMARY KEY,
    expense_date DATE NOT NULL,
    category VARCHAR(50) NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    paid_by VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_expenses_date ON expenses (expense_date);

-- ---------------------------------------------------------------------------
-- Cattle / herd
-- ---------------------------------------------------------------------------

CREATE TABLE animals (
    id SERIAL PRIMARY KEY,
    tag_number VARCHAR(50) NOT NULL UNIQUE,
    type VARCHAR(20) NOT NULL,
    breed VARCHAR(50),
    age_years INT,
    weight_kg NUMERIC(5, 2),
    status VARCHAR(20) NOT NULL DEFAULT 'MILKING',
    purchase_cost NUMERIC(10, 2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE milk_yield (
    id SERIAL PRIMARY KEY,
    animal_id INT NOT NULL REFERENCES animals (id) ON DELETE CASCADE,
    yield_date DATE NOT NULL,
    morning NUMERIC(5, 2),
    evening NUMERIC(5, 2),
    total NUMERIC(5, 2),
    UNIQUE (animal_id, yield_date)
);

CREATE INDEX idx_milk_yield_date ON milk_yield (yield_date);

CREATE TABLE feed_inventory (
    id SERIAL PRIMARY KEY,
    feed_name VARCHAR(50) NOT NULL,
    stock NUMERIC(10, 2) NOT NULL DEFAULT 0,
    unit VARCHAR(10) NOT NULL,
    cost_per_unit NUMERIC(10, 2) NOT NULL
);

CREATE TABLE feed_usage (
    id SERIAL PRIMARY KEY,
    animal_id INT NOT NULL REFERENCES animals (id) ON DELETE CASCADE,
    usage_date DATE NOT NULL,
    feed_name VARCHAR(50) NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL,
    cost NUMERIC(10, 2) NOT NULL
);

CREATE INDEX idx_feed_usage_animal_date ON feed_usage (animal_id, usage_date);

CREATE TABLE health_records (
    id SERIAL PRIMARY KEY,
    animal_id INT NOT NULL REFERENCES animals (id) ON DELETE CASCADE,
    visit_date DATE NOT NULL,
    problem TEXT,
    doctor VARCHAR(100),
    cost NUMERIC(10, 2),
    medicine TEXT
);

CREATE INDEX idx_health_records_animal ON health_records (animal_id);

COMMIT;
