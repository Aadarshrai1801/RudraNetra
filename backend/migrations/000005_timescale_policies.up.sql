-- ============================================================================
-- RudraNetra Database Schema Migration 000005
-- TimescaleDB lifecycle: compress raw positions after 30 days and retain
-- them for 2 years so the hypertable does not grow unbounded.
-- ============================================================================

ALTER TABLE positions SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'device_id',
    timescaledb.compress_orderby = 'time DESC'
);

SELECT add_compression_policy('positions', INTERVAL '30 days', if_not_exists => TRUE);
SELECT add_retention_policy('positions', INTERVAL '730 days', if_not_exists => TRUE);
