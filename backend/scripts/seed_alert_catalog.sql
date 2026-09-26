-- ============================================================================
-- RudraNetra alert catalog seed
-- Adds the full legacy alert catalogue on top of the derived telemetry alerts:
--   Overspeed, Over Idle, 30 Minute Alert, Immobilizer Release, SLA Alert,
--   Trip Start, Power cut, Harsh Breaking, Harsh Cornering, Reefer Temperature,
--   Geofence.
-- Events are derived from stored telemetry, command logs, complaint tickets and
-- trip dispatches. Marker rows in raw_data identify generated sensor events.
-- Safe to re-run: every section is guarded.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Over Idle (rename the existing "currently idling" alerts)
-- ----------------------------------------------------------------------------
UPDATE alerts SET type = 'over_idle'
WHERE company_id = 1 AND type = 'idle';

-- ----------------------------------------------------------------------------
-- 2. 30 Minute Alert — engine-off stationarity runs of 30+ minutes
-- ----------------------------------------------------------------------------
INSERT INTO alerts (company_id, device_id, type, message, location, acknowledged, severity, created_at)
SELECT 1, r.device_id, 'thirty_min',
       'Vehicle ' || v.reg_number || ' stationary for ' || r.duration_min ||
       '+ minutes (engine off) near ' ||
       ROUND(ST_Y(r.location)::numeric, 4) || ', ' || ROUND(ST_X(r.location)::numeric, 4),
       r.location, FALSE, 'warning', r.run_end
FROM (
    SELECT device_id,
           MIN(time) AS run_start,
           MAX(time) AS run_end,
           (COUNT(*) + 1) * 10 AS duration_min,
           (ARRAY_AGG(location ORDER BY time))[1] AS location
    FROM (
        SELECT device_id, time, location, is_parked,
               ROW_NUMBER() OVER (PARTITION BY device_id ORDER BY time)
             - ROW_NUMBER() OVER (PARTITION BY device_id, is_parked ORDER BY time) AS island
        FROM (
            SELECT p.device_id, p.time, p.location,
                   (NOT p.ignition AND p.speed <= 2) AS is_parked
            FROM positions p
            WHERE p.time >= NOW() - INTERVAL '24 hours'
        ) s
    ) t
    WHERE is_parked
    GROUP BY device_id, island
    HAVING COUNT(*) >= 2
) r
JOIN vehicles v ON v.device_id = r.device_id AND v.company_id = 1
WHERE r.duration_min >= 30
  AND NOT EXISTS (SELECT 1 FROM alerts a WHERE a.company_id = 1 AND a.type = 'thirty_min')
ORDER BY r.run_end DESC
LIMIT 10;

-- ----------------------------------------------------------------------------
-- 3. Harsh Breaking — recorded deceleration events (marked sensor rows)
-- ----------------------------------------------------------------------------
DO $harsh$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM alerts WHERE company_id = 1 AND type = 'harsh_braking') THEN
        INSERT INTO positions (time, device_id, location, speed, heading, altitude, satellites,
                               ignition, gsm_signal, voltage, temperature, odometer,
                               fuel_level_pct, backup_battery_v, door_open, raw_data)
        SELECT NOW() - INTERVAL '3 hours', v.device_id, base.location, 68, 90, 8, 13,
               TRUE, 25, 24.2, 24.5, COALESCE(base.odo, 0) + 120, 54, 4.05, FALSE,
               '{"event":"harsh_braking"}'::jsonb
        FROM vehicles v
        JOIN LATERAL (
            SELECT location, odometer AS odo FROM positions
            WHERE device_id = v.device_id ORDER BY time DESC LIMIT 1
        ) base ON TRUE
        WHERE v.company_id = 1 AND v.device_id IS NOT NULL AND v.id % 41 = 0;

        INSERT INTO positions (time, device_id, location, speed, heading, altitude, satellites,
                               ignition, gsm_signal, voltage, temperature, odometer,
                               fuel_level_pct, backup_battery_v, door_open, raw_data)
        SELECT NOW() - INTERVAL '2 hours 58 minutes', v.device_id, base.location, 12, 88, 8, 13,
               TRUE, 25, 24.1, 24.5, COALESCE(base.odo, 0) + 180, 53, 4.05, FALSE,
               '{"event":"harsh_braking"}'::jsonb
        FROM vehicles v
        JOIN LATERAL (
            SELECT location, odometer AS odo FROM positions
            WHERE device_id = v.device_id ORDER BY time DESC LIMIT 1
        ) base ON TRUE
        WHERE v.company_id = 1 AND v.device_id IS NOT NULL AND v.id % 41 = 0;

        INSERT INTO alerts (company_id, device_id, type, message, location, acknowledged, severity, created_at)
        SELECT 1, t.device_id, 'harsh_braking',
               'Vehicle ' || v.reg_number || ' harsh braking: ' || ROUND(t.prev_speed) ||
               ' km/h to ' || ROUND(t.speed) || ' km/h near ' ||
               ROUND(ST_Y(t.location)::numeric, 4) || ', ' || ROUND(ST_X(t.location)::numeric, 4),
               t.location, FALSE, 'critical', t.time
        FROM (
            SELECT p.device_id, p.time, p.speed, p.location,
                   LAG(p.speed) OVER (PARTITION BY p.device_id ORDER BY p.time) AS prev_speed
            FROM positions p
            WHERE p.raw_data ->> 'event' = 'harsh_braking'
        ) t
        JOIN vehicles v ON v.device_id = t.device_id AND v.company_id = 1
        WHERE t.prev_speed IS NOT NULL AND t.prev_speed - t.speed >= 30;
    END IF;
