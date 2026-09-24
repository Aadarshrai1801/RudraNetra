-- Seed script for real module data across Company 1 (Allied Transport) and Company 2 (EKSC Logistics)

-- 1. Company 2 Geofences
INSERT INTO geofences (company_id, name, type, speed_limit, alert_on_enter, alert_on_exit, is_active, geom)
VALUES
  (2, 'EKSC Al Quoz Central Depot', 'zone', 30, true, true, true,
   ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[55.2280,25.1320],[55.2390,25.1320],[55.2390,25.1440],[55.2280,25.1440],[55.2280,25.1320]]]}'), 4326)),
  (2, 'EKSC JAFZA South Logistics Hub', 'zone', 40, true, true, true,
   ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[55.0800,24.9750],[55.1050,24.9750],[55.1050,25.0000],[55.0800,25.0000],[55.0800,24.9750]]]}'), 4326)),
  (2, 'EKSC DWC Airport Cargo Terminal', 'zone', 35, true, true, true,
   ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[55.1400,24.8900],[55.1700,24.8900],[55.1700,24.9200],[55.1400,24.9200],[55.1400,24.8900]]]}'), 4326)),
  (2, 'EKSC Port Rashid Facility', 'zone', 25, true, true, true,
   ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[55.2650,25.2600],[55.2850,25.2600],[55.2850,25.2800],[55.2650,25.2800],[55.2650,25.2600]]]}'), 4326))
ON CONFLICT DO NOTHING;

-- 2. Company 2 POIs
INSERT INTO poi (company_id, name, location, category, address, phone)
VALUES
  (2, 'EKSC Maintenance Yard #3', ST_SetSRID(ST_MakePoint(55.2355, 25.1378), 4326), 'Depot', 'Street 8, Al Quoz 3, Dubai', '+971 4 338 9901'),
  (2, 'ENOC 1088 Al Quoz Fuel Hub', ST_SetSRID(ST_MakePoint(55.2312, 25.1345), 4326), 'Fuel', 'Al Marabea St, Dubai', '+971 4 338 1200'),
  (2, 'Jebel Ali Gate 4 Checkpoint', ST_SetSRID(ST_MakePoint(55.0921, 24.9854), 4326), 'Client Terminal', 'JAFZA South Gate 4', '+971 4 881 5500')
ON CONFLICT DO NOTHING;

-- 3. Company 2 Drivers
INSERT INTO drivers (company_id, name, phone, license_no, assigned_vehicle_id, status)
VALUES
  (2, 'Tariq Al-Mansoor', '+971-55-9870001', 'DXB-LIC-901', 901, 'active'),
  (2, 'Rashid Al-Falasi', '+971-55-9870002', 'DXB-LIC-902', 902, 'active'),
  (2, 'Hamad Al-Suwaidi', '+971-55-9870003', 'DXB-LIC-903', 903, 'active'),
  (2, 'Bilal Al-Nuaimi', '+971-55-9870004', 'DXB-LIC-904', 904, 'active'),
  (2, 'Omar Farooq', '+971-55-9870005', 'DXB-LIC-905', 905, 'active')
ON CONFLICT DO NOTHING;

-- 4. Company 2 Alert Rules
INSERT INTO alert_rules (company_id, name, type, config, sms_enabled, email_enabled, sms_template, is_active)
VALUES
  (2, 'Highway Overspeed Alert (80 km/h)', 'overspeed', '{"speed_limit": 80}', true, true, 'Vehicle {{vehicle}} exceeded 80 km/h', true),
  (2, 'Al Quoz Central Yard Entry & Exit', 'geofence', '{"geofence_id": 1}', false, true, 'Vehicle {{vehicle}} geofence transition detected', true),
  (2, 'Idling Duration Warning (>15 mins)', 'idle', '{"max_idle_min": 15}', false, false, 'Vehicle {{vehicle}} idling excessive time', true),
  (2, 'After-hours Engine Start Alert', 'ignition', '{"night_hours": true}', true, false, 'Vehicle {{vehicle}} ignition ON after hours', true)
ON CONFLICT DO NOTHING;

