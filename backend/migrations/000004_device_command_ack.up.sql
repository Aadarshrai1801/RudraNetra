-- ============================================================================
-- RudraNetra Database Schema Migration 000004
-- Device command delivery lifecycle: delivered/acknowledged timestamps and the
-- Codec 12 response returned by the hardware.
-- ============================================================================

ALTER TABLE device_commands
    ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS ack_at       TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS response     TEXT;

CREATE INDEX IF NOT EXISTS idx_device_commands_ack ON device_commands(ack_at);
