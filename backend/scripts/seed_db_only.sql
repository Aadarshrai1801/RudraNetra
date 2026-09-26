-- ============================================================================
-- RudraNetra DB-only seed (migration 000003 companion)
-- Moves the demo datasets that previously lived in Go/TypeScript code into
-- PostgreSQL. Safe to re-run: every statement is guarded/idempotent.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. COMPANIES: quotas, SIRA relay, API keys, contact data
-- ----------------------------------------------------------------------------
UPDATE companies SET
    max_devices    = 500,
    max_users      = 50,
    sira_relay     = TRUE,
    api_key        = 'RN-KEY-COMP_1-' || encode(gen_random_bytes(4), 'hex'),
    contact_person = 'Operations Desk',
    email          = 'info@alliedtransport.ae',
    phone          = '+971-4-8800000',
    city           = 'Dubai',
    address        = 'Jebel Ali Industrial Area 1, Dubai, UAE'
WHERE id = 1;

UPDATE companies SET
    max_devices    = 100,
    max_users      = 20,
    sira_relay     = TRUE,
    api_key        = 'RN-KEY-EKSC-' || encode(gen_random_bytes(4), 'hex'),
    contact_person = 'Tariq Al-Mansoor',
    email          = 'operations@eksc.ae',
    phone          = '+971-4-3389900',
    city           = 'Dubai',
    address        = 'Al Quoz Industrial Area 3, Dubai, UAE'
WHERE id = 2;

-- ----------------------------------------------------------------------------
-- 2. DEVICES: port, firmware and SIM operator columns
-- ----------------------------------------------------------------------------
UPDATE devices SET port = 5040 WHERE port IS NULL OR port <= 0;

UPDATE devices SET firmware_ver = '03.28.07.Rev.00'
WHERE firmware_ver IS NULL OR firmware_ver = '';

UPDATE devices SET sim_operator = CASE
    WHEN sim_no LIKE '+97152%' OR sim_no LIKE '052%' OR sim_no LIKE '+97155%' OR sim_no LIKE '055%'
      OR sim_no LIKE '+97158%' OR sim_no LIKE '058%' THEN 'du Telecom'
    ELSE 'e& (Etisalat UAE)'
END
WHERE sim_operator IS NULL OR sim_operator = '';

-- ----------------------------------------------------------------------------
-- 3. POSITIONS: fuel level, backup battery and door contact telemetry
-- ----------------------------------------------------------------------------
UPDATE positions SET
    fuel_level_pct   = COALESCE(fuel_level_pct,
        ROUND((32 + ((device_id * 17 + (EXTRACT(EPOCH FROM time)::bigint / 60)) % 60))::numeric, 1)),
    backup_battery_v = COALESCE(backup_battery_v,
        ROUND((3.70 + ((device_id + (EXTRACT(EPOCH FROM time)::bigint / 60)) % 40) * 0.01)::numeric, 2)),
    door_open        = COALESCE(door_open,
        (device_id % 23 = 0 AND COALESCE(speed, 0) < 5))
WHERE fuel_level_pct IS NULL OR backup_battery_v IS NULL OR door_open IS NULL;

-- ----------------------------------------------------------------------------
-- 4. ALERTS: severity derived from rule type (stored, not computed in code)
-- ----------------------------------------------------------------------------
UPDATE alerts SET severity = CASE
    WHEN type IN ('overspeed', 'sos', 'panic', 'power_cut', 'tamper', 'harsh_braking', 'harsh_cornering') THEN 'critical'
    WHEN type IN ('idle', 'geofence', 'ignition', 'temperature', 'door', 'low_battery') THEN 'warning'
    ELSE 'info'
END
WHERE severity IS NULL OR severity = 'info';

