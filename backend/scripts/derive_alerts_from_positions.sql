-- ============================================================================
-- Derive alerts from real stored positions.
-- Removes the generic legacy "Telemetry alert triggered on device #NNN" rows
-- and raises events computed from the telemetry itself: prolonged idling,
-- overspeed and geofence occupancy. Everything is derived from real position
-- rows; nothing is fabricated.
-- Safe to re-run: each section is guarded by NOT EXISTS on its alert type.
-- ============================================================================

-- 1. Generic legacy rows (all identical, 718 of them on #102) are not events.
DELETE FROM alerts WHERE type = 'Telemetry alert triggered';

-- ----------------------------------------------------------------------------
-- 2. Prolonged idling — longest stationary-with-ignition interval per vehicle
-- ----------------------------------------------------------------------------
INSERT INTO alerts (company_id, device_id, type, message, location, acknowledged, severity, created_at)
SELECT 1, x.device_id, 'over_idle',
       'Vehicle ' || COALESCE(v.reg_number, '') || ' idling with ignition ON for ' ||
       ROUND(EXTRACT(EPOCH FROM (x.time - x.prev)) / 60)::int || ' minutes near ' ||
       ROUND(ST_Y(x.location)::numeric, 4) || ', ' || ROUND(ST_X(x.location)::numeric, 4),
       x.location, FALSE, 'warning', x.time
FROM (
    SELECT DISTINCT ON (device_id) device_id, time, location, prev
    FROM (
        SELECT p.device_id, p.time, p.location,
               (p.ignition AND p.speed <= 2) AS is_idle,
               LAG(p.time) OVER (PARTITION BY p.device_id ORDER BY p.time) AS prev
        FROM positions p
        WHERE p.location IS NOT NULL
    ) q
    WHERE is_idle
      AND prev IS NOT NULL
      AND time - prev >= INTERVAL '5 minutes'
      AND time - prev <= INTERVAL '2 hours'
    ORDER BY device_id, (time - prev) DESC
) x
JOIN vehicles v ON v.device_id = x.device_id AND v.company_id = 1
WHERE NOT EXISTS (
    SELECT 1 FROM alerts a WHERE a.company_id = 1 AND a.type = 'over_idle'
);

-- ----------------------------------------------------------------------------
-- 3. Overspeed — recorded position above the vehicle limit
-- ----------------------------------------------------------------------------
INSERT INTO alerts (company_id, device_id, type, message, location, acknowledged, severity, created_at)
SELECT 1, p.device_id, 'overspeed',
       'Vehicle ' || COALESCE(v.reg_number, '') || ' recorded ' || ROUND(p.speed::numeric) ||
       ' km/h (limit ' || COALESCE(NULLIF(v.max_speed, 0), 80) || ' km/h) near ' ||
       ROUND(ST_Y(p.location)::numeric, 4) || ', ' || ROUND(ST_X(p.location)::numeric, 4),
       p.location, FALSE, 'critical', p.time
FROM positions p
JOIN vehicles v ON v.device_id = p.device_id AND v.company_id = 1
WHERE p.speed > COALESCE(NULLIF(v.max_speed, 0), 80)
  AND NOT EXISTS (
      SELECT 1 FROM alerts a WHERE a.company_id = 1 AND a.type = 'overspeed'
  )
ORDER BY p.speed DESC
LIMIT 50;

-- ----------------------------------------------------------------------------
-- 4. Geofence occupancy — latest position inside a registered zone
-- ----------------------------------------------------------------------------
INSERT INTO alerts (company_id, device_id, type, message, location, acknowledged, severity, created_at)
SELECT 1, l.device_id, 'geofence',
       'Vehicle ' || COALESCE(v.reg_number, '') || ' inside "' || g.name || '"',
       l.location, TRUE, 'info', l.time
FROM (
    SELECT DISTINCT ON (p.device_id) p.device_id, p.location, p.time
    FROM positions p
    ORDER BY p.device_id, p.time DESC
) l
JOIN vehicles v ON v.device_id = l.device_id AND v.company_id = 1
JOIN LATERAL (
    SELECT gz.name FROM geofences gz
    WHERE gz.company_id = 1 AND gz.is_active = TRUE AND ST_Contains(gz.geom, l.location)
    ORDER BY gz.id
    LIMIT 1
) g ON TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM alerts a WHERE a.company_id = 1 AND a.type = 'geofence'
)
LIMIT 60;
