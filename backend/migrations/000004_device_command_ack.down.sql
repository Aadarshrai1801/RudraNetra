-- ============================================================================
-- RudraNetra Database Schema Migration 000004 (rollback)
-- ============================================================================

DROP INDEX IF EXISTS idx_device_commands_ack;

ALTER TABLE device_commands
    DROP COLUMN IF EXISTS response,
    DROP COLUMN IF EXISTS ack_at,
    DROP COLUMN IF EXISTS delivered_at;
