#!/bin/bash
# ============================================================================
# RudraNetra PostgreSQL bootstrap.
# Runs migrations and seed data in dependency order on first container start.
# ============================================================================
set -e

PSQL="psql -v ON_ERROR_STOP=1 -U $POSTGRES_USER -d $POSTGRES_DB"

echo "[rudranet] applying migration 000001 (core schema)"
$PSQL -f /migrations/000001_init_schema.up.sql

echo "[rudranet] applying migration 000002 (legacy feature schema)"
$PSQL -f /migrations/000002_legacy_features.up.sql

echo "[rudranet] seeding base dataset"
$PSQL -f /seeds/seed.sql

if [ -f /seeds/seed_org2.sql ]; then
  echo "[rudranet] seeding second tenant dataset"
  $PSQL -f /seeds/seed_org2.sql
fi
if [ -f /seeds/seed_modules.sql ]; then
  echo "[rudranet] seeding module dataset"
  $PSQL -f /seeds/seed_modules.sql
fi
if [ -f /seeds/seed_allied_positions.sql ]; then
  echo "[rudranet] seeding allied positions"
  $PSQL -f /seeds/seed_allied_positions.sql
fi

echo "[rudranet] applying migration 000003 (db-only refactor)"
$PSQL -f /migrations/000003_db_only.up.sql

if [ -f /seeds/seed_db_only.sql ]; then
  echo "[rudranet] seeding DB-only module data"
  $PSQL -f /seeds/seed_db_only.sql
fi

if [ -f /seeds/seed_telemetry_history.sql ]; then
  echo "[rudranet] seeding telemetry history and derived alerts"
  $PSQL -f /seeds/seed_telemetry_history.sql
fi

if [ -f /seeds/seed_alert_catalog.sql ]; then
  echo "[rudranet] seeding full alert catalogue"
  $PSQL -f /seeds/seed_alert_catalog.sql
fi

echo "[rudranet] database bootstrap complete"
