-- ============================================================================
-- RudraNetra Database Schema Migration 000002
-- Normalized schema for legacy feature modules
-- ============================================================================

-- 1. VEHICLE REMINDERS & COMPLIANCE
CREATE TABLE IF NOT EXISTS reminders (
    id                  BIGSERIAL PRIMARY KEY,
    company_id          BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    vehicle_id          BIGINT REFERENCES vehicles(id) ON DELETE CASCADE,
    reminder_type       VARCHAR(100) NOT NULL, -- 'Insurance Policy Renewal', 'RTA Vehicle Fitness', 'PUC Emission', 'Oil & Filter Service', 'Road Tax (Mulkiya)'
    due_date            DATE NOT NULL,
    due_km              BIGINT DEFAULT 0,
    alert_before_days   INTEGER DEFAULT 15,
    alert_before_km     INTEGER DEFAULT 0,
    notes               TEXT,
    is_acknowledged     BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reminders_company ON reminders(company_id);
CREATE INDEX IF NOT EXISTS idx_reminders_vehicle ON reminders(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_reminders_due_date ON reminders(due_date);

-- 2. TYRE MANAGEMENT
CREATE TABLE IF NOT EXISTS tyre_records (
    id                  BIGSERIAL PRIMARY KEY,
    company_id          BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    vehicle_id          BIGINT REFERENCES vehicles(id) ON DELETE SET NULL,
    tyre_number         VARCHAR(100) NOT NULL,
    axle_position       VARCHAR(50),
    brand               VARCHAR(100),
    model               VARCHAR(100),
    size                VARCHAR(50),
    tread_depth_mm      NUMERIC(5, 2) DEFAULT 15.0,
    ply_rating          INTEGER DEFAULT 16,
    status              VARCHAR(30) DEFAULT 'In Use', -- 'In Use', 'In Stock', 'Scrap', 'Retreading'
    opening_km          BIGINT DEFAULT 0,
    current_km          BIGINT DEFAULT 0,
    life_km_limit       BIGINT DEFAULT 100000,
    retreading_count    INTEGER DEFAULT 0,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tyres_company ON tyre_records(company_id);
CREATE INDEX IF NOT EXISTS idx_tyres_vehicle ON tyre_records(vehicle_id);

-- 3. REMOTE COMMANDS & IMMOBILIZER
CREATE TABLE IF NOT EXISTS device_commands (
    id                  BIGSERIAL PRIMARY KEY,
    company_id          BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    device_id           BIGINT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    vehicle_id          BIGINT REFERENCES vehicles(id) ON DELETE SET NULL,
    command_type        VARCHAR(50) NOT NULL, -- 'IEngineOff', 'IEngineOn', 'IAcOff', 'IDoorOff', 'SirenHooter', 'Reboot'
    command_payload     TEXT,
    sent_by             VARCHAR(150),
    status              VARCHAR(30) DEFAULT 'Delivered', -- 'Sent', 'Delivered', 'Acknowledged', 'Failed'
    sent_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_commands_device ON device_commands(device_id);
CREATE INDEX IF NOT EXISTS idx_device_commands_status ON device_commands(status);

-- 4. CUSTOMER SUPPORT / COMPLAINT TICKETS
CREATE TABLE IF NOT EXISTS complaints (
    id                  BIGSERIAL PRIMARY KEY,
    company_id          BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    ticket_no           VARCHAR(50) NOT NULL,
    vehicle_id          BIGINT REFERENCES vehicles(id) ON DELETE SET NULL,
    title               VARCHAR(200) NOT NULL,
    category            VARCHAR(100) NOT NULL, -- 'GPS Tracker Offline', 'Relay Issue', 'Fuel Sensor', 'Temperature Probe', 'SIRA Inspection'
    priority            VARCHAR(30) DEFAULT 'Medium', -- 'Critical', 'High', 'Medium', 'Low'
    status              VARCHAR(30) DEFAULT 'Open', -- 'Open', 'In Progress', 'Resolved', 'Closed'
    technician_assigned VARCHAR(150),
    resolution_notes    TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_complaints_company ON complaints(company_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);

-- 5. FLEET TRIPS (DUAL DRIVERS, ODOMETER, PROFITABILITY)
CREATE TABLE IF NOT EXISTS fleet_trips (
    id                  BIGSERIAL PRIMARY KEY,
    company_id          BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    trip_no             VARCHAR(50) NOT NULL,
    vehicle_id          BIGINT REFERENCES vehicles(id) ON DELETE SET NULL,
    driver1_name        VARCHAR(150),
    driver2_name        VARCHAR(150),
    party_name          VARCHAR(150),
    source              VARCHAR(150),
    destination         VARCHAR(150),
    planned_start       TIMESTAMPTZ,
    planned_arrival     TIMESTAMPTZ,
    actual_arrival      TIMESTAMPTZ,
    freight_amount      NUMERIC(12, 2) DEFAULT 0,
    advance_amount      NUMERIC(12, 2) DEFAULT 0,
    expense_amount      NUMERIC(12, 2) DEFAULT 0,
    balance_amount      NUMERIC(12, 2) DEFAULT 0,
    status              VARCHAR(30) DEFAULT 'In Transit', -- 'Planned', 'In Transit', 'Delivered', 'Settled'
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fleet_trips_company ON fleet_trips(company_id);
CREATE INDEX IF NOT EXISTS idx_fleet_trips_vehicle ON fleet_trips(vehicle_id);

-- 6. TRIP EXPENSE VOUCHERS
CREATE TABLE IF NOT EXISTS trip_vouchers (
    id                  BIGSERIAL PRIMARY KEY,
    company_id          BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    trip_id             BIGINT REFERENCES fleet_trips(id) ON DELETE CASCADE,
    voucher_type        VARCHAR(50) NOT NULL, -- 'Fuel (Diesel)', 'Salik / Toll Gate', 'Loading / Pallet', 'Mechanical Maintenance', 'Driver Batta'
    amount              NUMERIC(10, 2) NOT NULL,
    bill_no             VARCHAR(100),
    receipt_url         TEXT,
    notes               TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trip_vouchers_trip ON trip_vouchers(trip_id);

-- 7. PARTY PREDEFINED TRANSIT CORRIDORS
CREATE TABLE IF NOT EXISTS party_routes (
    id                  BIGSERIAL PRIMARY KEY,
    company_id          BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    party_name          VARCHAR(150) NOT NULL,
    source              VARCHAR(150) NOT NULL,
    destination         VARCHAR(150) NOT NULL,
    standard_km         REAL DEFAULT 0,
    standard_rate       NUMERIC(10, 2) DEFAULT 0,
    billing_rate        NUMERIC(10, 2) DEFAULT 0,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 8. TEMPORARY GUEST SHARING USERS
CREATE TABLE IF NOT EXISTS temp_users (
    id                  BIGSERIAL PRIMARY KEY,
    company_id          BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    guest_name          VARCHAR(150) NOT NULL,
    access_token        VARCHAR(100) UNIQUE NOT NULL,
    vehicle_ids         TEXT DEFAULT '[]',
    expires_at          TIMESTAMPTZ NOT NULL,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 9. ADMIN: SUBSCRIPTION EXTENSION MANAGER
CREATE TABLE IF NOT EXISTS subscription_extensions (
    id                  BIGSERIAL PRIMARY KEY,
    company_id          BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    vehicle_id          BIGINT REFERENCES vehicles(id) ON DELETE SET NULL,
    extension_type      VARCHAR(50) DEFAULT 'Company Subscription',
    start_date          DATE NOT NULL,
    end_date            DATE NOT NULL,
    months_extended     INTEGER NOT NULL,
    amount_paid         NUMERIC(10, 2) DEFAULT 0,
    approved_by         VARCHAR(150) NOT NULL,
    reason              TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 10. ADMIN: HARDWARE WARRANTY & AMC
CREATE TABLE IF NOT EXISTS warranty_records (
    id                  BIGSERIAL PRIMARY KEY,
    company_id          BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    device_id           BIGINT REFERENCES devices(id) ON DELETE CASCADE,
    warranty_period     VARCHAR(50) DEFAULT '1 Year',
    vendor_name         VARCHAR(150),
    start_date          DATE,
    end_date            DATE,
    amc_active          BOOLEAN DEFAULT TRUE,
    amc_expiry          DATE,
    remarks             TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 11. ADMIN: TOLL PLAZA REGISTRY
CREATE TABLE IF NOT EXISTS toll_plazas (
    id                  BIGSERIAL PRIMARY KEY,
    name                VARCHAR(150) NOT NULL,
    system_type         VARCHAR(50) DEFAULT 'RTA Salik',
    rate_standard       NUMERIC(8, 2) DEFAULT 4.00,
    latitude            DOUBLE PRECISION,
    longitude           DOUBLE PRECISION,
    city                VARCHAR(100) DEFAULT 'Dubai',
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 12. ADMIN: MODULE RIGHTS MATRIX
CREATE TABLE IF NOT EXISTS module_permissions (
    id                  BIGSERIAL PRIMARY KEY,
    role_name           VARCHAR(50) NOT NULL,
    module_name         VARCHAR(100) NOT NULL,
    permission_mask     INTEGER DEFAULT 15, -- 1: View, 2: Add, 4: Edit, 8: Delete
    UNIQUE(role_name, module_name)
);

-- 13. ADMIN: LOOKUP MASTERS
CREATE TABLE IF NOT EXISTS lookup_masters (
    id                  BIGSERIAL PRIMARY KEY,
    company_id          BIGINT REFERENCES companies(id) ON DELETE CASCADE,
    category            VARCHAR(50) NOT NULL, -- 'tyre-brands', 'axle-positions', 'voucher-categories', 'complaint-categories', 'device-models'
    code                VARCHAR(50) NOT NULL,
    name                VARCHAR(150) NOT NULL,
    is_default          BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 14. ADMIN: RAW SOCKET HEX PACKETS
CREATE TABLE IF NOT EXISTS raw_packets (
    id                  BIGSERIAL PRIMARY KEY,
    device_imei         VARCHAR(30) NOT NULL,
    protocol            VARCHAR(50) DEFAULT 'Teltonika Codec 8',
    payload_length      INTEGER DEFAULT 0,
    hex_data            TEXT NOT NULL,
    source_ip           VARCHAR(50),
    status              VARCHAR(50) DEFAULT 'CRC OK, ACK Sent',
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_raw_packets_imei_time ON raw_packets(device_imei, created_at DESC);
