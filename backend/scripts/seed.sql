-- ============================================================================
-- RudraNetra Development & Staging Seed Data
-- ============================================================================

-- 1. COMPANIES (Tenants)
INSERT INTO companies (id, name, code, database_name, address, city, contact_person, phone, email, status)
VALUES 
  (1, 'VAVE Logistics UAE', 'VAVE_UAE', 'vave_uae_db', 'Sheikh Zayed Road, Al Quoz 3', 'Dubai', 'Sanjay Kumar', '+971-50-1234567', 'admin@vavelogistics.ae', 1),
  (2, 'Maruti Transport Corp', 'MARUTI_TR', 'maruti_db', 'Industrial Area 4', 'Sharjah', 'Rajesh Patel', '+971-55-9876543', 'dispatch@marutitransport.ae', 1),
  (3, 'Apex Cold Chain Ltd', 'APEX_COLD', 'apex_db', 'Musaffah ICAD 1', 'Abu Dhabi', 'Tariq Mansoor', '+971-52-3344556', 'operations@apexcold.ae', 1)
ON CONFLICT (id) DO NOTHING;

SELECT setval('companies_id_seq', (SELECT MAX(id) FROM companies));

-- 2. USERS (Bcrypt hash for 'password123')
-- $2a$10$4B9LzMvLh1cE039z0M3.Q.h378yR5fVv8jB8R8n8c08k8d0f1g2h3 -> standard test bcrypt
INSERT INTO users (id, company_id, username, password_hash, full_name, email, phone, role, is_active)
VALUES
  (1, 1, 'admin', '$2a$10$w8T0w2XjNqD5Fw8z1L8mfe7d3c9b1a5e7f9d1c3b5a7e9f1d3c5b7', 'System Administrator', 'admin@rudranetra.com', '+971-50-1111111', 'admin', true),
  (2, 1, 'dispatcher', '$2a$10$w8T0w2XjNqD5Fw8z1L8mfe7d3c9b1a5e7f9d1c3b5a7e9f1d3c5b7', 'Fleet Dispatch Manager', 'dispatch@vavelogistics.ae', '+971-50-2222222', 'manager', true),
  (3, 1, 'viewer', '$2a$10$w8T0w2XjNqD5Fw8z1L8mfe7d3c9b1a5e7f9d1c3b5a7e9f1d3c5b7', 'Client Operations Viewer', 'viewer@vavelogistics.ae', '+971-50-3333333', 'viewer', true)
ON CONFLICT (id) DO NOTHING;

SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));

-- 3. DEVICES (Teltonika FMB920)
INSERT INTO devices (id, company_id, imei, device_type, sim_no, port, status, warranty_end)
VALUES
  (101, 1, '352093088642068', 'TELTONIKA_FMB920', '+971501981240', 5040, 'active', '2027-12-31'),
  (102, 1, '352093088642069', 'TELTONIKA_FMB920', '+971501981241', 5040, 'active', '2027-12-31'),
  (103, 1, '352093088642070', 'TELTONIKA_FMB920', '+971501981242', 5040, 'active', '2027-12-31'),
  (104, 1, '352093088642071', 'TELTONIKA_FMB920', '+971501981243', 5040, 'active', '2027-12-31')
ON CONFLICT (id) DO NOTHING;

SELECT setval('devices_id_seq', (SELECT MAX(id) FROM devices));

-- 4. VEHICLES
INSERT INTO vehicles (id, company_id, device_id, reg_number, make, model, variant, body_type, fuel_type, max_speed, odometer, icon_type, status)
VALUES
  (1, 1, 101, 'DXB-A-98124', 'Mercedes-Benz', 'Actros 3340', 'Heavy Tipper', 'Heavy Truck', 'Diesel', 80, 142580, 'truck', 'active'),
  (2, 1, 102, 'DXB-B-43210', 'Volvo', 'FH16 750', 'Euro 6 Tractor', 'Trailer', 'Diesel', 80, 89340, 'truck', 'active'),
  (3, 1, 103, 'AUH-C-11029', 'Isuzu', 'NPR 75', 'Cold Storage Van', 'Reefer', 'Diesel', 90, 210940, 'van', 'active'),
  (4, 1, 104, 'SHJ-D-77123', 'Toyota', 'Hilux 4x4', 'Field Service', 'Pickup', 'Diesel', 100, 64120, 'pickup', 'active')
ON CONFLICT (id) DO NOTHING;

SELECT setval('vehicles_id_seq', (SELECT MAX(id) FROM vehicles));

-- 5. DRIVERS
INSERT INTO drivers (id, company_id, name, phone, license_no, license_expiry, rfid_tag, assigned_vehicle_id, status)
VALUES
  (1, 1, 'Mohammed Imran', '+971-50-9988771', 'DXB-HV-884102', '2028-06-30', 'RFID-TAG-001', 1, 'active'),
  (2, 1, 'Harpreet Singh', '+971-55-4433221', 'DXB-HV-993214', '2027-11-15', 'RFID-TAG-002', 2, 'active'),
  (3, 1, 'Ahmed Al-Falasi', '+971-52-1122334', 'AUH-LC-442198', '2029-01-20', 'RFID-TAG-003', 3, 'active')