-- 5. Company 2 Alerts
INSERT INTO alerts (company_id, device_id, type, message, location, acknowledged, created_at)
VALUES
  (2, 902, 'overspeed', 'EKSC-902 drove at 88 km/h (Limit: 80 km/h) on Sheikh Zayed Road (E11)', ST_SetSRID(ST_MakePoint(55.1873, 25.0214), 4326), false, NOW() - INTERVAL '15 minutes'),
  (2, 904, 'geofence', 'EKSC-904 departed "EKSC Al Quoz Central Depot" towards DWC', ST_SetSRID(ST_MakePoint(55.1523, 25.0741), 4326), true, NOW() - INTERVAL '42 minutes'),
  (2, 903, 'idle', 'EKSC-903 stationary with ignition ON for 22 mins at Port Rashid', ST_SetSRID(ST_MakePoint(55.3621, 25.2654), 4326), false, NOW() - INTERVAL '1 hour 10 minutes'),
  (2, 901, 'geofence', 'EKSC-901 entered "EKSC JAFZA South Logistics Hub"', ST_SetSRID(ST_MakePoint(55.2341, 25.1382), 4326), true, NOW() - INTERVAL '2 hours 30 minutes')
ON CONFLICT DO NOTHING;

-- 6. Breadcrumb positions for EKSC-901 route playback
INSERT INTO positions (time, device_id, location, speed, heading, altitude, satellites, ignition, gsm_signal, voltage, temperature, odometer)
VALUES
  (NOW() - INTERVAL '45 minutes', 901, ST_SetSRID(ST_MakePoint(55.2280, 25.1320), 4326), 0, 40, 10, 14, true, 28, 13.8, 22.5, 48230),
  (NOW() - INTERVAL '42 minutes', 901, ST_SetSRID(ST_MakePoint(55.2295, 25.1335), 4326), 25, 42, 10, 14, true, 28, 13.8, 22.5, 48232),
  (NOW() - INTERVAL '39 minutes', 901, ST_SetSRID(ST_MakePoint(55.2315, 25.1350), 4326), 42, 45, 11, 14, true, 28, 13.8, 22.5, 48235),
  (NOW() - INTERVAL '36 minutes', 901, ST_SetSRID(ST_MakePoint(55.2335, 25.1365), 4326), 55, 42, 11, 15, true, 29, 13.8, 22.5, 48238),
  (NOW() - INTERVAL '33 minutes', 901, ST_SetSRID(ST_MakePoint(55.2360, 25.1390), 4326), 68, 40, 12, 15, true, 30, 13.8, 22.5, 48241),
  (NOW() - INTERVAL '30 minutes', 901, ST_SetSRID(ST_MakePoint(55.2385, 25.1420), 4326), 72, 38, 12, 16, true, 30, 13.8, 22.5, 48244),
  (NOW() - INTERVAL '27 minutes', 901, ST_SetSRID(ST_MakePoint(55.2410, 25.1455), 4326), 75, 36, 12, 16, true, 30, 13.8, 22.5, 48247),
  (NOW() - INTERVAL '24 minutes', 901, ST_SetSRID(ST_MakePoint(55.2440, 25.1500), 4326), 70, 35, 12, 16, true, 30, 13.8, 22.5, 48250),
  (NOW() - INTERVAL '21 minutes', 901, ST_SetSRID(ST_MakePoint(55.2475, 25.1550), 4326), 64, 35, 12, 15, true, 29, 13.8, 22.5, 48253),
  (NOW() - INTERVAL '18 minutes', 901, ST_SetSRID(ST_MakePoint(55.2510, 25.1610), 4326), 60, 32, 12, 15, true, 29, 13.8, 22.5, 48256),
  (NOW() - INTERVAL '15 minutes', 901, ST_SetSRID(ST_MakePoint(55.2550, 25.1680), 4326), 55, 30, 12, 15, true, 28, 13.8, 22.5, 48259),
  (NOW() - INTERVAL '12 minutes', 901, ST_SetSRID(ST_MakePoint(55.2600, 25.1760), 4326), 48, 28, 12, 14, true, 28, 13.8, 22.5, 48262),
  (NOW() - INTERVAL '9 minutes',  901, ST_SetSRID(ST_MakePoint(55.2640, 25.1830), 4326), 35, 25, 11, 14, true, 28, 13.8, 22.5, 48265),
  (NOW() - INTERVAL '6 minutes',  901, ST_SetSRID(ST_MakePoint(55.2675, 25.1900), 4326), 20, 20, 11, 14, true, 28, 13.8, 22.5, 48267),
  (NOW() - INTERVAL '3 minutes',  901, ST_SetSRID(ST_MakePoint(55.2708, 25.1972), 4326), 0, 15, 10, 14, false, 28, 13.8, 22.5, 48270)
ON CONFLICT DO NOTHING;

