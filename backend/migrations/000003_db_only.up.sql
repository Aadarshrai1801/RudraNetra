-- ============================================================================
-- RudraNetra Database Schema Migration 000003
-- DB-only refactor: columns and tables required so that every feature is
-- backed by PostgreSQL and no hardcoded data remains in application code.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. COMPANIES: tenancy quotas, SIRA relay flag and API key
-- ----------------------------------------------------------------------------
ALTER TABLE companies
    ADD COLUMN IF NOT EXISTS max_devices  INTEGER,
    ADD COLUMN IF NOT EXISTS max_users    INTEGER,
    ADD COLUMN IF NOT EXISTS sira_relay   BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS api_key      VARCHAR(64);

-- ----------------------------------------------------------------------------
-- 2. DEVICES: SIM operator is stored, not inferred in application code
-- ----------------------------------------------------------------------------
ALTER TABLE devices
    ADD COLUMN IF NOT EXISTS sim_operator VARCHAR(50);

-- ----------------------------------------------------------------------------
-- 3. POSITIONS: Teltonika AVL sensor columns (fuel, backup battery, door)
-- ----------------------------------------------------------------------------
ALTER TABLE positions
    ADD COLUMN IF NOT EXISTS fuel_level_pct    REAL,
    ADD COLUMN IF NOT EXISTS backup_battery_v  REAL,
    ADD COLUMN IF NOT EXISTS door_open         BOOLEAN;

-- ----------------------------------------------------------------------------
-- 4. ALERTS: stored severity + rule description
-- ----------------------------------------------------------------------------
ALTER TABLE alerts
    ADD COLUMN IF NOT EXISTS severity VARCHAR(30) DEFAULT 'info';

ALTER TABLE alert_rules
    ADD COLUMN IF NOT EXISTS description TEXT;

-- ----------------------------------------------------------------------------
-- 5. INVOICES / BILLING: subscription billing fields
-- ----------------------------------------------------------------------------
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS plan             VARCHAR(100),
    ADD COLUMN IF NOT EXISTS device_count     INTEGER,
    ADD COLUMN IF NOT EXISTS rate_per_device  NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS period_start     DATE,
    ADD COLUMN IF NOT EXISTS period_end       DATE,
    ADD COLUMN IF NOT EXISTS notes            TEXT;

-- ----------------------------------------------------------------------------
-- 6. VEHICLE GROUPS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vehicle_groups (
    id          BIGSERIAL PRIMARY KEY,
    company_id  BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name        VARCHAR(150) NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_groups_company ON vehicle_groups(company_id);

CREATE TABLE IF NOT EXISTS vehicle_group_members (
    group_id    BIGINT NOT NULL REFERENCES vehicle_groups(id) ON DELETE CASCADE,
    vehicle_id  BIGINT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    PRIMARY KEY (group_id, vehicle_id)
);

-- ----------------------------------------------------------------------------
-- 7. ROUTE REGISTRY (predefined transit corridors)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS routes (
    id                BIGSERIAL PRIMARY KEY,
    company_id        BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name              VARCHAR(150) NOT NULL,
    source            VARCHAR(150),
    destination       VARCHAR(150),
    distance_km       REAL DEFAULT 0,
    estimated_minutes INTEGER DEFAULT 0,
    is_active         BOOLEAN DEFAULT TRUE,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_routes_company ON routes(company_id);

-- ----------------------------------------------------------------------------
-- 8. SMS GATEWAY CONFIGURATION
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sms_config (
    company_id  BIGINT PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
    provider    VARCHAR(100),
    sender_id   VARCHAR(50),
    api_key     VARCHAR(150),
    enabled     BOOLEAN DEFAULT FALSE,
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 9. COMPANY OPERATIONAL SETTINGS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS company_settings (
    company_id              BIGINT PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
    idle_threshold_minutes  INTEGER DEFAULT 20,
    speed_threshold_kmh     INTEGER DEFAULT 80,
    timezone                VARCHAR(100) DEFAULT 'Asia/Dubai',
    language                VARCHAR(20) DEFAULT 'en',
    vat_percent             NUMERIC(5,2) DEFAULT 5.00,
    co2_kg_per_litre        NUMERIC(6,3) DEFAULT 2.680,
    immobilizer_pin         VARCHAR(10),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 10. ROLE DEFINITIONS (module_permissions holds per-module masks)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
    id              BIGSERIAL PRIMARY KEY,
    role_name       VARCHAR(50) UNIQUE NOT NULL,
    description     VARCHAR(250),
    permission_mask INTEGER DEFAULT 15,
    is_system       BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 11. INDEXES for report/analytics query paths
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_positions_time ON positions (time DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_invoices_company ON invoices(company_id);

-- ----------------------------------------------------------------------------
-- 12. RECONCILE tyre_records
-- Migration 000001 created an earlier version of this table, so migration
-- 000002's CREATE TABLE IF NOT EXISTS was skipped. Add the missing columns so
-- the tyre lifecycle module is fully DB-backed on both fresh and existing DBs.
-- ----------------------------------------------------------------------------
ALTER TABLE tyre_records
    ADD COLUMN IF NOT EXISTS tyre_number      VARCHAR(100),
    ADD COLUMN IF NOT EXISTS axle_position    VARCHAR(50),
    ADD COLUMN IF NOT EXISTS model            VARCHAR(100),
    ADD COLUMN IF NOT EXISTS size             VARCHAR(50),
    ADD COLUMN IF NOT EXISTS tread_depth_mm   NUMERIC(5, 2) DEFAULT 15.0,
    ADD COLUMN IF NOT EXISTS ply_rating       INTEGER DEFAULT 16,
    ADD COLUMN IF NOT EXISTS opening_km       BIGINT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS current_km       BIGINT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS life_km_limit    BIGINT DEFAULT 100000,
    ADD COLUMN IF NOT EXISTS retreading_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ DEFAULT NOW();

UPDATE tyre_records SET tyre_number = COALESCE(tyre_number, serial_number) WHERE tyre_number IS NULL;
UPDATE tyre_records SET axle_position = COALESCE(axle_position, position)   WHERE axle_position IS NULL;
UPDATE tyre_records SET status = 'In Use' WHERE status = 'active';