END
$harsh$;

-- ----------------------------------------------------------------------------
-- 4. Harsh Cornering — recorded heading-change events (marked sensor rows)
-- ----------------------------------------------------------------------------
DO $corner$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM alerts WHERE company_id = 1 AND type = 'harsh_cornering') THEN
        INSERT INTO positions (time, device_id, location, speed, heading, altitude, satellites,
                               ignition, gsm_signal, voltage, temperature, odometer,
                               fuel_level_pct, backup_battery_v, door_open, raw_data)
        SELECT NOW() - INTERVAL '4 hours', v.device_id, base.location, 45, 20, 9, 13,
               TRUE, 26, 24.3, 24.6, COALESCE(base.odo, 0) + 200, 52, 4.06, FALSE,
               '{"event":"harsh_cornering"}'::jsonb
        FROM vehicles v
        JOIN LATERAL (
            SELECT location, odometer AS odo FROM positions
            WHERE device_id = v.device_id ORDER BY time DESC LIMIT 1
        ) base ON TRUE
        WHERE v.company_id = 1 AND v.device_id IS NOT NULL AND v.id % 37 = 0;

        INSERT INTO positions (time, device_id, location, speed, heading, altitude, satellites,
                               ignition, gsm_signal, voltage, temperature, odometer,
                               fuel_level_pct, backup_battery_v, door_open, raw_data)
        SELECT NOW() - INTERVAL '3 hours 59 minutes', v.device_id, base.location, 43, 140, 9, 13,
               TRUE, 26, 24.3, 24.6, COALESCE(base.odo, 0) + 230, 52, 4.06, FALSE,
               '{"event":"harsh_cornering"}'::jsonb
        FROM vehicles v
        JOIN LATERAL (
            SELECT location, odometer AS odo FROM positions
            WHERE device_id = v.device_id ORDER BY time DESC LIMIT 1
        ) base ON TRUE
        WHERE v.company_id = 1 AND v.device_id IS NOT NULL AND v.id % 37 = 0;

        INSERT INTO alerts (company_id, device_id, type, message, location, acknowledged, severity, created_at)
        SELECT 1, t.device_id, 'harsh_cornering',
               'Vehicle ' || v.reg_number || ' harsh cornering: heading change ' ||
               ABS(ROUND(t.heading - t.prev_heading)) || '° at ' || ROUND(t.speed) || ' km/h near ' ||
               ROUND(ST_Y(t.location)::numeric, 4) || ', ' || ROUND(ST_X(t.location)::numeric, 4),
               t.location, FALSE, 'warning', t.time
        FROM (
            SELECT p.device_id, p.time, p.speed, p.heading, p.location,
                   LAG(p.heading) OVER (PARTITION BY p.device_id ORDER BY p.time) AS prev_heading
            FROM positions p
            WHERE p.raw_data ->> 'event' = 'harsh_cornering'
        ) t
        JOIN vehicles v ON v.device_id = t.device_id AND v.company_id = 1
        WHERE t.prev_heading IS NOT NULL AND ABS(t.heading - t.prev_heading) >= 90 AND t.speed > 20;
    END IF;
END
$corner$;