-- 7. Seed Gate Passes for Company 1 (Allied Transport)
INSERT INTO gate_passes (company_id, vehicle_id, driver_id, pass_number, destination, purpose, issued_at, status)
SELECT 
  1, v.id, d.id, 
  'GP-2026-' || LPAD((row_number() over())::text, 4, '0'),
  CASE (row_number() over() % 4)
    WHEN 0 THEN 'Jebel Ali Port Terminal 2'
    WHEN 1 THEN 'New Batha Logistics Corridor'
    WHEN 2 THEN 'Abu Dhabi Mina Free Port'
    ELSE 'Sharjah Inland Container Depot'
  END,
  'General Freight Transport',
  NOW() - (INTERVAL '1 hour' * (row_number() over())),
  CASE (row_number() over() % 3)
    WHEN 0 THEN 'Issued'
    WHEN 1 THEN 'In Transit'
    ELSE 'Returned'
  END
FROM vehicles v
JOIN drivers d ON d.assigned_vehicle_id = v.id
WHERE v.company_id = 1
LIMIT 8;

-- 8. Seed Gate Passes for Company 2 (EKSC Logistics)
INSERT INTO gate_passes (company_id, vehicle_id, driver_id, pass_number, destination, purpose, issued_at, status)
VALUES
  (2, 901, (SELECT id FROM drivers WHERE company_id = 2 LIMIT 1 OFFSET 0), 'GP-EKSC-001', 'JAFZA South Gate 4', 'Site Inspection & Delivery', NOW() - INTERVAL '2 hours', 'In Transit'),
  (2, 902, (SELECT id FROM drivers WHERE company_id = 2 LIMIT 1 OFFSET 1), 'GP-EKSC-002', 'DWC Cargo Logistics Berth', 'Heavy Machinery Haulage', NOW() - INTERVAL '3 hours 30 mins', 'In Transit'),
  (2, 903, (SELECT id FROM drivers WHERE company_id = 2 LIMIT 1 OFFSET 2), 'GP-EKSC-003', 'Port Rashid Pier 11', 'Bulk Aggregate Supply', NOW() - INTERVAL '5 hours', 'Returned'),
  (2, 904, (SELECT id FROM drivers WHERE company_id = 2 LIMIT 1 OFFSET 3), 'GP-EKSC-004', 'Dubai Industrial City Yard 7', 'Refrigerated Cold Chain Dispatch', NOW() - INTERVAL '1 hour 15 mins', 'Issued');

-- 9. Seed Loading Receipts (LR) for Company 1 (Allied Transport)
INSERT INTO loading_receipts (company_id, party_id, vehicle_id, lr_number, weight_kg, freight_amt, advance_amt, status, created_at)
SELECT
  1, p.id, v.id,
  'LR-' || (88400 + row_number() over())::text,
  (20000 + (row_number() over() * 1500))::real,
  (3000 + (row_number() over() * 350))::numeric(10,2),
  (800 + (row_number() over() * 100))::numeric(10,2),
  CASE (row_number() over() % 2) WHEN 0 THEN 'Completed' ELSE 'Pending' END,
  NOW() - (INTERVAL '3 hours' * (row_number() over()))
FROM vehicles v
JOIN fleet_parties p ON p.company_id = 1
WHERE v.company_id = 1
LIMIT 8;

-- 10. Seed Fleet Parties and Loading Receipts for Company 2 (EKSC Logistics)
INSERT INTO fleet_parties (company_id, name, phone, email, address)
VALUES
  (2, 'EMIRATES GLOBAL ALUMINIUM PJSC', '+971 4 884 6666', 'logistics@ega.ae', 'Jebel Ali Industrial Area, Dubai'),
  (2, 'DANUBE BUILDING MATERIALS FZCO', '+971 4 812 4444', 'supplychain@aldanube.com', 'JAFZA Freezone South, Dubai'),
  (2, 'ALMARAI LOGISTICS MIDDLE EAST', '+971 4 347 1800', 'uae.fleet@almarai.com', 'Al Quoz Industrial 1, Dubai')
ON CONFLICT DO NOTHING;

INSERT INTO loading_receipts (company_id, party_id, vehicle_id, lr_number, weight_kg, freight_amt, advance_amt, status, created_at)
VALUES
  (2, (SELECT id FROM fleet_parties WHERE company_id = 2 LIMIT 1 OFFSET 0), 902, 'LR-EKSC-501', 28500, 4800.00, 1500.00, 'Completed', NOW() - INTERVAL '4 hours'),
  (2, (SELECT id FROM fleet_parties WHERE company_id = 2 LIMIT 1 OFFSET 1), 903, 'LR-EKSC-502', 32000, 5200.00, 2000.00, 'Pending', NOW() - INTERVAL '2 hours'),
  (2, (SELECT id FROM fleet_parties WHERE company_id = 2 LIMIT 1 OFFSET 2), 904, 'LR-EKSC-503', 14200, 3100.00, 900.00, 'Completed', NOW() - INTERVAL '6 hours')