ON CONFLICT (id) DO NOTHING;

SELECT setval('drivers_id_seq', (SELECT MAX(id) FROM drivers));

-- 6. GEOFENCES (PostGIS Polygons)
-- Geofence 1: Jebel Ali Port Free Zone
INSERT INTO geofences (id, company_id, name, geom, type, alert_on_enter, alert_on_exit, speed_limit)
VALUES (
  1, 1, 'Jebel Ali Port & Freezone',
  ST_SetSRID(ST_GeomFromText('POLYGON((55.030 25.020, 55.080 25.020, 55.080 24.960, 55.030 24.960, 55.030 25.020))'), 4326),
  'zone', true, true, 40
),
-- Geofence 2: Dubai International Airport Cargo Zone
(
  2, 1, 'DXB Cargo Terminal Gate 4',
  ST_SetSRID(ST_GeomFromText('POLYGON((55.350 25.260, 55.380 25.260, 55.380 25.230, 55.350 25.230, 55.350 25.260))'), 4326),
  'zone', true, true, 30
),
-- Geofence 3: Al Quoz Central Depot
(
  3, 1, 'Al Quoz Central Warehouse',
  ST_SetSRID(ST_GeomFromText('POLYGON((55.220 25.150, 55.250 25.150, 55.250 25.120, 55.220 25.120, 55.220 25.150))'), 4326),
  'zone', true, true, 20
)
ON CONFLICT (id) DO NOTHING;

SELECT setval('geofences_id_seq', (SELECT MAX(id) FROM geofences));

-- 7. POI (Points of Interest)
INSERT INTO poi (id, company_id, name, location, category, address, phone)
VALUES
  (1, 1, 'ENOC Service Station 1042', ST_SetSRID(ST_MakePoint(55.235, 25.142), 4326), 'Fuel', 'Sheikh Zayed Rd, Exit 43', '+971-4-3321100'),
  (2, 1, 'EPPCO Depot Al Quoz', ST_SetSRID(ST_MakePoint(55.240, 25.130), 4326), 'Fuel', 'Al Asayel St, Al Quoz 3', '+971-4-3401200'),
  (3, 1, 'JAFZA Customer Service Center', ST_SetSRID(ST_MakePoint(55.050, 24.990), 4326), 'Office', 'JAFZA 14 Building', '+971-4-8812222'),
  (4, 1, 'Al Maktoum Airport Freight Gate 2', ST_SetSRID(ST_MakePoint(55.160, 24.900), 4326), 'Logistics Hub', 'DWC Aviation City', '+971-4-8141111')
ON CONFLICT (id) DO NOTHING;

SELECT setval('poi_id_seq', (SELECT MAX(id) FROM poi));

-- 8. ALERT RULES
INSERT INTO alert_rules (id, company_id, name, type, config, sms_enabled, email_enabled, sms_template, recipients, is_active)
VALUES
  (1, 1, 'Over-speed Alarm (> 80 km/h)', 'overspeed', '{"max_speed": 80}', true, true, 'ALERT: Vehicle {{reg_number}} exceeded speed limit! Current speed: {{speed}} km/h at {{time}}', '[{"phone": "+971501234567", "email": "alerts@vavelogistics.ae"}]', true),
  (2, 1, 'Unauthorized Geofence Exit', 'geofence', '{"geofence_id": 1, "trigger": "exit"}', true, false, 'ALERT: Vehicle {{reg_number}} exited geofence {{geofence_name}} without clearance.', '[{"phone": "+971501234567"}]', true),
  (3, 1, 'Night Engine Ignition Alert', 'ignition', '{"start_hour": 23, "end_hour": 5}', false, true, 'ALERT: Vehicle {{reg_number}} ignition turned ON during off-duty hours.', '[{"email": "security@vavelogistics.ae"}]', true)
ON CONFLICT (id) DO NOTHING;

SELECT setval('alert_rules_id_seq', (SELECT MAX(id) FROM alert_rules));

-- 9. HISTORICAL POSITIONS SAMPLE (TimescaleDB hypertable)
-- Generates a realistic track trajectory for device 101 moving along Sheikh Zayed Road
INSERT INTO positions (time, device_id, location, speed, heading, altitude, satellites, ignition, gsm_signal, voltage, temperature, odometer, raw_data)
SELECT 
  NOW() - (i || ' minutes')::INTERVAL AS time,
  101 AS device_id,
  ST_SetSRID(ST_MakePoint(55.2200 + (i * 0.0015), 25.1200 + (i * 0.0022)), 4326) AS location,
  CASE WHEN i % 5 = 0 THEN 0 ELSE 65.0 + (i % 20) END AS speed,
  45.0 AS heading,
  12.0 AS altitude,
  14 AS satellites,
  CASE WHEN i % 5 = 0 THEN false ELSE true END AS ignition,
  4 AS gsm_signal,
  24.2 AS voltage,
  26.5 AS temperature,
  142500 + (i * 2) AS odometer,
  '{"acc": 1, "sat": 14}'::JSONB AS raw_data
FROM generate_series(0, 60) AS i;
