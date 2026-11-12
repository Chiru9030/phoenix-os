#!/usr/bin/env bash
# Rebuilds the TEST database from the real migrations plus a tiny stub of Supabase's `auth` schema.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(dirname "$HERE")"
export PGHOST="${PGHOST:-localhost}" PGUSER="${PGUSER:-testuser}" PGPASSWORD="${PGPASSWORD:-test}" PGDATABASE="${PGDATABASE:-phoenix_test}" PGOPTIONS='-c client_min_messages=warning'
pg_isready -q -h "$PGHOST" || { echo "Postgres is not running on $PGHOST. See verification/README.md for the one-time setup."; exit 1; }
psql -v ON_ERROR_STOP=1 -q -c "drop schema if exists public cascade; create schema public; grant all on schema public to public; drop schema if exists auth cascade;"
psql -v ON_ERROR_STOP=1 -q -f "$HERE/supabase-stub.sql"
psql -v ON_ERROR_STOP=1 -q -f "$ROOT/supabase/migrations/0001_schema.sql"
psql -v ON_ERROR_STOP=1 -q -f "$ROOT/supabase/migrations/0002_seed.sql"
psql -q -c "notify pgrst, 'reload schema'" >/dev/null
echo "database rebuilt from migrations"
