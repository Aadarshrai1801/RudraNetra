-- ============================================================================
-- RudraNetra Database Schema Migration 000003 (rollback)
-- ============================================================================

DROP TABLE IF EXISTS roles;
DROP TABLE IF EXISTS company_settings;

DROP TABLE IF EXISTS sms_config;
DROP TABLE IF EXISTS routes;
DROP TABLE IF EXISTS vehicle_group_members;
DROP TABLE IF EXISTS vehicle_groups;

ALTER TABLE invoices
    DROP COLUMN IF EXISTS notes,
    DROP COLUMN IF EXISTS period_end,
    DROP COLUMN IF EXISTS period_start,
    DROP COLUMN IF EXISTS rate_per_device,
    DROP COLUMN IF EXISTS device_count,
    DROP COLUMN IF EXISTS plan;

ALTER TABLE alert_rules DROP COLUMN IF EXISTS description;
ALTER TABLE alerts DROP COLUMN IF EXISTS severity;

ALTER TABLE positions
    DROP COLUMN IF EXISTS door_open,
    DROP COLUMN IF EXISTS backup_battery_v,
    DROP COLUMN IF EXISTS fuel_level_pct;

ALTER TABLE devices DROP COLUMN IF EXISTS sim_operator;

ALTER TABLE companies
    DROP COLUMN IF EXISTS api_key,
    DROP COLUMN IF EXISTS sira_relay,
    DROP COLUMN IF EXISTS max_users,
    DROP COLUMN IF EXISTS max_devices;
