#!/usr/bin/env bash
# Production-server smoke test: `next build` + `next start` against the mock Supabase stack, then drives every page and key API.
# Builds into .next-verify so your normal .next is untouched.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(dirname "$HERE")"; TMP="${TMPDIR:-/tmp}/phoenix-verify"; mkdir -p "$TMP"
export JWT_SECRET='test-jwt-secret-at-least-32-characters-long!!' NEXT_DIST_DIR=.next-verify
export NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key CRON_SECRET=test-cron-secret-123
export SUPABASE_SERVICE_ROLE_KEY="$(node -e "const c=require('crypto');const b=o=>Buffer.from(JSON.stringify(o)).toString('base64url');const h=b({alg:'HS256',typ:'JWT'})+'.'+b({role:'service_role',iss:'supabase',exp:4102444800});console.log(h+'.'+c.createHmac('sha256',process.env.JWT_SECRET).update(h).digest('base64url'))")"
cd "$ROOT"
[ -n "${SKIP_BUILD:-}" ] && [ -d .next-verify ] || npx next build || exit 1
bash "$HERE/setup-db.sh" && bash "$HERE/start-stack.sh" || exit 1
( exec setsid nohup npx next start -p 3100 ) < /dev/null > "$TMP/next.log" 2>&1 &
echo $! > "$TMP/next.pid"
for i in $(seq 1 40); do curl -s --max-time 2 -o /dev/null http://127.0.0.1:3100/api/health && break; sleep 1; done
node verification/http-smoke.mjs; status=$?
bash "$HERE/stop-stack.sh"; pkill -f "next-server" 2>/dev/null; exit $status
