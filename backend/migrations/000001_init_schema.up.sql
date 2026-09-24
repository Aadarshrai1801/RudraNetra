-- ============================================================================
-- RudraNetra Database Schema Migration 000001
-- PostgreSQL 16 + PostGIS 3.4 + TimescaleDB
-- ============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. COMPANIES (Tenants)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS companies (
    id              BIGSERIAL PRIMARY KEY,
    name            VARCHAR(200) NOT NULL,
    code            VARCHAR(50) UNIQUE NOT NULL,
    database_name   VARCHAR(100),
    address         TEXT,
    city            VARCHAR(100),
    contact_person  VARCHAR(200),
    phone           VARCHAR(20),
    email           VARCHAR(200),
    status          SMALLINT DEFAULT 1,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_companies_code ON companies(code);
CREATE INDEX IF NOT EXISTS idx_companies_status ON companies(status);

-- ----------------------------------------------------------------------------
-- 2. USERS & ROLES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id              BIGSERIAL PRIMARY KEY,
    company_id      BIGINT REFERENCES companies(id) ON DELETE CASCADE,
    username        VARCHAR(100) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    full_name       VARCHAR(200),
    email           VARCHAR(200),
    phone           VARCHAR(20),
    role            VARCHAR(50) NOT NULL DEFAULT 'viewer', -- 'admin', 'manager', 'viewer', 'temp'
    permissions     JSONB DEFAULT '{}',
    is_active       BOOLEAN DEFAULT TRUE,
    last_login_at   TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_company ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- ----------------------------------------------------------------------------
-- 3. DEVICES (Hardware GPS Trackers)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS devices (
    id              BIGSERIAL PRIMARY KEY,
    company_id      BIGINT REFERENCES companies(id) ON DELETE SET NULL,
    imei            VARCHAR(20) UNIQUE NOT NULL,
    device_type     VARCHAR(50) DEFAULT 'TELTONIKA_FMB920',
    sim_no          VARCHAR(20),
    port            INTEGER DEFAULT 5040,
    status          VARCHAR(20) DEFAULT 'active',
    warranty_end    DATE,
    last_heartbeat  TIMESTAMPTZ,
    firmware_ver    VARCHAR(50),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_devices_imei ON devices(imei);
CREATE INDEX IF NOT EXISTS idx_devices_company ON devices(company_id);

-- ----------------------------------------------------------------------------
-- 4. VEHICLES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vehicles (
    id              BIGSERIAL PRIMARY KEY,
    company_id      BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    device_id       BIGINT UNIQUE REFERENCES devices(id) ON DELETE SET NULL,
    reg_number      VARCHAR(50) NOT NULL,
    make            VARCHAR(100),
    model           VARCHAR(100),
    variant         VARCHAR(100),
    body_type       VARCHAR(50),
    fuel_type       VARCHAR(20) DEFAULT 'Diesel',
    fuel_capacity   REAL DEFAULT 100.0,
    max_speed       INTEGER DEFAULT 80,
    odometer        BIGINT DEFAULT 0,
    icon_type       VARCHAR(50) DEFAULT 'truck',
    status          VARCHAR(20) DEFAULT 'active',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicles_company ON vehicles(company_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_reg_number ON vehicles(reg_number);
CREATE INDEX IF NOT EXISTS idx_vehicles_device ON vehicles(device_id);

-- ----------------------------------------------------------------------------
-- 5. DRIVERS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS drivers (
    id                  BIGSERIAL PRIMARY KEY,
    company_id          BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name                VARCHAR(200) NOT NULL,
    phone               VARCHAR(20),
    license_no          VARCHAR(50),
    license_expiry      DATE,
    rfid_tag            VARCHAR(100),
    assigned_vehicle_id BIGINT REFERENCES vehicles(id) ON DELETE SET NULL,
    status              VARCHAR(20) DEFAULT 'active',
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drivers_company ON drivers(company_id);
CREATE INDEX IF NOT EXISTS idx_drivers_rfid ON drivers(rfid_tag);

-- ----------------------------------------------------------------------------
-- 6. POSITIONS (TimescaleDB Hypertable + PostGIS)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS positions (
    time            TIMESTAMPTZ NOT NULL,
    device_id       BIGINT NOT NULL,
    location        GEOMETRY(POINT, 4326) NOT NULL,
    speed           REAL DEFAULT 0,
    heading         REAL DEFAULT 0,
    altitude        REAL DEFAULT 0,
    satellites      SMALLINT DEFAULT 0,
    ignition        BOOLEAN DEFAULT FALSE,
    gsm_signal      SMALLINT DEFAULT 0,
    voltage         REAL DEFAULT 0,
    temperature     REAL DEFAULT 0,
    odometer        BIGINT DEFAULT 0,
    rfid_tag        VARCHAR(100),
    raw_data        JSONB
);

-- Turn positions into a TimescaleDB hypertable partitioned by time (7-day chunks)
SELECT create_hypertable('positions', 'time', chunk_time_interval => INTERVAL '7 days', if_not_exists => TRUE);

-- Compound index for fast queries: latest position by device, trajectory range queries
CREATE INDEX IF NOT EXISTS idx_positions_device_time ON positions (device_id, time DESC);
CREATE INDEX IF NOT EXISTS idx_positions_location ON positions USING GIST (location);

-- ----------------------------------------------------------------------------
-- 7. GEOFENCES & POI
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS geofences (
    id              BIGSERIAL PRIMARY KEY,
    company_id      BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name            VARCHAR(200) NOT NULL,
    geom            GEOMETRY(POLYGON, 4326) NOT NULL,
    type            VARCHAR(20) DEFAULT 'zone', -- 'zone', 'route', 'poi'
    alert_on_enter  BOOLEAN DEFAULT TRUE,
    alert_on_exit   BOOLEAN DEFAULT TRUE,
    speed_limit     INTEGER,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_geofences_company ON geofences(company_id);
CREATE INDEX IF NOT EXISTS idx_geofences_geom ON geofences USING GIST (geom);

CREATE TABLE IF NOT EXISTS poi (
    id              BIGSERIAL PRIMARY KEY,
    company_id      BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name            VARCHAR(200) NOT NULL,
    location        GEOMETRY(POINT, 4326) NOT NULL,
    category        VARCHAR(50),
    address         TEXT,
    phone           VARCHAR(20),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_poi_company ON poi(company_id);
CREATE INDEX IF NOT EXISTS idx_poi_location ON poi USING GIST (location);

-- ----------------------------------------------------------------------------
-- 8. ALERTS & RULES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alert_rules (
    id              BIGSERIAL PRIMARY KEY,
    company_id      BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name            VARCHAR(200) NOT NULL,
    type            VARCHAR(50) NOT NULL, -- 'overspeed', 'geofence', 'ignition', 'sos', 'idle'
    config          JSONB NOT NULL DEFAULT '{}',
    sms_enabled     BOOLEAN DEFAULT FALSE,
    email_enabled   BOOLEAN DEFAULT FALSE,
    sms_template    TEXT,
    recipients      JSONB DEFAULT '[]',
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_rules_company ON alert_rules(company_id);

CREATE TABLE IF NOT EXISTS alerts (
    id              BIGSERIAL PRIMARY KEY,
    rule_id         BIGINT REFERENCES alert_rules(id) ON DELETE SET NULL,
    company_id      BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    device_id       BIGINT REFERENCES devices(id) ON DELETE CASCADE,
    type            VARCHAR(50) NOT NULL,
    message         TEXT NOT NULL,
    location        GEOMETRY(POINT, 4326),
    acknowledged    BOOLEAN DEFAULT FALSE,
    acknowledged_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_company_time ON alerts(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_device ON alerts(device_id);

-- ----------------------------------------------------------------------------
-- 9. TRIPS & ROUTES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trips (
    id              BIGSERIAL PRIMARY KEY,
    company_id      BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    vehicle_id      BIGINT REFERENCES vehicles(id) ON DELETE SET NULL,
    driver_id       BIGINT REFERENCES drivers(id) ON DELETE SET NULL,
    start_location  GEOMETRY(POINT, 4326),
    end_location    GEOMETRY(POINT, 4326),
    route           GEOMETRY(LINESTRING, 4326),
    start_time      TIMESTAMPTZ,
    end_time        TIMESTAMPTZ,
    distance_km     REAL DEFAULT 0,
    status          VARCHAR(20) DEFAULT 'planned', -- 'planned', 'in_progress', 'completed', 'cancelled'
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trips_company ON trips(company_id);
CREATE INDEX IF NOT EXISTS idx_trips_vehicle ON trips(vehicle_id);

-- ----------------------------------------------------------------------------
-- 10. FLEET OPERATIONS (Parties, Gate Passes, LRs, Vouchers, Invoices)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fleet_parties (
    id          BIGSERIAL PRIMARY KEY,
    company_id  BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name        VARCHAR(200) NOT NULL,
    contact     VARCHAR(100),
    phone       VARCHAR(20),
    email       VARCHAR(100),
    gst_number  VARCHAR(50),
    address     TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gate_passes (
    id          BIGSERIAL PRIMARY KEY,
    company_id  BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    vehicle_id  BIGINT REFERENCES vehicles(id) ON DELETE SET NULL,
    driver_id   BIGINT REFERENCES drivers(id) ON DELETE SET NULL,
    pass_number VARCHAR(50) NOT NULL,
    destination TEXT,
    purpose     TEXT,
    issued_at   TIMESTAMPTZ DEFAULT NOW(),
    return_at   TIMESTAMPTZ,
    status      VARCHAR(20) DEFAULT 'issued'
);

CREATE TABLE IF NOT EXISTS loading_receipts (
    id          BIGSERIAL PRIMARY KEY,
    company_id  BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    party_id    BIGINT REFERENCES fleet_parties(id) ON DELETE SET NULL,
    vehicle_id  BIGINT REFERENCES vehicles(id) ON DELETE SET NULL,
    lr_number   VARCHAR(50) NOT NULL,
    weight_kg   REAL DEFAULT 0,
    freight_amt NUMERIC(10, 2) DEFAULT 0,
    advance_amt NUMERIC(10, 2) DEFAULT 0,
    status      VARCHAR(20) DEFAULT 'pending',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fuel_records (
    id          BIGSERIAL PRIMARY KEY,
    company_id  BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    vehicle_id  BIGINT REFERENCES vehicles(id) ON DELETE CASCADE,
    fuel_date   TIMESTAMPTZ NOT NULL,
    liters      REAL NOT NULL,
    cost        NUMERIC(10, 2) NOT NULL,
    odometer    BIGINT,
    vendor      VARCHAR(100),
    receipt_no  VARCHAR(50),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tyre_records (
    id              BIGSERIAL PRIMARY KEY,
    company_id      BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    vehicle_id      BIGINT REFERENCES vehicles(id) ON DELETE CASCADE,
    serial_number   VARCHAR(100) NOT NULL,
    position        VARCHAR(50), -- 'Front-Left', 'Rear-Right-Inner', etc.
    brand           VARCHAR(100),
    installed_date  DATE,
    install_odometer BIGINT,
    status          VARCHAR(20) DEFAULT 'active',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoices (
    id          BIGSERIAL PRIMARY KEY,
    company_id  BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    inv_number  VARCHAR(50) NOT NULL,
    inv_date    DATE NOT NULL,
    amount      NUMERIC(12, 2) NOT NULL,
    tax_amount  NUMERIC(12, 2) DEFAULT 0,
    total_amount NUMERIC(12, 2) NOT NULL,
    paid_amount NUMERIC(12, 2) DEFAULT 0,
    status      VARCHAR(20) DEFAULT 'unpaid',
    due_date    DATE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
