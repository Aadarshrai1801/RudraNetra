-- ============================================================================
-- RudraNetra Database Schema Migration 000005 (rollback)
-- ============================================================================

SELECT remove_retention_policy('positions', if_exists => TRUE);
SELECT remove_compression_policy('positions', if_exists => TRUE);

ALTER TABLE positions SET (timescaledb.compress = FALSE);
