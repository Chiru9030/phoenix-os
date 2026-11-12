# Verification harness

Optional. These scripts are how Phoenix OS was tested end to end **without a hosted Supabase project**. They stand up a
local stand-in for Supabase and run the real application code against it.

```
Next.js app  ──▶  mock gateway (:54321)  ──▶  /rest/v1/*  → real PostgREST (:3001) → real Postgres (your migrations + RLS)
                                          └─▶  /auth/v1/*  → minimal GoTrue stand-in (password auth, JWTs)
```

## One-time setup
1. A local **Postgres 16** with a superuser the scripts can use (defaults; override with `PGHOST`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`):
   ```bash
   createuser -s testuser && psql -c "alter role testuser password 'test'" && createdb -O testuser phoenix_test
   ```
2. A **PostgREST 12** binary: https://github.com/PostgREST/postgrest/releases (the static Linux build works). Then `export POSTGREST_BIN=/path/to/postgrest`.
3. `npm install` in the project root.

## Run
| Command | What it does |
|---|---|
| `npm run verify:integration` | Rebuilds the DB from `supabase/migrations/*.sql`, then runs 15 service-level scenarios (`service.test.ts`). |
| `npm run verify:smoke` | `next build` into `.next-verify`, starts the production server, and runs 44 HTTP checks (`http-smoke.mjs`). `SKIP_BUILD=1` reuses the build. |
| `npm run verify` | Typecheck + unit tests + both of the above. |

The database used is **only** the throwaway `phoenix_test`. `setup-db.sh` drops and recreates its `public` and `auth` schemas every run, so never point it at a database you care about.

## What the integration suite covers
Onboarding & validation · goals/habits → quests (idempotent, race-safe) · quest completion (rewards, streak, achievements, boss damage, all-clear bonus
paid once) · 6-way simultaneous completions never losing XP · multi-day streaks with an injected clock (freeze, break, expiry, boss flee/respawn) · level-ups, skill points and
skill rules · gold economy and discounts · inventory/equipment · all six random events · boss defeat paid exactly once · story chapter sequencing · tag-count achievements ·
weekly report · AI coach (+ crisis safety, rate limit) · guilds · friends and XP duels (escrow, settlement, ties) · leaderboards · cron jobs · and the **ledger invariant**:
for every player, lifetime XP equals the sum of the XP ledger and gold equals the sum of the gold ledger.

## What it does *not* cover
Real Supabase/GoTrue behaviour (OAuth providers, email delivery, JWT key rotation), live LLM calls, OneSignal/PostHog/Sentry delivery, real-browser interaction beyond headless rendering, and load.
