#!/usr/bin/env bash
# Service-level integration suite: real services → real PostgREST → real Postgres (RLS schema, RPCs, races, multi-day clocks).
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(dirname "$HERE")"
bash "$HERE/setup-db.sh" && bash "$HERE/start-stack.sh" || exit 1
cd "$ROOT"; npx tsx --test verification/service.test.ts; status=$?
bash "$HERE/stop-stack.sh"; exit $status
