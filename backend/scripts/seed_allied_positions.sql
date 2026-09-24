-- Create devices for any vehicle missing a device_id
DO $$
DECLARE
  v RECORD;
  new_dev_id BIGINT;
BEGIN
  FOR v IN SELECT id, reg_number FROM vehicles WHERE company_id = 1 AND device_id IS NULL LOOP
    INSERT INTO devices (company_id, imei, device_type, sim_no, status)
    VALUES (1, '86420104' || LPAD(v.id::text, 7, '0'), 'TELTONIKA_FMB920', '+97150' || LPAD(v.id::text, 7, '0'), 'active')
    RETURNING id INTO new_dev_id;
    
    UPDATE vehicles SET device_id = new_dev_id WHERE id = v.id;
  END LOOP;
END $$;

-- For any vehicle in company 1 that doesn't have a position in positions, generate a position around UAE
INSERT INTO positions (time, device_id, location, speed, heading, altitude, satellites, ignition, gsm_signal, voltage, temperature, odometer)
SELECT 
  NOW() - (random() * interval '2 hours'),
  v.device_id,
  ST_SetSRID(ST_MakePoint(
    55.10 + (random() * 0.45), -- UAE Lng: ~55.1 to 55.55
    24.85 + (random() * 0.40)  -- UAE Lat: ~24.85 to 25.25
  ), 4326),
  CASE WHEN random() > 0.45 THEN floor(random() * 85 + 15)::real ELSE 0.0::real END,
  floor(random() * 360)::real,
  15::real,
  14::smallint,
  random() > 0.35,
  floor(random() * 10 + 20)::smallint,
  24.5::real,
  (22.0 + random() * 6.0)::real,
  floor(random() * 500000 + 50000)::bigint
FROM vehicles v
WHERE v.company_id = 1 AND v.device_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM positions p WHERE p.device_id = v.device_id);
