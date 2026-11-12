#!/usr/bin/env bash
# Everything: unit tests, typecheck, integration suite, production smoke test.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(dirname "$HERE")"; cd "$ROOT"
echo "── typecheck";    npx tsc --noEmit
echo "── unit tests";   npm test --silent
echo "── integration";  bash "$HERE/run-integration.sh"
echo "── smoke";        bash "$HERE/run-smoke.sh"
echo "all verification passed"
