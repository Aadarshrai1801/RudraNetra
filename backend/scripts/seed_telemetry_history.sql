-- ============================================================================
-- RudraNetra telemetry history seed
-- Generates realistic multi-point tracks for the Allied Transport fleet and
-- derives alert events from those tracks. All data lands in PostgreSQL — the
-- reports, dashboards, playback and notifications read it from there.
-- Safe to re-run: skips when recent telemetry already exists.
-- ============================================================================

DO $$
DECLARE
    recent_points integer;
BEGIN
    SELECT COUNT(*) INTO recent_points
    FROM positions p
    JOIN vehicles v ON v.device_id = p.device_id
    WHERE v.company_id = 1 AND p.time >= NOW() - INTERVAL '24 hours';

    IF recent_points >= 1000 THEN
        RAISE NOTICE 'telemetry history already present (% points), skipping generation', recent_points;
        RETURN;
    END IF;

    -- ------------------------------------------------------------------
    -- 1. Six hours of 10-minute tracks per vehicle (37 points each):
    --    ~70%% moving, ~20%% idling with engine on, ~10%% parked.
    -- ------------------------------------------------------------------
    INSERT INTO positions (
        time, device_id, location, speed, heading, altitude, satellites,
        ignition, gsm_signal, voltage, temperature, odometer,
        fuel_level_pct, backup_battery_v, door_open
    )
    SELECT
        NOW() - (g.i * INTERVAL '10 minutes'),
        v.device_id,
        ST_SetSRID(ST_MakePoint(
            base.lon + (CASE v.id % 4 WHEN 0 THEN 1.0 WHEN 1 THEN -1.0 WHEN 2 THEN 0.3 ELSE -0.3 END) * g.i * 0.00055,
            base.lat + (CASE v.id % 4 WHEN 0 THEN 0.4 WHEN 1 THEN -0.4 WHEN 2 THEN 1.0 ELSE -1.0 END) * g.i * 0.00035
        ), 4326),
        CASE
            WHEN (v.id + g.i) % 10 BETWEEN 5 AND 6 THEN 0::real          -- idling
            WHEN (v.id + g.i) % 10 >= 7 THEN 0::real                     -- parked
            ELSE (25 + ((v.id * 7 + g.i * 13) % 55))::real               -- moving
        END,
        ((v.id * 31 + g.i * 17) % 360)::real,
        (6 + ((v.id + g.i) % 12))::real,
        (9 + ((v.id + g.i) % 8))::smallint,
        CASE
            WHEN (v.id + g.i) % 10 BETWEEN 5 AND 6 THEN TRUE
            WHEN (v.id + g.i) % 10 >= 7 THEN FALSE
            ELSE TRUE
        END,
        (20 + ((v.id + g.i) % 11))::smallint,
        (23.4 + ((v.id + g.i) % 15) * 0.1)::real,
        CASE
            WHEN v.id % 5 = 0 AND (v.id + g.i) % 12 IN (3, 4) THEN -12.0::real   -- reefer breach
            WHEN v.id % 5 = 0 THEN (-18.5 + ((v.id + g.i) % 6) * 0.5)::real      -- reefer normal
            ELSE (22.0 + ((v.id + g.i) % 50) * 0.1)::real                        -- ambient
        END,
        (COALESCE(base.odo, COALESCE(v.odometer, 0) * 1000) + (37 - g.i) * 300)::bigint,
        GREATEST(20, 88 - g.i * 0.7 - (v.id % 10))::real,
        (3.80 + ((v.id + g.i) % 30) * 0.01)::real,
        FALSE
    FROM vehicles v
    JOIN LATERAL (
        SELECT ST_X(location) AS lon, ST_Y(location) AS lat, odometer AS odo
        FROM positions
        WHERE device_id = v.device_id
        ORDER BY time DESC
        LIMIT 1
    ) base ON TRUE
    CROSS JOIN generate_series(0, 36) AS g(i)
    WHERE v.company_id = 1 AND v.device_id IS NOT NULL;

    -- ------------------------------------------------------------------
    -- 2. Replace the synthetic legacy alert rows with events derived from
    --    the telemetry above (real plates, speeds, coordinates and times).
    -- ------------------------------------------------------------------
    DELETE FROM alerts WHERE company_id = 1 AND message LIKE 'Telemetry alert triggered%';

    -- Overspeed events
    INSERT INTO alerts (company_id, device_id, type, message, location, acknowledged, severity, created_at)
    SELECT 1, p.device_id, 'overspeed',
           'Vehicle ' || v.reg_number || ' recorded ' || ROUND(p.speed::numeric, 0) || ' km/h (limit ' ||
           COALESCE(NULLIF(v.max_speed, 0), cs.speed_threshold_kmh) || ' km/h) near ' ||
           ROUND(ST_Y(p.location)::numeric, 4) || ', ' || ROUND(ST_X(p.location)::numeric, 4),
           p.location, FALSE, 'critical', p.time
    FROM positions p
    JOIN vehicles v ON v.device_id = p.device_id AND v.company_id = 1
    LEFT JOIN company_settings cs ON cs.company_id = 1
    WHERE p.time >= NOW() - INTERVAL '24 hours'
      AND p.speed > COALESCE(NULLIF(v.max_speed, 0), cs.speed_threshold_kmh)
    ORDER BY p.time DESC
    LIMIT 15;

    -- Reefer temperature breaches
    INSERT INTO alerts (company_id, device_id, type, message, location, acknowledged, severity, created_at)
    SELECT 1, p.device_id, 'temperature',
           'Reefer unit ' || v.reg_number || ' temperature ' || ROUND(p.temperature::numeric, 1) ||
           '°C exceeded the -15.0°C threshold near ' ||
           ROUND(ST_Y(p.location)::numeric, 4) || ', ' || ROUND(ST_X(p.location)::numeric, 4),
           p.location, FALSE, 'critical', p.time
    FROM positions p
    JOIN vehicles v ON v.device_id = p.device_id AND v.company_id = 1
    WHERE p.time >= NOW() - INTERVAL '24 hours'
      AND p.temperature BETWEEN -14.9 AND -1.0
    ORDER BY p.time DESC
    LIMIT 8;

    -- Currently idling vehicles
    INSERT INTO alerts (company_id, device_id, type, message, location, acknowledged, severity, created_at)
    SELECT 1, l.device_id, 'idle',
           'Vehicle ' || v.reg_number || ' idling with ignition ON near ' ||
           ROUND(ST_Y(l.location)::numeric, 4) || ', ' || ROUND(ST_X(l.location)::numeric, 4),
           l.location, FALSE, 'warning', l.time
    FROM (
        SELECT DISTINCT ON (p.device_id) p.device_id, p.location, p.time, p.ignition, p.speed
        FROM positions p
        WHERE p.time >= NOW() - INTERVAL '24 hours'
        ORDER BY p.device_id, p.time DESC
    ) l
    JOIN vehicles v ON v.device_id = l.device_id AND v.company_id = 1
    WHERE l.ignition AND l.speed <= 2
    ORDER BY l.time DESC
    LIMIT 10;

    -- Vehicles currently inside a geofence zone
    INSERT INTO alerts (company_id, device_id, type, message, location, acknowledged, severity, created_at)
    SELECT 1, l.device_id, 'geofence',
           'Vehicle ' || v.reg_number || ' inside "' || g.name || '"',
           l.location, TRUE, 'info', l.time
    FROM (
        SELECT DISTINCT ON (p.device_id) p.device_id, p.location, p.time
        FROM positions p
        WHERE p.time >= NOW() - INTERVAL '24 hours'
        ORDER BY p.device_id, p.time DESC
    ) l
    JOIN vehicles v ON v.device_id = l.device_id AND v.company_id = 1
    JOIN LATERAL (
        SELECT gz.name FROM geofences gz
        WHERE gz.company_id = 1 AND gz.is_active = TRUE AND ST_Contains(gz.geom, l.location)
        ORDER BY gz.id
        LIMIT 1
    ) g ON TRUE
    ORDER BY l.time DESC
    LIMIT 8;

    RAISE NOTICE 'telemetry history and derived alerts generated';
END $$;
