#!/bin/bash
# ============================================================================
# RudraNetra PostgreSQL bootstrap.
# Runs migrations and reference/registry seed data in dependency order on
# first container start.
#
# Telemetry is DEVICE-FED ONLY: no simulated position history, alerts, raw
# packets, command logs or fuel ledger are left behind. Positions and event
# logs start empty and are filled exclusively by real trackers connecting to
# rudra-ingest (TCP 5040).
#
# Optional demo datasets live in backend/scripts/ (seed_telemetry_history.sql,
# seed_alert_catalog.sql, seed_allied_positions.sql). Run them manually only
# when you want a populated demo environment.
# ============================================================================
set -e

PSQL="psql -v ON_ERROR_STOP=1 -U $POSTGRES_USER -d $POSTGRES_DB"

echo "[rudranet] applying migration 000001 (core schema)"
$PSQL -f /migrations/000001_init_schema.up.sql

echo "[rudranet] applying migration 000002 (legacy feature schema)"
$PSQL -f /migrations/000002_legacy_features.up.sql

echo "[rudranet] seeding base registry dataset"
$PSQL -f /seeds/seed.sql

if [ -f /seeds/seed_org2.sql ]; then
  echo "[rudranet] seeding second tenant registry"
  $PSQL -f /seeds/seed_org2.sql
fi
if [ -f /seeds/seed_modules.sql ]; then
  echo "[rudranet] seeding module registry data"
  $PSQL -f /seeds/seed_modules.sql
fi

echo "[rudranet] applying migration 000003 (db-only refactor)"
$PSQL -f /migrations/000003_db_only.up.sql

echo "[rudranet] applying migration 000004 (device command lifecycle)"
$PSQL -f /migrations/000004_device_command_ack.up.sql

echo "[rudranet] applying migration 000005 (timescale compression/retention)"
$PSQL -f /migrations/000005_timescale_policies.up.sql

if [ -f /seeds/seed_db_only.sql ]; then
  echo "[rudranet] seeding DB-only module data"
  $PSQL -f /seeds/seed_db_only.sql
fi

echo "[rudranet] purging imported/simulated telemetry (device-fed only)"
$PSQL <<'SQL'
TRUNCATE positions;
TRUNCATE alerts;
TRUNCATE raw_packets;
TRUNCATE device_commands;
TRUNCATE fuel_records;
UPDATE devices SET last_heartbeat = NULL;
SQL

echo "[rudranet] database bootstrap complete (telemetry empty until devices connect)"