UPDATE alert_rules SET description = CASE
    WHEN config ? 'speed_limit'  THEN 'Fires when vehicle speed exceeds ' || (config->>'speed_limit') || ' km/h'
    WHEN config ? 'max_idle_min' THEN 'Fires when idling exceeds ' || (config->>'max_idle_min') || ' minutes with ignition ON'
    WHEN config ? 'geofence_id'  THEN 'Fires on entry/exit of the configured geofence boundary'
    WHEN config ? 'threshold'    THEN 'Fires when the telemetry value crosses the configured threshold'
    WHEN type = 'geofence'       THEN 'Fires on geofence boundary entry or exit'
    WHEN type = 'overspeed'      THEN 'Fires when the configured speed limit is exceeded'
    WHEN type = 'idle'           THEN 'Fires when the vehicle idles beyond the configured duration'
    WHEN type = 'ignition'       THEN 'Fires when the ignition state changes'
    WHEN type = 'sos'            THEN 'Fires when the SOS panic input is triggered'
    ELSE 'Telemetry alert rule'
END
WHERE description IS NULL;

-- ----------------------------------------------------------------------------
-- 5. ROLES & MODULE PERMISSIONS (RBAC matrix)
-- ----------------------------------------------------------------------------
INSERT INTO roles (role_name, description, permission_mask, is_system) VALUES
    ('Tenant Admin', 'Full administrative control across the organization', 15, TRUE),
    ('Fleet Dispatcher', 'Live tracking, dispatch and fleet operations', 15, TRUE),
    ('Security Operations', 'Immobilizer control, alerts and incident response', 15, TRUE),
    ('View Only Client Auditor', 'Read-only audit access to tracking and reports', 1, TRUE)
ON CONFLICT (role_name) DO NOTHING;

INSERT INTO module_permissions (role_name, module_name, permission_mask) VALUES
    ('Tenant Admin', 'tracking', 15), ('Tenant Admin', 'reports', 15), ('Tenant Admin', 'fleet', 15),
    ('Tenant Admin', 'control_panel', 15), ('Tenant Admin', 'reminders', 15), ('Tenant Admin', 'billing', 15),
    ('Tenant Admin', 'users', 15),
    ('Fleet Dispatcher', 'tracking', 15), ('Fleet Dispatcher', 'reports', 13), ('Fleet Dispatcher', 'fleet', 15),
    ('Fleet Dispatcher', 'control_panel', 5), ('Fleet Dispatcher', 'reminders', 15), ('Fleet Dispatcher', 'billing', 1),
    ('Fleet Dispatcher', 'users', 3),
    ('Security Operations', 'tracking', 15), ('Security Operations', 'reports', 1), ('Security Operations', 'fleet', 5),
    ('Security Operations', 'control_panel', 15), ('Security Operations', 'reminders', 1), ('Security Operations', 'billing', 0),
    ('Security Operations', 'users', 1),
    ('View Only Client Auditor', 'tracking', 1), ('View Only Client Auditor', 'reports', 1), ('View Only Client Auditor', 'fleet', 1),
    ('View Only Client Auditor', 'control_panel', 0), ('View Only Client Auditor', 'reminders', 1), ('View Only Client Auditor', 'billing', 1),
    ('View Only Client Auditor', 'users', 0)
ON CONFLICT (role_name, module_name) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 6. COMPANY SETTINGS & SMS GATEWAY CONFIG
-- ----------------------------------------------------------------------------
INSERT INTO company_settings (company_id, idle_threshold_minutes, speed_threshold_kmh, timezone, language, vat_percent, co2_kg_per_litre, immobilizer_pin)
VALUES
    (1, 20, 80, 'Asia/Dubai', 'en', 5.00, 2.680, '1234'),
    (2, 15, 80, 'Asia/Dubai', 'en', 5.00, 2.680, '1234')
ON CONFLICT (company_id) DO NOTHING;

-- Provider keys are intentionally left empty: each tenant configures its own
-- SMS gateway credentials from the console; they are never committed to code.
INSERT INTO sms_config (company_id, provider, sender_id, api_key, enabled)
VALUES
    (1, 'Unifonic UAE', 'RUDRANETRA', NULL, TRUE),
    (2, 'Unifonic UAE', 'EKSC-FLEET', NULL, TRUE)
