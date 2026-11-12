// SMOKE TEST (see verification/README.md): production Next server ⇄ mock Supabase gateway ⇄ PostgREST ⇄ Postgres.
import assert from 'node:assert/strict';
import { createServerClient } from '@supabase/ssr';
const BASE = 'http://127.0.0.1:3100', SB = 'http://127.0.0.1:54321';
let pass = 0; const t = async (name, fn) => { try { await fn(); pass++; console.log('  ✓', name); } catch (e) { console.log('  ✗', name, '\n     ', String(e.message).split('\n')[0]); process.exitCode = 1; } };
const jar = new Map();
const supa = createServerClient(SB, 'anon', { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))) } });
const email = `smoke${Date.now()}@test.com`;
const { error } = await supa.auth.signUp({ email, password: 'correct-horse-battery' });
assert.ifError(error); await new Promise((r) => setTimeout(r, 400));
const cookie = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
const req = (path, { method = 'GET', body, auth = true, headers = {} } = {}) => fetch(BASE + path, { method, redirect: 'manual', headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(auth ? { cookie: cookie() } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
const html = async (p) => { const r = await req(p); const h = await r.text(); return { status: r.status, h, loc: r.headers.get('location') }; };

console.log('public & gatekeeping');
await t('health endpoint reports configuration', async () => { const j = await (await req('/api/health', { auth: false })).json(); assert.equal(j.ok, true); assert.equal(j.supabase, true); assert.equal(j.dungeonMaster, 'offline'); });
await t('security headers are set', async () => { const r = await req('/', { auth: false }); assert.equal(r.headers.get('x-frame-options'), 'DENY'); assert.equal(r.headers.get('x-content-type-options'), 'nosniff'); assert.match(r.headers.get('referrer-policy') ?? '', /strict-origin/); });
await t('landing page renders for visitors', async () => { const r = await html('/'); assert.equal(r.status, 200); assert.match(r.h, /Your life is the game/); });
await t('login/signup/setup render', async () => { for (const p of ['/login', '/signup', '/setup']) assert.equal((await (await req(p, { auth: false })).text()).length > 1000, true); });
await t('private page redirects visitors to /login?next=', async () => { const r = await req('/dashboard', { auth: false }); assert.equal(r.status, 307); assert.match(r.headers.get('location'), /\/login\?next=%2Fdashboard/); });
await t('private API answers 401 JSON to visitors', async () => { const r = await req('/api/day', { auth: false }); assert.equal(r.status, 401); assert.equal((await r.json()).error, 'Unauthorized'); });
await t('cron endpoints refuse requests without the secret', async () => { assert.equal((await req('/api/cron/morning', { auth: false })).status, 401); assert.equal((await req('/api/cron/morning', { auth: false, headers: { authorization: 'Bearer wrong' } })).status, 401); });
await t('signed-in user without a character is sent to /onboarding', async () => { const r = await req('/dashboard'); assert.equal(r.status, 307); assert.match(r.headers.get('location'), /\/onboarding/); });
await t('API refuses play before character creation (409)', async () => assert.equal((await req('/api/day')).status, 409));
await t('onboarding page renders the wizard', async () => { const r = await html('/onboarding'); assert.equal(r.status, 200); assert.match(r.h, /Who walks into the story/); });
await t('character creation validates input (400)', async () => assert.equal((await req('/api/onboarding', { method: 'POST', body: { name: 'A', characterClass: 'Warrior', campaignSlug: 'general' } })).status, 400));
await t('cross-site POST is blocked (403 CSRF)', async () => assert.equal((await req('/api/onboarding', { method: 'POST', headers: { origin: 'https://evil.example' }, body: { name: 'Aria', characterClass: 'Artificer', campaignSlug: 'placement' } })).status, 403));
await t('character is created', async () => { const r = await req('/api/onboarding', { method: 'POST', body: { name: 'Aria', characterClass: 'Artificer', campaignSlug: 'placement', focusStats: ['coding_skill'], difficulty: 'normal', timezone: 'Asia/Kolkata' } }); assert.equal(r.status, 200, await r.clone().text()); });
await t('creating a second character is refused (409)', async () => assert.equal((await req('/api/onboarding', { method: 'POST', body: { name: 'Aria2', characterClass: 'Mage', campaignSlug: 'general' } })).status, 409));
await t('logged-in users are bounced away from /login', async () => { const r = await req('/login'); assert.equal(r.status, 307); assert.match(r.headers.get('location'), /\/dashboard/); });

console.log('real tasks → quests');
let boss, day;
await t('add a boss goal, a main goal and two habits', async () => {
  boss = await (await req('/api/goals', { method: 'POST', body: { title: 'Complete Database Assignment', questType: 'boss_fight', dueDate: new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10) } })).json();
  assert.ok(boss.goal.id);
  await req('/api/goals', { method: 'POST', body: { title: 'Complete Internship Module', questType: 'main' } });
  await req('/api/habits', { method: 'POST', body: { title: 'Read 20 pages', questType: 'side' } });
  await req('/api/habits', { method: 'POST', body: { title: 'Drink 4L Water', questType: 'daily_challenge' } });
});
await t('GET /api/day builds a board from them (+ briefing, weekly boss)', async () => {
  day = await (await req('/api/day')).json();
  const titles = day.quests.map((q) => q.title);
  for (const x of ['Complete Database Assignment', 'Complete Internship Module', 'Read 20 pages', 'Drink 4L Water']) assert.ok(titles.includes(x), `missing ${x}`);
  assert.equal(day.quests.find((q) => q.title === 'Complete Database Assignment').quest_type, 'boss_fight');
  assert.ok(day.briefing.narrative.length > 40); assert.ok(day.boss.max_hp > 0); assert.equal(day.player.level, 1);
});
await t('regenerating the same day is idempotent', async () => { const again = await (await req('/api/day')).json(); assert.deepEqual(again.quests.map((q) => q.id).sort(), day.quests.map((q) => q.id).sort()); });

console.log('every page renders for a signed-in player');
const PAGES = { '/dashboard': [/Today(&#x27;|&#39;|')s quests/, /Aria/], '/quests': [/Quest Board/, /Complete Database Assignment/], '/tasks': [/Goals &amp; Habits/, /New goal/], '/character': [/Attributes/, /Artificer/], '/inventory': [/Inventory/, /Titles/], '/skills': [/Skill Tree/, /Iron Habit/], '/achievements': [/First Victory/], '/story': [/Chapter I/, /Resume Forge/], '/campaigns': [/Fitness Campaign/, /Active/], '/rewards': [/Rewards Shop/, /Watch a movie/], '/reports': [/Weekly Reports/], '/coach': [/AI Coach/], '/guild': [/Found a guild/], '/friends': [/Find a player/], '/leaderboard': [/Leaderboard/, /This week/], '/settings': [/Timezone/, /Sound effects/] };
for (const [p, res] of Object.entries(PAGES)) await t(p, async () => { const r = await html(p); assert.equal(r.status, 200, `status ${r.status}`); assert.doesNotMatch(r.h, /Application error|A wild bug appeared/); for (const re of res) assert.match(r.h, re); });

console.log('playing');
let done;
await t('complete the boss quest through the API', async () => {
  const q = day.quests.find((x) => x.title === 'Complete Database Assignment');
  const r = await req('/api/quests/complete', { method: 'POST', body: { questId: q.id } }); assert.equal(r.status, 200, await r.clone().text());
  done = await r.json(); assert.ok(done.xp >= 100, `boss quest paid only ${done.xp} XP`); assert.ok(done.awards.achievements.some((a) => a.key === 'first_victory')); assert.equal(done.progress.streak.current, 1);
});
await t('completing twice is rejected (409)', async () => assert.equal((await req('/api/quests/complete', { method: 'POST', body: { questId: day.quests.find((x) => x.title === 'Complete Database Assignment').id } })).status, 409));
await t('malformed quest id is rejected (400)', async () => assert.equal((await req('/api/quests/complete', { method: 'POST', body: { questId: 'nope' } })).status, 400));
await t('dashboard now shows the streak and rewards; player leads the leaderboard', async () => { const d = await html('/dashboard'); assert.match(d.h, /Streak/); const l = await html('/leaderboard'); assert.match(l.h, /Aria/); });
await t('quest board lists it under completed', async () => { const r = await html('/quests'); assert.match(r.h, /Completed today/); });
await t('coach answers; crisis message gets the safety reply', async () => {
  const a = await (await req('/api/coach', { method: 'POST', body: { message: 'what should I do today?' } })).json(); assert.ok(a.reply.length > 20);
  const c = await (await req('/api/coach', { method: 'POST', body: { message: 'I want to end my life' } })).json(); assert.match(c.reply, /local emergency/);
});
await t('weekly report generates', async () => { const r = await (await req('/api/reports', { method: 'POST', body: {} })).json(); assert.ok(r.report.summary.length > 20); const p = await html('/reports'); assert.match(p.h, /Weakness/); });
await t('settings save and persist', async () => { const r = await req('/api/settings', { method: 'POST', body: { characterName: 'Aria the Bold', difficulty: 'hardcore', soundEnabled: false } }); assert.equal(r.status, 200); const s = await html('/settings'); assert.match(s.h, /Aria the Bold/); });
await t('cron morning/evening run with the right secret', async () => { const h = { authorization: 'Bearer test-cron-secret-123' }; const m = await (await req('/api/cron/morning', { auth: false, headers: h })).json(); assert.ok(m.processed >= 1); assert.equal(m.failed, 0); const e = await (await req('/api/cron/evening', { auth: false, headers: h })).json(); assert.equal(e.failed, 0); });
await t('sign out clears the session', async () => { const r = await req('/auth/signout', { method: 'POST', headers: { origin: BASE } }); assert.equal(r.status, 303); });
console.log(`\n${pass} checks passed${process.exitCode ? ' — WITH FAILURES' : ''}`);