ON CONFLICT DO NOTHING;

-- 11. Breadcrumb positions for Vehicle 95321 (Device 101) & Vehicle 82561 (Device 102)
INSERT INTO positions (time, device_id, location, speed, heading, altitude, satellites, ignition, gsm_signal, voltage, temperature, odometer)
VALUES
  (NOW() - INTERVAL '60 minutes', 101, ST_SetSRID(ST_MakePoint(55.0747, 24.9824), 4326), 0, 45, 12, 14, true, 28, 13.8, 24.0, 1424100),
  (NOW() - INTERVAL '55 minutes', 101, ST_SetSRID(ST_MakePoint(55.0838, 24.9929), 4326), 35, 45, 12, 14, true, 28, 13.8, 24.0, 1424105),
  (NOW() - INTERVAL '50 minutes', 101, ST_SetSRID(ST_MakePoint(55.0920, 25.0033), 4326), 55, 42, 11, 15, true, 29, 13.8, 24.0, 1424112),
  (NOW() - INTERVAL '45 minutes', 101, ST_SetSRID(ST_MakePoint(55.1050, 25.0180), 4326), 72, 40, 11, 15, true, 30, 13.8, 24.0, 1424125),
  (NOW() - INTERVAL '40 minutes', 101, ST_SetSRID(ST_MakePoint(55.1220, 25.0390), 4326), 78, 40, 10, 16, true, 30, 13.8, 24.0, 1424140),
  (NOW() - INTERVAL '35 minutes', 101, ST_SetSRID(ST_MakePoint(55.1430, 25.0620), 4326), 80, 38, 10, 16, true, 30, 13.8, 24.0, 1424158),
  (NOW() - INTERVAL '30 minutes', 101, ST_SetSRID(ST_MakePoint(55.1680, 25.0890), 4326), 84, 38, 10, 16, true, 30, 13.8, 24.0, 1424179),
  (NOW() - INTERVAL '25 minutes', 101, ST_SetSRID(ST_MakePoint(55.1920, 25.1150), 4326), 76, 35, 10, 15, true, 29, 13.8, 24.0, 1424198),
  (NOW() - INTERVAL '20 minutes', 101, ST_SetSRID(ST_MakePoint(55.2150, 25.1380), 4326), 65, 32, 11, 15, true, 29, 13.8, 24.0, 1424214),
  (NOW() - INTERVAL '15 minutes', 101, ST_SetSRID(ST_MakePoint(55.2340, 25.1580), 4326), 52, 30, 11, 14, true, 28, 13.8, 24.0, 1424227),
  (NOW() - INTERVAL '10 minutes', 101, ST_SetSRID(ST_MakePoint(55.2510, 25.1780), 4326), 40, 25, 12, 14, true, 28, 13.8, 24.0, 1424237),
  (NOW() - INTERVAL '5 minutes',  101, ST_SetSRID(ST_MakePoint(55.2680, 25.1950), 4326), 25, 20, 12, 14, true, 28, 13.8, 24.0, 1424243),
  (NOW() - INTERVAL '1 minutes',  101, ST_SetSRID(ST_MakePoint(55.2750, 25.2010), 4326), 0, 10, 12, 14, false, 28, 13.8, 24.0, 1424245),
  (NOW() - INTERVAL '40 minutes', 102, ST_SetSRID(ST_MakePoint(55.3000, 25.2500), 4326), 0, 90, 10, 14, true, 27, 13.7, 23.5, 457310),
  (NOW() - INTERVAL '30 minutes', 102, ST_SetSRID(ST_MakePoint(55.3200, 25.2600), 4326), 45, 85, 10, 14, true, 28, 13.7, 23.5, 457320),
  (NOW() - INTERVAL '20 minutes', 102, ST_SetSRID(ST_MakePoint(55.3500, 25.2700), 4326), 65, 80, 11, 15, true, 29, 13.8, 23.5, 457335),
  (NOW() - INTERVAL '10 minutes', 102, ST_SetSRID(ST_MakePoint(55.3800, 25.2750), 4326), 55, 75, 11, 15, true, 29, 13.8, 23.5, 457348),
  (NOW() - INTERVAL '2 minutes',  102, ST_SetSRID(ST_MakePoint(55.4050, 25.2800), 4326), 20, 70, 10, 14, true, 28, 13.8, 23.5, 457355)
ON CONFLICT DO NOTHING;