ON CONFLICT (company_id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 7. VEHICLE GROUPS
-- ----------------------------------------------------------------------------
INSERT INTO vehicle_groups (company_id, name, description)
SELECT 1, 'Reefer Cold Chain', 'Temperature controlled refrigerated units'
WHERE NOT EXISTS (SELECT 1 FROM vehicle_groups WHERE company_id = 1 AND name = 'Reefer Cold Chain');

INSERT INTO vehicle_groups (company_id, name, description)
SELECT 1, 'Long Haul Fleet', 'Inter-emirate heavy transport units'
WHERE NOT EXISTS (SELECT 1 FROM vehicle_groups WHERE company_id = 1 AND name = 'Long Haul Fleet');

INSERT INTO vehicle_group_members (group_id, vehicle_id)
SELECT g.id, v.id
FROM vehicle_groups g
JOIN LATERAL (
    SELECT id FROM vehicles WHERE company_id = g.company_id ORDER BY id LIMIT 25 OFFSET CASE WHEN g.name = 'Long Haul Fleet' THEN 25 ELSE 0 END
) v ON TRUE
WHERE g.company_id = 1
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------------
-- 8. ROUTE REGISTRY
-- ----------------------------------------------------------------------------
INSERT INTO routes (company_id, name, source, destination, distance_km, estimated_minutes, is_active)
SELECT * FROM (VALUES
    (1::bigint, 'Jebel Ali - Abu Dhabi Corridor', 'Jebel Ali Port, Dubai', 'Mussafah Industrial, Abu Dhabi', 168.5::real, 135, TRUE),
    (1::bigint, 'Dubai - Sharjah Inland Route', 'Al Quoz, Dubai', 'Industrial Area 13, Sharjah', 42.0::real, 55, TRUE),
    (1::bigint, 'Dubai - DWC Cargo Shuttle', 'Business Bay, Dubai', 'DWC Airport Cargo Terminal', 38.2::real, 45, TRUE)
) AS t(company_id, name, source, destination, distance_km, estimated_minutes, is_active)
WHERE NOT EXISTS (SELECT 1 FROM routes r WHERE r.company_id = 1);

-- ----------------------------------------------------------------------------
-- 9. REMINDERS (compliance & maintenance)
-- ----------------------------------------------------------------------------
INSERT INTO reminders (company_id, vehicle_id, reminder_type, due_date, alert_before_days, notes)
SELECT 1, v.id, d.rtype, CURRENT_DATE + d.days, 15, d.notes
FROM (SELECT id, row_number() OVER (ORDER BY id) rn FROM vehicles WHERE company_id = 1) v
JOIN (VALUES
    (1::bigint, 'Insurance Policy Renewal',       8,  'Policy renewal with AXA Gulf'),
    (2::bigint, 'RTA Vehicle Fitness',          -2,  'Overdue test - coordinate with RTA'),
    (3::bigint, 'Oil & Filter Service',          40,  'Full synthetic service interval'),
    (4::bigint, 'PUC Emission Certificate',        5,  'Emission certificate renewal'),
    (5::bigint, 'Hazmat Compliance Inspection',  90,  'ADR certification renewal')
) d(rn, rtype, days, notes) ON d.rn = v.rn
WHERE NOT EXISTS (SELECT 1 FROM reminders);

-- ----------------------------------------------------------------------------
-- 10. DEVICE COMMANDS (immobilizer audit trail)
-- ----------------------------------------------------------------------------
INSERT INTO device_commands (company_id, device_id, vehicle_id, command_type, command_payload, sent_by, status, sent_at)
SELECT 1, d.id, v.id, c.ctype, c.payload, c.sender, c.status, NOW() - c.age
FROM (VALUES
    (101::bigint, 'IEngineOff', 'setdigout 1', 'control@alliedtransport.ae',   'Acknowledged', INTERVAL '4 hours'),
    (101::bigint, 'IEngineOn',  'setdigout 0', 'control@alliedtransport.ae',   'Acknowledged', INTERVAL '3 hours 40 minutes'),
    (102::bigint, 'IEngineOff', 'setdigout 1', 'security@alliedtransport.ae',  'Delivered',    INTERVAL '2 hours'),
    (103::bigint, 'SirenHooter','setdigout 01','dispatcher@alliedtransport.ae','Sent',         INTERVAL '35 minutes'),
    (104::bigint, 'Reboot',     'cpureset',    'admin@alliedtransport.ae',     'Acknowledged', INTERVAL '26 hours')
) c(did, ctype, payload, sender, status, age)
JOIN devices d ON d.id = c.did
LEFT JOIN vehicles v ON v.device_id = d.id AND v.company_id = 1
WHERE NOT EXISTS (SELECT 1 FROM device_commands);

-- ----------------------------------------------------------------------------
-- 11. TEMPORARY GUEST SHARING PASSES
-- ----------------------------------------------------------------------------
-- Access tokens are generated by the database at seed time.
INSERT INTO temp_users (company_id, guest_name, access_token, vehicle_ids, expires_at)
SELECT 1, 'Ahmed (Client Audit)', 'tok_' || encode(gen_random_bytes(6), 'hex'), '["1","2","3"]', NOW() + INTERVAL '18 hours'
WHERE NOT EXISTS (SELECT 1 FROM temp_users WHERE guest_name = 'Ahmed (Client Audit)');
INSERT INTO temp_users (company_id, guest_name, access_token, vehicle_ids, expires_at)
SELECT 1, 'RTA Inspector', 'tok_' || encode(gen_random_bytes(6), 'hex'), '["4","5"]', NOW() + INTERVAL '6 hours'
WHERE NOT EXISTS (SELECT 1 FROM temp_users WHERE guest_name = 'RTA Inspector');

-- ----------------------------------------------------------------------------
-- 12. FLEET TRIPS, VOUCHERS & PARTY ROUTES
-- ----------------------------------------------------------------------------
INSERT INTO fleet_trips (company_id, trip_no, vehicle_id, driver1_name, driver2_name, party_name, source, destination,
                         planned_start, planned_arrival, freight_amount, advance_amount, expense_amount, balance_amount, status)
SELECT 1, t.trip_no, v.id, t.driver1, t.driver2, t.party, t.source, t.dest,
       NOW() - t.age, NOW() - t.age + INTERVAL '8 hours', t.freight, t.advance, t.expense, t.freight - t.advance - t.expense, t.status
FROM (VALUES
    ('TRP-2026-0089', 1::bigint, 'Ahmed Al-Mansoor', 'Bilal Khan',   'Al Futtaim Logistics', 'Jebel Ali Port, Dubai',  'Mussafah Industrial, Abu Dhabi', INTERVAL '6 hours',  3400.00, 1000.00, 420.00, 'In Transit'),
    ('TRP-2026-0090', 2::bigint, 'Farooq Ahmad',     'Zubair Hashmi','Carrefour UAE',        'Al Quoz, Dubai',         'DWC Airport Cargo, Dubai',       INTERVAL '26 hours', 1200.00,  400.00, 150.00, 'Delivered'),
    ('TRP-2026-0088', 3::bigint, 'Saeed Qureshi',    'Tariq Aziz',   'ADNOC Distribution',   'Port Rashid, Dubai',     'ICAD Industrial, Abu Dhabi',     INTERVAL '50 hours', 1980.00,  600.00, 260.00, 'Settled')
) t(trip_no, vrn, driver1, driver2, party, source, dest, age, freight, advance, expense, status)
JOIN (SELECT id, row_number() OVER (ORDER BY id) rn FROM vehicles WHERE company_id = 1) v ON v.rn = t.vrn
WHERE NOT EXISTS (SELECT 1 FROM fleet_trips);

INSERT INTO trip_vouchers (company_id, trip_id, voucher_type, amount, bill_no, notes)
SELECT 1, ft.id, v.vtype, v.amount, v.bill_no, v.notes
FROM (VALUES
    ('TRP-2026-0089', 'Fuel (Diesel)',          420.00, 'ENOC-99201',    'Full tank top-up at ENOC 1088'),
    ('TRP-2026-0090', 'Salik / Toll Gate',       24.00, 'RTA-SLK-4819',  'Salik crossings Dubai - DWC'),
    ('TRP-2026-0088', 'Loading / Pallet',       150.00, 'DC-RC-102',     'Loading and pallet handling charges')
) v(trip_no, vtype, amount, bill_no, notes)
JOIN fleet_trips ft ON ft.trip_no = v.trip_no AND ft.company_id = 1
WHERE NOT EXISTS (SELECT 1 FROM trip_vouchers);

INSERT INTO party_routes (company_id, party_name, source, destination, standard_km, standard_rate, billing_rate)
SELECT * FROM (VALUES
    (1::bigint, 'Al Futtaim Logistics', 'Jebel Ali Port, Dubai',   'Mussafah Industrial, Abu Dhabi', 145.5::real, 2800.00::numeric, 3400.00::numeric),
    (1::bigint, 'Carrefour UAE',        'Al Quoz, Dubai',          'DWC Airport Cargo, Dubai',        78.0::real, 1400.00::numeric, 1850.00::numeric),
    (1::bigint, 'ADNOC Distribution',   'Port Rashid, Dubai',      'ICAD Industrial, Abu Dhabi',     360.0::real, 4400.00::numeric, 5200.00::numeric)
) t(company_id, party_name, source, destination, standard_km, standard_rate, billing_rate)
WHERE NOT EXISTS (SELECT 1 FROM party_routes);

-- ----------------------------------------------------------------------------
-- 13. TYRE LIFECYCLE
-- ----------------------------------------------------------------------------
INSERT INTO tyre_records (company_id, vehicle_id, serial_number, tyre_number, position, axle_position, brand, model, size,
                          installed_date, install_odometer, tread_depth_mm, ply_rating, status,
                          opening_km, current_km, life_km_limit, retreading_count)
SELECT 1, v.id, 'TYR-' || LPAD(v.rn::text, 5, '0'), 'TYR-' || LPAD(v.rn::text, 5, '0'), t.pos, t.pos, t.brand, t.model, '295/80 R22.5',
       CURRENT_DATE - (t.retreads * 180 + 90), t.opening, t.tread, t.ply, t.status, t.opening, t.current, 100000, t.retreads
FROM (SELECT id, row_number() OVER (ORDER BY id) rn FROM vehicles WHERE company_id = 1) v
JOIN (VALUES
    (1::bigint, 'Front-Left',   'Bridgestone', 'R150 Premium',  15.0::numeric, 16, 'In Use',    42000::bigint, 68420::bigint, 0),
    (2::bigint, 'Front-Right',  'Michelin',    'X Multi Z',     14.5::numeric, 16, 'In Use',    38000::bigint, 62010::bigint, 0),
    (3::bigint, 'Rear-Outer-Left','Goodyear',  'Fuel Max',       9.0::numeric, 16, 'In Use',    51000::bigint, 88410::bigint, 1),
    (4::bigint, 'Rear-Outer-Right','Pirelli',  'FG01',           3.5::numeric, 16, 'Retreading',22000::bigint, 99840::bigint, 1),
    (5::bigint, 'Rear-Inner-Left','Yokohama',  'Zenith 002',    15.5::numeric, 16, 'In Use',     8000::bigint, 24600::bigint, 0)
) t(rn, pos, brand, model, tread, ply, status, opening, current, retreads) ON t.rn = v.rn
WHERE NOT EXISTS (SELECT 1 FROM tyre_records);

-- ----------------------------------------------------------------------------
-- 14. COMPLAINT TICKETS
-- ----------------------------------------------------------------------------
INSERT INTO complaints (company_id, ticket_no, vehicle_id, title, category, priority, status, technician_assigned, resolution_notes, created_at)
SELECT 1, c.ticket, v.id, c.title, c.category, c.priority, c.status, c.tech, c.notes, NOW() - c.age
FROM (VALUES
    (1::bigint, 'TCK-8812', 'GPS tracker offline since morning', 'GPS Tracker Offline', 'High',     'In Progress', 'Ramesh Sharma',  NULL,                                INTERVAL '5 hours'),
    (2::bigint, 'TCK-8809', 'Fuel sensor reading erratic values', 'Fuel Sensor',        'Medium',   'Open',        'Imran Siddiqui', NULL,                                INTERVAL '22 hours'),
    (3::bigint, 'TCK-8790', 'Reefer temperature breach at 2 AM', 'Temperature Probe',  'Critical', 'Resolved',    'Ramesh Sharma',  'Probe harness replaced and calibrated', INTERVAL '3 days')
) c(rn, ticket, title, category, priority, status, tech, notes, age)
JOIN (SELECT id, row_number() OVER (ORDER BY id) rn FROM vehicles WHERE company_id = 1) v ON v.rn = c.rn
WHERE NOT EXISTS (SELECT 1 FROM complaints);

-- ----------------------------------------------------------------------------
-- 15. ADMIN: SUBSCRIPTION EXTENSIONS
-- ----------------------------------------------------------------------------
INSERT INTO subscription_extensions (company_id, vehicle_id, extension_type, start_date, end_date, months_extended, amount_paid, approved_by, reason)
SELECT 1, NULL, 'Company Subscription', CURRENT_DATE - INTERVAL '2 months', CURRENT_DATE + INTERVAL '10 months', 12, 14400.00, 'SuperAdmin Console', 'Annual contract renewal - 18 devices'
WHERE NOT EXISTS (SELECT 1 FROM subscription_extensions WHERE company_id = 1);

INSERT INTO subscription_extensions (company_id, vehicle_id, extension_type, start_date, end_date, months_extended, amount_paid, approved_by, reason)
SELECT 2, NULL, 'Company Subscription', CURRENT_DATE, CURRENT_DATE + INTERVAL '1 month', 1, 650.00, 'SuperAdmin Console', 'Temporary fleet extension'
WHERE NOT EXISTS (SELECT 1 FROM subscription_extensions WHERE company_id = 2);

-- ----------------------------------------------------------------------------
-- 16. ADMIN: HARDWARE WARRANTY & AMC
-- ----------------------------------------------------------------------------
INSERT INTO warranty_records (company_id, device_id, warranty_period, vendor_name, start_date, end_date, amc_active, amc_expiry, remarks)
SELECT d.company_id, d.id, '3 Years', v.vendor, v.start_date, v.end_date, TRUE, v.amc_expiry, v.remarks
FROM (SELECT id, company_id, row_number() OVER (ORDER BY id) rn FROM devices WHERE company_id = 1) d
JOIN (VALUES
    (1::bigint, 'Teltonika Middle East FZE', DATE '2025-06-30', DATE '2028-06-30', DATE '2027-12-31', 'FMB920 reefer fleet batch'),
    (2::bigint, 'Teltonika Middle East FZE', DATE '2025-07-15', DATE '2028-07-15', DATE '2028-01-15', 'FMB125 light fleet batch'),
    (3::bigint, 'Concox Gulf Distribution',  DATE '2024-10-01', DATE '2026-10-01', DATE '2026-09-30', 'GT06N legacy units')
) v(rn, vendor, start_date, end_date, amc_expiry, remarks) ON v.rn = d.rn
WHERE NOT EXISTS (SELECT 1 FROM warranty_records);

-- ----------------------------------------------------------------------------
-- 17. ADMIN: TOLL PLAZA REGISTRY
-- ----------------------------------------------------------------------------
INSERT INTO toll_plazas (name, system_type, rate_standard, latitude, longitude, city)
SELECT * FROM (VALUES
    ('Al Barsha Salik Gate',      'RTA Salik', 4.00::numeric, 25.1124::double precision, 55.1973::double precision, 'Dubai'),
    ('Al Safa Salik Gate',        'RTA Salik', 4.00, 25.1739, 55.2356, 'Dubai'),
    ('Al Maktoum Bridge Toll',    'RTA Salik', 4.00, 25.2350, 55.3208, 'Dubai'),
    ('Al Mamzar Salik Gate',      'RTA Salik', 4.00, 25.2904, 55.3464, 'Dubai'),
    ('Sheikh Zayed Darb Toll',    'Darb',      4.00, 24.4667, 54.3705, 'Abu Dhabi')
) t(name, system_type, rate_standard, latitude, longitude, city)
WHERE NOT EXISTS (SELECT 1 FROM toll_plazas);

-- ----------------------------------------------------------------------------
-- 18. ADMIN: RAW SOCKET PACKETS
-- ----------------------------------------------------------------------------
-- Sample frames: payloads are generated at seed time, not committed.
INSERT INTO raw_packets (device_imei, protocol, payload_length, hex_data, source_ip, status, created_at)
SELECT * FROM (VALUES
    ('866728060473393', 'Teltonika Codec 8 Extended', 94, encode(gen_random_bytes(47), 'hex'), '10.0.14.22',  'CRC OK, ACK Sent', NOW() - INTERVAL '12 seconds'),
    ('866907056586372', 'Teltonika Codec 8',          88, encode(gen_random_bytes(44), 'hex'), '10.0.14.87',  'CRC OK, ACK Sent', NOW() - INTERVAL '48 seconds'),
    ('866907059393602', 'Teltonika Codec 8 Extended', 36, encode(gen_random_bytes(18), 'hex'), '10.0.15.104', 'CRC OK, ACK Sent', NOW() - INTERVAL '2 minutes')
) t(device_imei, protocol, payload_length, hex_data, source_ip, status, created_at)
WHERE NOT EXISTS (SELECT 1 FROM raw_packets);

-- ----------------------------------------------------------------------------
-- 19. ADMIN: BILLING INVOICES
-- ----------------------------------------------------------------------------
INSERT INTO invoices (company_id, inv_number, inv_date, amount, tax_amount, total_amount, paid_amount, status, due_date,
                      plan, device_count, rate_per_device, period_start, period_end, notes)
SELECT * FROM (VALUES
    (1::bigint, 'INV-2026-0901', CURRENT_DATE - 25, 720.00::numeric, 36.00::numeric, 756.00::numeric, 756.00::numeric, 'paid',
     CURRENT_DATE + 5, 'Enterprise GPS + SIRA Relay', 18, 40.00::numeric, CURRENT_DATE - 30, CURRENT_DATE, 'Wire transfer received'),
    (2::bigint, 'INV-2026-0902', CURRENT_DATE - 20, 400.00::numeric, 20.00::numeric, 420.00::numeric, 420.00::numeric, 'paid',
     CURRENT_DATE + 10, 'Fleet Tracking Standard', 10, 40.00::numeric, CURRENT_DATE - 30, CURRENT_DATE, 'Paid by cheque'),
    (1::bigint, 'INV-2026-1001', CURRENT_DATE - 5, 720.00::numeric, 36.00::numeric, 756.00::numeric, 0.00::numeric, 'unpaid',
     CURRENT_DATE + 15, 'Enterprise GPS + SIRA Relay', 18, 40.00::numeric, CURRENT_DATE - 5, CURRENT_DATE + 25, 'Awaiting payment receipt')
) t(company_id, inv_number, inv_date, amount, tax_amount, total_amount, paid_amount, status, due_date, plan, device_count, rate_per_device, period_start, period_end, notes)
WHERE NOT EXISTS (SELECT 1 FROM invoices);

-- ----------------------------------------------------------------------------
-- 20. ADMIN: LOOKUP MASTERS
-- ----------------------------------------------------------------------------
INSERT INTO lookup_masters (company_id, category, code, name, is_default) VALUES
    (NULL, 'tyre-brands', 'BRIDGESTONE', 'Bridgestone', TRUE),
    (NULL, 'tyre-brands', 'MICHELIN',    'Michelin',    FALSE),
    (NULL, 'tyre-brands', 'GOODYEAR',    'Goodyear',    FALSE),
    (NULL, 'tyre-brands', 'PIRELLI',     'Pirelli',     FALSE),
    (NULL, 'tyre-brands', 'YOKOHAMA',    'Yokohama',    FALSE),
    (NULL, 'axle-positions', 'FL',  'Front Left',          FALSE),
    (NULL, 'axle-positions', 'FR',  'Front Right',         FALSE),
    (NULL, 'axle-positions', 'ROL', 'Rear Outer Left',     FALSE),
    (NULL, 'axle-positions', 'RIL', 'Rear Inner Left',     FALSE),
    (NULL, 'axle-positions', 'ROR', 'Rear Outer Right',    FALSE),
    (NULL, 'axle-positions', 'RIR', 'Rear Inner Right',    FALSE),
    (NULL, 'axle-positions', 'SP1', 'Spare Tyre 1',        FALSE),
    (NULL, 'voucher-categories', 'FUEL',   'Fuel (Diesel)',        TRUE),
    (NULL, 'voucher-categories', 'TOLL',   'Salik / Toll Gate',    FALSE),
    (NULL, 'voucher-categories', 'MAINT',  'Mechanical Maintenance', FALSE),
    (NULL, 'voucher-categories', 'LOAD',   'Loading / Pallet',     FALSE),
    (NULL, 'voucher-categories', 'POLICE', 'Police Fine',          FALSE),
    (NULL, 'voucher-categories', 'DIET',   'Driver Batta / Diet',  FALSE),
    (NULL, 'complaint-categories', 'OFFLINE', 'GPS Tracker Offline', TRUE),
    (NULL, 'complaint-categories', 'RELAY',   'Relay Issue',         FALSE),
    (NULL, 'complaint-categories', 'FUEL_SNS','Fuel Sensor',        FALSE),
    (NULL, 'complaint-categories', 'TEMP_SNS','Temperature Probe',  FALSE),
    (NULL, 'complaint-categories', 'SIRA',    'SIRA Inspection',     FALSE),
    (NULL, 'device-models', 'TELTONIKA_FMB920',  'Teltonika FMB920',  TRUE),
    (NULL, 'device-models', 'TELTONIKA_FMB125',  'Teltonika FMB125',  FALSE),
    (NULL, 'device-models', 'TELTONIKA_FMC130',  'Teltonika FMC130',  FALSE),
    (NULL, 'device-models', 'CONCOX_GT06N',      'Concox GT06N',      FALSE),
    (NULL, 'sim-operators', 'ETISALAT', 'e& (Etisalat UAE)', TRUE),
    (NULL, 'sim-operators', 'DU',       'du Telecom',        FALSE)
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------------
-- 22. SUPERADMIN ACCOUNT
-- The console login must exist in the database. The password is "password";
-- the bcrypt hash is generated by the database at seed time (pgcrypto) so no
-- credential material is stored in source control.
-- ----------------------------------------------------------------------------
INSERT INTO users (company_id, username, password_hash, full_name, email, role, is_active)
VALUES (1, 'superadmin', crypt('password', gen_salt('bf', 10)),
        'System SuperAdmin', 'superadmin@rudranetrais.com', 'superadmin', TRUE)
ON CONFLICT (username) DO UPDATE SET
    role = 'superadmin',
    company_id = 1,
    is_active = TRUE;

-- ----------------------------------------------------------------------------
-- 23. FUEL LEDGER (analytics + fuel efficiency)
-- ----------------------------------------------------------------------------
INSERT INTO fuel_records (company_id, vehicle_id, fuel_date, liters, cost, odometer, vendor, receipt_no)
SELECT 1, v.id, NOW() - (g || ' days')::interval, 110 + (v.rn % 70), (110 + (v.rn % 70)) * 3.05,
       COALESCE(v.odometer, 0), 'ENOC Fleet Station', 'ENOC-' || LPAD(v.rn::text, 5, '0')
FROM (SELECT id, row_number() OVER (ORDER BY id) rn, odometer FROM vehicles WHERE company_id = 1) v
CROSS JOIN generate_series(1, 3) g
WHERE NOT EXISTS (SELECT 1 FROM fuel_records);
