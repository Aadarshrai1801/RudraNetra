-- Update all existing users password to "password"
UPDATE users SET password_hash = '$2a$10$bCQaeaau.AbYuc.Vc2usdOdRnaBSSRw/pn0dwlSzsCqPYqzBDHpBG';

-- Ensure Company 2 exists
INSERT INTO companies (id, name, code, address, city, contact_person, phone, email, status)
VALUES (2, 'EKSC Logistics Dubai', 'EKSC', 'Al Quoz Industrial 3, Dubai', 'Dubai', 'Tariq Al-Mansoor', '+971 4 338 9900', 'operations@eksc.ae', 1)
ON CONFLICT (id) DO UPDATE SET 
  name = 'EKSC Logistics Dubai',
  code = 'EKSC',
  city = 'Dubai';

-- Add EKSC Admin user
INSERT INTO users (company_id, username, password_hash, full_name, email, phone, role, is_active)
VALUES (2, 'eksc_admin', '$2a$10$bCQaeaau.AbYuc.Vc2usdOdRnaBSSRw/pn0dwlSzsCqPYqzBDHpBG', 'EKSC Fleet Supervisor', 'admin@eksc.ae', '+971 55 987 6543', 'admin', true)
ON CONFLICT (username) DO UPDATE SET
  company_id = 2,
  password_hash = '$2a$10$bCQaeaau.AbYuc.Vc2usdOdRnaBSSRw/pn0dwlSzsCqPYqzBDHpBG',
  full_name = 'EKSC Fleet Supervisor',
  role = 'admin',
  is_active = true;

-- Add Devices for EKSC (IDs 901-905)
INSERT INTO devices (id, company_id, imei, device_type, sim_no, status)
VALUES 
  (901, 2, '864201049010001', 'TELTONIKA_FMB920', '+971509010001', 'active'),
  (902, 2, '864201049010002', 'TELTONIKA_FMB920', '+971509010002', 'active'),
  (903, 2, '864201049010003', 'TELTONIKA_FMB920', '+971509010003', 'active'),
  (904, 2, '864201049010004', 'TELTONIKA_FMB920', '+971509010004', 'active'),
  (905, 2, '864201049010005', 'TELTONIKA_FMB920', '+971509010005', 'active')
ON CONFLICT (id) DO UPDATE SET
  company_id = 2,
  status = 'active';

-- Add Vehicles for EKSC
INSERT INTO vehicles (id, company_id, device_id, reg_number, make, model, variant, body_type, fuel_type, max_speed, odometer, icon_type, status)
VALUES
  (901, 2, 901, 'EKSC-901', 'Toyota', 'Land Cruiser Prado', 'TXL 4.0L', 'SUV', 'Petrol', 120, 48250, 'car', 'active'),
  (902, 2, 902, 'EKSC-902', 'Volvo', 'FH540 Heavy Tractor', '6x4 Globetrotter', 'Trailer', 'Diesel', 80, 214500, 'truck', 'active'),
  (903, 2, 903, 'EKSC-903', 'Mercedes-Benz', 'Actros 3340', 'Tipper 6x4', 'Truck', 'Diesel', 80, 189200, 'truck', 'active'),
  (904, 2, 904, 'EKSC-904', 'Isuzu', 'NPR 400', 'Chilled Box 4.5T', 'Van', 'Diesel', 90, 96300, 'truck', 'active'),
  (905, 2, 905, 'EKSC-905', 'Nissan', 'Patrol Super Safari', '4.8L Y61', 'SUV', 'Petrol', 130, 62100, 'car', 'active')
ON CONFLICT (id) DO UPDATE SET
  company_id = 2,
  device_id = EXCLUDED.device_id,
  reg_number = EXCLUDED.reg_number,
  make = EXCLUDED.make,
  model = EXCLUDED.model,
  variant = EXCLUDED.variant,
  status = 'active';

-- Add latest positions for EKSC vehicles in Dubai
INSERT INTO positions (time, device_id, location, speed, heading, altitude, satellites, ignition, gsm_signal, voltage, temperature, odometer)
VALUES
  (NOW(), 901, ST_SetSRID(ST_MakePoint(55.2341, 25.1382), 4326), 45.2, 42, 12, 14, true, 28, 13.8, 22.5, 48250),
  (NOW(), 902, ST_SetSRID(ST_MakePoint(55.1873, 25.0214), 4326), 62.0, 195, 8, 16, true, 30, 26.4, 24.1, 214500),
  (NOW(), 903, ST_SetSRID(ST_MakePoint(55.3621, 25.2654), 4326), 0.0, 88, 15, 12, true, 25, 25.1, 21.8, 189200),
  (NOW(), 904, ST_SetSRID(ST_MakePoint(55.1523, 25.0741), 4326), 71.5, 260, 5, 15, true, 29, 13.6, 23.0, 96300),
  (NOW(), 905, ST_SetSRID(ST_MakePoint(55.2708, 25.1972), 4326), 0.0, 310, 10, 13, false, 27, 12.6, 25.3, 62100);