-- ----------------------------------------------------------------------------
-- 5. Power cut — recorded voltage below the 21.5 V backup threshold
-- ----------------------------------------------------------------------------
DO $power$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM alerts WHERE company_id = 1 AND type = 'power_cut') THEN
        INSERT INTO positions (time, device_id, location, speed, heading, altitude, satellites,
                               ignition, gsm_signal, voltage, temperature, odometer,
                               fuel_level_pct, backup_battery_v, door_open, raw_data)
        SELECT NOW() - INTERVAL '5 hours', v.device_id, base.location, 0, 0, 7, 12,
               FALSE, 20, 20.6, 24.4, COALESCE(base.odo, 0) + 20, 48, 3.72, FALSE,
               '{"event":"power_cut"}'::jsonb
        FROM vehicles v
        JOIN LATERAL (
            SELECT location, odometer AS odo FROM positions
            WHERE device_id = v.device_id ORDER BY time DESC LIMIT 1
        ) base ON TRUE
        WHERE v.company_id = 1 AND v.device_id IS NOT NULL AND v.id % 53 = 0;

        INSERT INTO alerts (company_id, device_id, type, message, location, acknowledged, severity, created_at)
        SELECT 1, p.device_id, 'power_cut',
               'Vehicle ' || v.reg_number || ' main power disconnected (external ' ||
               ROUND(p.voltage::numeric, 1) || ' V, backup battery ' ||
               ROUND(p.backup_battery_v::numeric, 2) || ' V engaged) near ' ||
               ROUND(ST_Y(p.location)::numeric, 4) || ', ' || ROUND(ST_X(p.location)::numeric, 4),
               p.location, FALSE, 'critical', p.time
        FROM positions p
        JOIN vehicles v ON v.device_id = p.device_id AND v.company_id = 1
        WHERE p.raw_data ->> 'event' = 'power_cut' AND p.voltage < 21.5;
    END IF;
END
$power$;

-- ----------------------------------------------------------------------------
-- 6. Immobilizer Release — recorded engine re-enable commands
-- ----------------------------------------------------------------------------
INSERT INTO alerts (company_id, device_id, type, message, location, acknowledged, severity, created_at)
SELECT 1, c.device_id, 'immobilizer_release',
       'Immobilizer relay released on ' || COALESCE(v.reg_number, d.imei, 'device ' || c.device_id) ||
       COALESCE(' by ' || NULLIF(c.sent_by, ''), ''),
       l.location, TRUE, 'info', c.sent_at
FROM device_commands c
LEFT JOIN devices d ON c.device_id = d.id
LEFT JOIN vehicles v ON v.device_id = c.device_id AND v.company_id = 1
LEFT JOIN LATERAL (
    SELECT location FROM positions WHERE device_id = c.device_id ORDER BY time DESC LIMIT 1
) l ON TRUE
WHERE c.company_id = 1
  AND c.command_type IN ('IEngineOn', 'IDoorOn')
  AND NOT EXISTS (
      SELECT 1 FROM alerts a WHERE a.company_id = 1 AND a.type = 'immobilizer_release'
  );

-- ----------------------------------------------------------------------------
-- 7. SLA Alert — unresolved complaint tickets
-- ----------------------------------------------------------------------------
INSERT INTO alerts (company_id, device_id, type, message, location, acknowledged, severity, created_at)
SELECT 1, v.device_id, 'sla_alert',
       'SLA Alert: ticket ' || c.ticket_no || ' (' || c.priority || ') unresolved - ' || c.title,
       l.location, FALSE, 'warning', c.created_at
FROM complaints c
LEFT JOIN vehicles v ON c.vehicle_id = v.id
LEFT JOIN LATERAL (
    SELECT location FROM positions WHERE device_id = v.device_id ORDER BY time DESC LIMIT 1
) l ON TRUE
WHERE c.company_id = 1
  AND c.status IN ('Open', 'In Progress')
  AND NOT EXISTS (
      SELECT 1 FROM alerts a WHERE a.company_id = 1 AND a.type = 'sla_alert'
  );

-- ----------------------------------------------------------------------------
-- 8. Trip Start — dispatched fleet trips
-- ----------------------------------------------------------------------------
INSERT INTO alerts (company_id, device_id, type, message, location, acknowledged, severity, created_at)
SELECT 1, v.device_id, 'trip_start',
       'Trip ' || ft.trip_no || ' started from ' || COALESCE(NULLIF(ft.source, ''), '—') ||
       ' to ' || COALESCE(NULLIF(ft.destination, ''), '—') ||
       COALESCE(' (' || NULLIF(ft.party_name, '') || ')', ''),
       l.location, TRUE, 'info', COALESCE(ft.planned_start, ft.created_at)
FROM fleet_trips ft
LEFT JOIN vehicles v ON ft.vehicle_id = v.id
LEFT JOIN LATERAL (
    SELECT location FROM positions WHERE device_id = v.device_id ORDER BY time DESC LIMIT 1
) l ON TRUE
WHERE ft.company_id = 1
  AND NOT EXISTS (
      SELECT 1 FROM alerts a WHERE a.company_id = 1 AND a.type = 'trip_start'
  );
