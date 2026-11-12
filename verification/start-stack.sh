#!/usr/bin/env bash
# Starts PostgREST (:3001) and the mock Supabase gateway (:54321). Safe to re-run.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; TMP="${TMPDIR:-/tmp}/phoenix-verify"; mkdir -p "$TMP"
export JWT_SECRET='test-jwt-secret-at-least-32-characters-long!!'
POSTGREST_BIN="${POSTGREST_BIN:-postgrest}"
command -v "$POSTGREST_BIN" >/dev/null || { echo "PostgREST not found. Download a release from https://github.com/PostgREST/postgrest/releases and set POSTGREST_BIN=/path/to/postgrest"; exit 1; }
bash "$HERE/stop-stack.sh"
cat > "$TMP/pgrst.conf" << EOC
db-uri = "postgres://authenticator:authpw@${PGHOST:-localhost}:5432/${PGDATABASE:-phoenix_test}"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$JWT_SECRET"
server-port = 3001
db-pool = 10
EOC
( exec setsid nohup "$POSTGREST_BIN" "$TMP/pgrst.conf" ) < /dev/null > "$TMP/postgrest.log" 2>&1 &
echo $! > "$TMP/postgrest.pid"
( cd "$HERE" && exec setsid nohup node mock-supabase.mjs ) < /dev/null > "$TMP/gateway.log" 2>&1 &
echo $! > "$TMP/gateway.pid"
for i in $(seq 1 25); do curl -s --max-time 2 -o /dev/null http://127.0.0.1:3001/ && curl -s --max-time 2 -o /dev/null http://127.0.0.1:54321/auth/v1/user && { echo "stack is up (PostgREST :3001, gateway :54321)"; exit 0; }; sleep 1; done
echo "stack failed to start; see $TMP/postgrest.log and $TMP/gateway.log"; exit 1
