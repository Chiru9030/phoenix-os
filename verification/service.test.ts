// INTEGRATION SUITE (see verification/README.md). Real services → real PostgREST → real Postgres + RLS schema.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { HybridDungeonMaster } from '@/lib/ai/hybrid';
import { CRISIS_REPLY } from '@/lib/ai/sanitize';
import { createCharacter, loadPlayer, switchCampaign, OnboardSchema, type OnboardInput, type Player } from '@/lib/server/player';
import { ensureDailyState } from '@/lib/server/daily';
import { completeQuest } from '@/lib/server/quests';
import * as A from '@/lib/server/actions';
import * as S from '@/lib/server/social';
import { grantProgress, runAwards } from '@/lib/server/progress';
import { coachChat, ensureLastWeekReport, generateReport } from '@/lib/server/reports';
import { runEvening, runMorning } from '@/lib/server/cron';
import { HttpError } from '@/lib/server/util';
import { maxHpFor } from '@/lib/game/bosses';
import { xpToClearLevel } from '@/lib/game/xp';

const PG = { host: process.env.PGHOST || 'localhost', user: process.env.PGUSER || 'testuser', db: process.env.PGDATABASE || 'phoenix_test', pass: process.env.PGPASSWORD || 'test' };
const SECRET = 'test-jwt-secret-at-least-32-characters-long!!';
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ role: 'service_role', iss: 'supabase', exp: 4102444800 })}`;
const token = `${jwt}.${crypto.createHmac('sha256', SECRET).update(jwt).digest('base64url')}`;
const db = createClient('http://127.0.0.1:54321', token, { auth: { persistSession: false } });
const psql = (sql: string) => execFileSync('psql', ['-h', PG.host, '-U', PG.user, '-d', PG.db, '-tAqc', sql], { env: { ...process.env, PGPASSWORD: PG.pass } }).toString().trim();
const dm = new HybridDungeonMaster(null);
const D0 = new Date('2026-10-28T06:30:00Z'); // Wednesday 12:00 IST
const day = (n: number) => new Date(D0.getTime() + n * 86_400_000);
const iso = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
const withRandom = async <T,>(v: number, fn: () => Promise<T>) => { const o = Math.random; Math.random = () => v; try { return await fn(); } finally { Math.random = o; } };
const base: OnboardInput = { name: 'Alice', characterClass: 'Artificer', campaignSlug: 'placement', focusStats: ['coding_skill'], difficulty: 'normal', timezone: 'Asia/Kolkata' };
let n = 0;
async function mk(name: string, over: Partial<OnboardInput> = {}): Promise<Player> {
  const id = crypto.randomUUID(); psql(`insert into auth.users (id,email) values ('${id}','${name.toLowerCase()}${++n}@test.com')`);
  return createCharacter(db, id, { ...base, name, ...over });
}
const fresh = async (p: Player) => (await loadPlayer(db, p.profile.id))!;
async function credit(p: Player, xp: number, gold = 0) {
  const r = await grantProgress(db, p.character.id, { xp, gold });
  if (xp) await db.from('xp_log').insert({ character_id: p.character.id, source: 'test', amount: xp });
  if (gold) await db.from('gold_transactions').insert({ character_id: p.character.id, amount: gold, reason: 'test' });
  return r;
}
const rejects = (fn: () => Promise<unknown>, status: number, msg?: RegExp) => assert.rejects(fn, (e: unknown) => e instanceof HttpError && e.status === status && (!msg || msg.test(e.message)), `expected HttpError ${status}`);
const S1: { alice?: Player; bob?: Player } = {};

test('onboarding: character, class stats, story seeding, validation, duplicates', async () => {
  const a = S1.alice = await mk('Alice');
  assert.equal(a.character.level, 1); assert.equal(a.character.gold, 100);
  assert.deepEqual([a.stats.coding_skill, a.stats.intelligence, a.stats.strength], [3, 2, 0]);
  assert.equal(a.campaign?.slug, 'placement');
  assert.equal(psql(`select string_agg(status, ',' order by chapter_number) from character_story_progress p join story_chapters c on c.id = p.chapter_id where p.character_id='${a.character.id}'`), 'unlocked,locked,locked');
  await rejects(() => createCharacter(db, a.profile.id, base), 409);
  assert.equal(OnboardSchema.safeParse({ ...base, name: 'A' }).success, false);
  assert.equal(OnboardSchema.safeParse({ ...base, campaignSlug: 'nope' }).success, false);
  assert.equal(OnboardSchema.safeParse({ ...base, focusStats: ['strength', 'wisdom', 'health', 'finance'] }).success, false);
  S1.bob = await mk('Bob', { characterClass: 'Warrior', campaignSlug: 'fitness' });
  assert.equal(S1.bob.stats.strength, 3);
});

test('daily board: real goals + habits become quests, idempotent, race-safe, boss spawned', async () => {
  const a = S1.alice!;
  const boss = await A.createGoal(db, a, { title: 'Complete Database Assignment', questType: 'boss_fight', dueDate: iso(day(2)), tags: [] });
  const main = await A.createGoal(db, a, { title: 'Complete Internship Module', questType: 'main', dueDate: iso(day(1)), tags: [] });
  await A.createHabit(db, a, { title: 'Read 20 pages', questType: 'side', daysOfWeek: [0, 1, 2, 3, 4, 5, 6] });
  await A.createHabit(db, a, { title: 'Drink 4L Water', questType: 'daily_challenge', daysOfWeek: [0, 1, 2, 3, 4, 5, 6] });
  await A.createHabit(db, a, { title: 'Sunday only chore', questType: 'side', daysOfWeek: [0] }); // not scheduled on a Wednesday
  const racers = await Promise.all([1, 2, 3, 4].map(() => ensureDailyState(db, a, dm, D0)));
  const d = await ensureDailyState(db, a, dm, D0);
  assert.equal(d.today, '2026-10-28');
  assert.ok(racers.every((r) => r.quests.length === d.quests.length), 'racing requests all saw the full board');
  const byGoal = (id: string) => d.quests.find((q) => q.goal_id === id)!;
  assert.equal(byGoal(boss.goal.id).quest_type, 'boss_fight'); assert.equal(byGoal(boss.goal.id).title, 'Complete Database Assignment');
  assert.equal(byGoal(main.goal.id).quest_type, 'main');
  assert.ok(d.quests.some((q) => q.title === 'Read 20 pages') && d.quests.some((q) => q.quest_type === 'daily_challenge' && q.title === 'Drink 4L Water'));
  assert.ok(!d.quests.some((q) => q.title === 'Sunday only chore'));
  assert.equal(psql(`select count(*) - count(distinct title) from quests where character_id='${a.character.id}'`), '0');
  assert.ok(d.quests.every((q) => q.xp_reward > 0 && q.gold_reward > 0));
  assert.ok(d.briefing && d.briefing.narrative.includes('Complete Database Assignment'), d.briefing?.narrative);
  assert.ok(d.boss && d.boss.max_hp === maxHpFor(1, 'normal') && d.boss.current_hp === d.boss.max_hp);
  assert.equal(psql(`select count(*) from boss_battles where character_id='${a.character.id}' and status='active' and not is_hidden`), '1');
  // a goal added mid-day lands on today's board at once, exactly once
  const late = await A.createGoal(db, a, { title: 'Email the professor', questType: 'side', tags: [] }, D0);
  assert.equal(late.onBoard, true);
  assert.equal(psql(`select count(*) from quests where goal_id='${late.goal.id}'`), '1');
});

test('completing quests: rewards, streak, achievements, boss damage, all-clear bonus, idempotency, isolation', async () => {
  const a = S1.alice!, b = S1.bob!;
  const day1 = await ensureDailyState(db, a, dm, D0);
  const quest = day1.quests.find((q) => q.quest_type === 'main')!;
  await rejects(() => completeQuest(db, b, quest.id, D0), 404, /not found/i); // Bob cannot touch Alice's quest
  const r = await completeQuest(db, a, quest.id, D0);
  assert.equal(r.xp, quest.xp_reward); assert.equal(r.quest.id, quest.id);
  assert.equal(r.progress.streak?.current, 1);
  assert.ok(r.awards.achievements.some((x) => x.key === 'first_victory'), 'first victory');
  assert.deepEqual(r.awards.titles, ['The Beginner']);
  assert.ok(r.bosses.length === 1 && r.bosses[0].damage === r.xp && r.bosses[0].currentHp === r.bosses[0].maxHp - r.xp);
  const p2 = await fresh(a);
  assert.equal(p2.character.lifetime_xp, r.xp + 25); // quest XP + first_victory reward
  assert.equal(p2.character.gold, 100 + r.gold + 20);
  assert.ok(Math.abs(p2.stats.discipline - (a.stats.discipline + (quest.stat_rewards.discipline ?? 0))) < 1e-6);
  assert.equal(psql(`select status from goals where id='${quest.goal_id}'`), 'done');
  await rejects(() => completeQuest(db, a, quest.id, D0), 409, /already completed/);
  // finish the board: the last quest pays the all-clear bonus
  const rest = day1.quests.filter((q) => q.id !== quest.id);
  let cleared = 0, last;
  for (const q of rest) { last = await completeQuest(db, a, q.id, D0); if (last.dayCleared) cleared++; }
  assert.equal(cleared, 1); assert.ok(last!.dayCleared!.xp === 50);
  assert.equal(psql(`select count(*) from quests where character_id='${a.character.id}' and status='pending' and quest_date='2026-10-28'`), '0');
  assert.equal((await fresh(a)).streak.current_streak, 1); // five completions on one day: still one streak day
});

test('concurrency: many quests completed at the same instant never lose rewards', async () => {
  const p = await mk('Racer');
  for (const t of ['Gym session', 'Read a book', 'Write code', 'Meditate', 'Walk', 'Stretch']) await A.createHabit(db, p, { title: t, questType: 'side', daysOfWeek: [0, 1, 2, 3, 4, 5, 6] });
  const d = await ensureDailyState(db, p, dm, D0);
  const results = await Promise.all(d.quests.map((q) => completeQuest(db, p, q.id, D0)));
  assert.equal(results.length, d.quests.length);
  const f = await fresh(p);
  const ledger = Number(psql(`select coalesce(sum(amount),0) from xp_log where character_id='${p.character.id}'`));
  assert.equal(f.character.lifetime_xp, ledger, 'lifetime XP equals the XP ledger even under a 6-way race');
  assert.equal(f.streak.current_streak, 1);
  assert.equal(results.filter((r) => r.dayCleared).length, 1, 'all-clear bonus paid exactly once');
});

test('streaks across days (freeze, break), expiry of missed quests, boss flee + respawn', async () => {
  const p = await mk('Walker');
  await A.createHabit(db, p, { title: 'Daily push-ups', questType: 'side', daysOfWeek: [0, 1, 2, 3, 4, 5, 6] });
  const finishOne = async (n: number) => { const d = await ensureDailyState(db, p, dm, day(n)); return completeQuest(db, p, d.quests.find((q) => q.title === 'Daily push-ups')!.id, day(n)); };
  assert.equal((await finishOne(0)).progress.streak?.current, 1);
  assert.equal((await finishOne(1)).progress.streak?.current, 2);
  const skipped = await ensureDailyState(db, p, dm, day(2)); // day 2: player does nothing
  const f3 = await finishOne(3); // missed exactly one day → freeze token covers it
  assert.deepEqual([f3.progress.streak?.current, f3.progress.streak?.freezeUsed], [3, true]);
  assert.equal((await fresh(p)).streak.freeze_tokens, 0);
  assert.equal(psql(`select count(*) from quests where character_id='${p.character.id}' and quest_date='2026-10-30' and status='expired'`), String(skipped.quests.length));
  await ensureDailyState(db, p, dm, day(8)); // a long gap, then play again
  const back = await finishOne(8);
  assert.deepEqual([back.progress.streak?.current, back.progress.streak?.broken], [1, true]);
  assert.equal((await fresh(p)).streak.longest_streak, 3);
  // the week-1 boss fled after 7 days; a fresh one took its place
  assert.equal(psql(`select count(*) from boss_battles where character_id='${p.character.id}' and status='fled'`), '1');
  assert.equal(psql(`select count(*) from boss_battles where character_id='${p.character.id}' and status='active' and not is_hidden`), '1');
});

test('level-ups, skill points, skill unlock rules, and bonuses actually apply', async () => {
  const p = await mk('Leveler');
  const up = await credit(p, [1, 2, 3, 4].reduce((a, l) => a + xpToClearLevel(l), 0) + 5); // clears levels 1-4 → level 5
  assert.equal(up.levelAfter, 5); assert.equal(up.skillPointsGained, 1 + 1 + 1 + 2);
  const r0 = await fresh(p); assert.equal(r0.points.available, 5);
  await rejects(() => A.unlockSkill(db, r0, 'str_t2_second_wind'), 400, /previous tier/);
  await A.unlockSkill(db, r0, 'str_t1_iron_habit');
  await A.unlockSkill(db, r0, 'str_t2_second_wind'); // 1 + 2 points
  await rejects(() => A.unlockSkill(db, r0, 'str_t3_titan_form'), 400, /point/); // needs 3, only 2 left
  await rejects(() => A.unlockSkill(db, r0, 'str_t1_iron_habit'), 400, /Already/);
  await rejects(() => A.unlockSkill(db, r0, 'nope'), 404);
  const f = await fresh(p); assert.deepEqual([f.points.available, f.points.spent], [2, 3]);
  assert.ok((await runAwards(db, { characterId: p.character.id, userId: p.profile.id, campaignId: f.character.active_campaign_id })).achievements.length === 0, 'skill_initiate already paid out');
  assert.equal(psql(`select count(*) from character_achievements a join achievements x on x.id=a.achievement_id where a.character_id='${p.character.id}' and x.key='skill_initiate'`), '1');
  // Iron Habit: +10% Strength on a gym quest (base 2 → 2.2)
  await A.createHabit(db, f, { title: 'Gym legs day', questType: 'side', daysOfWeek: [0, 1, 2, 3, 4, 5, 6] }, D0);
  const d = await ensureDailyState(db, f, dm, D0);
  const gym = d.quests.find((q) => q.title === 'Gym legs day')!;
  const before = (await fresh(f)).stats.strength;
  const done = await completeQuest(db, f, gym.id, D0);
  assert.equal(done.stats.strength, 2.2);
  assert.ok(Math.abs((await fresh(f)).stats.strength - before - 2.2) < 1e-6);
});

test('gold economy: redeem, custom rewards, Investor discount, ledger', async () => {
  const p = await mk('Shopper');
  await rejects(() => A.redeem(db, p, { kind: 'default', index: 0 }), 402, /500 Gold/); // movie costs 500, we have 100
  const r = (await A.createReward(db, p, { label: 'Fancy coffee', goldCost: 100 })) as { id: string };
  const ok = await A.redeem(db, p, { kind: 'custom', id: r.id });
  assert.deepEqual([ok.price, ok.goldLeft], [100, 0]);
  await rejects(() => A.redeem(db, p, { kind: 'custom', id: r.id }), 402);
  await credit(p, 0, 1000);
  psql(`update character_skill_points set available_points = 5 where character_id='${p.character.id}'`);
  await A.unlockSkill(db, await fresh(p), 'fin_t1_budgeter'); await A.unlockSkill(db, await fresh(p), 'fin_t2_investor');
  const disc = await A.redeem(db, await fresh(p), { kind: 'custom', id: r.id });
  assert.equal(disc.price, 90); // Investor: 10% off
  const other = await mk('Thief');
  await rejects(() => A.redeem(db, other, { kind: 'custom', id: r.id }), 404); // someone else's reward
  assert.equal(psql(`select count(*) from reward_redemptions where character_id='${p.character.id}'`), '2');
});

test('inventory: use consumables, stacking, equip slots and passive gear bonuses', async () => {
  const p = await mk('Packrat'); const cid = p.character.id;
  await db.rpc('grant_item', { p_character: cid, p_item_key: 'knowledge_scroll', p_qty: 1 }); await db.rpc('grant_item', { p_character: cid, p_item_key: 'knowledge_scroll', p_qty: 1 });
  const u = await A.useItem(db, p, 'knowledge_scroll'); assert.equal(u.xp, 40);
  assert.equal(psql(`select quantity from character_inventory where character_id='${cid}'`), '1');
  await A.useItem(db, p, 'knowledge_scroll');
  await rejects(() => A.useItem(db, p, 'knowledge_scroll'), 404);
  await rejects(() => A.useItem(db, p, 'discipline_shield'), 400); // gear is not consumable
  await db.rpc('grant_item', { p_character: cid, p_item_key: 'sword_of_persistence' }); await db.rpc('grant_item', { p_character: cid, p_item_key: 'sword_of_confidence' });
  await A.equipItem(db, p, 'sword_of_persistence', true); await A.equipItem(db, p, 'sword_of_confidence', true);
  assert.equal(psql(`select string_agg(i.key, ',') from character_inventory ci join items i on i.id=ci.item_id where ci.character_id='${cid}' and ci.equipped`), 'sword_of_confidence'); // one weapon at a time
  await rejects(() => A.equipItem(db, p, 'golden_badge', true), 404); // not owned
  await db.rpc('grant_item', { p_character: cid, p_item_key: 'streak_charm' });
  const before = (await fresh(p)).streak.freeze_tokens; await A.useItem(db, p, 'streak_charm');
  assert.equal((await fresh(p)).streak.freeze_tokens, Math.min(3, before + 1));
  // passive: Sword of Confidence = +10% Communication on a networking quest (base 1.5 → 1.65)
  await A.createHabit(db, p, { title: 'Network on LinkedIn', questType: 'side', daysOfWeek: [0, 1, 2, 3, 4, 5, 6] });
  const d = await ensureDailyState(db, await fresh(p), dm, D0);
  const done = await completeQuest(db, await fresh(p), d.quests.find((q) => q.title === 'Network on LinkedIn')!.id, D0);
  assert.equal(done.stats.communication, 1.65);
  assert.equal(await A.equipTitle(db, p, null), null);
  await rejects(() => A.equipTitle(db, p, 'phoenix_ascendant'), 403); // not earned
});

test('random events: double XP, treasure chest, secret quest, hidden boss, lucky spin, weekend festival', async () => {
  const dbl = await mk('Doubler'); await A.createHabit(db, dbl, { title: 'Gym session', questType: 'side', daysOfWeek: [0, 1, 2, 3, 4, 5, 6] });
  const dd = await withRandom(0.83, () => ensureDailyState(db, dbl, dm, D0));
  assert.equal(dd.event?.event_type, 'double_xp'); assert.ok(dd.quests.every((q) => q.double_xp));
  const g = dd.quests.find((q) => q.title === 'Gym session')!; const rr = await completeQuest(db, dbl, g.id, D0);
  assert.equal(rr.xp, g.xp_reward * 2); assert.ok(rr.bonuses.some((b) => b.includes('Double XP')));

  const chest = await mk('Chesty'); const cd = await withRandom(0.93, () => ensureDailyState(db, chest, dm, D0));
  assert.equal(cd.event?.event_type, 'treasure_chest'); assert.equal((await fresh(chest)).character.gold, 175);

  const sec = await mk('Secretive'); const sd = await withRandom(0.88, () => ensureDailyState(db, sec, dm, D0));
  const secret = sd.quests.find((q) => q.source === 'event')!; assert.ok(secret.title.startsWith('Secret Quest'));

  const hid = await mk('Hunter'); await A.createHabit(db, hid, { title: 'Walk', questType: 'side', daysOfWeek: [0, 1, 2, 3, 4, 5, 6] });
  const hd = await withRandom(0.995, () => ensureDailyState(db, hid, dm, D0));
  assert.ok(hd.hiddenBoss && hd.boss, 'hidden boss alongside the weekly boss');
  const hr = await completeQuest(db, hid, hd.quests[0].id, D0); assert.equal(hr.bosses.length, 2, 'one quest wounds both bosses');

  const spin = await mk('Spinner'); const sp = await withRandom(0.975, () => ensureDailyState(db, spin, dm, D0));
  assert.equal(sp.event?.event_type, 'lucky_spin'); assert.equal(sp.event?.resolved, false);
  const prize = await A.spinWheel(db, spin, D0); assert.ok(prize.prize.label && prize.index >= 0 && prize.index < 8);
  await rejects(() => A.spinWheel(db, spin, D0), 409);
  const noWheel = await mk('NoWheel'); await rejects(() => A.spinWheel(db, noWheel, D0), 409);

  const fest = await mk('Festive'); await A.createHabit(db, fest, { title: 'Gym session', questType: 'side', daysOfWeek: [0, 1, 2, 3, 4, 5, 6] });
  const sat = day(3); // Saturday
  const fd = await withRandom(0.7, () => ensureDailyState(db, fest, dm, sat)); assert.equal(fd.event?.event_type, 'weekend_festival');
  const fq = fd.quests.find((q) => q.title === 'Gym session')!; const fr = await completeQuest(db, fest, fq.id, sat);
  assert.equal(fr.gold, Math.round(fq.gold_reward * 1.5)); assert.ok(fr.bonuses.some((b) => b.includes('Festival')));
});

test('boss defeat pays rewards exactly once, unlocks achievements, and a new boss spawns', async () => {
  const p = await mk('Slayer'); await A.createHabit(db, p, { title: 'Deep work block', questType: 'main', daysOfWeek: [0, 1, 2, 3, 4, 5, 6] });
  const d = await ensureDailyState(db, p, dm, D0);
  psql(`update boss_battles set current_hp = 10 where id='${d.boss!.id}'`);
  const r = await completeQuest(db, p, d.quests.find((q) => q.title === 'Deep work block')!.id, D0);
  assert.equal(r.bosses[0].defeated, true); assert.equal(r.bosses[0].rewards?.xp, d.boss!.xp_reward);
  assert.ok(r.awards.achievements.some((a) => a.key === 'first_boss'));
  assert.ok(r.progress.leveledUp, 'boss XP can level you up in the same completion');
  const again = await Promise.all([1, 2, 3].map(() => ensureDailyState(db, p, dm, D0)));
  assert.ok(again.every((x) => x.boss && x.boss.id !== d.boss!.id));
  assert.equal(psql(`select count(*) from boss_battles where character_id='${p.character.id}' and status='active' and not is_hidden`), '1');
});

test('story: sequential chapter unlocks, rewards once, campaign switching; tag-count achievements', async () => {
  const p = await mk('Reader', { campaignSlug: 'general' }); const cid = p.character.id;
  const run = () => runAwards(db, { characterId: cid, userId: p.profile.id, campaignId: p.character.active_campaign_id });
  psql(`update character_stats set intelligence = 30 where character_id='${cid}'`);
  assert.equal((await run()).chapters.length, 0, 'chapter III stays locked until II opens (sequential)');
  psql(`update streaks set longest_streak = 7, current_streak = 7 where character_id='${cid}'`);
  const a = await run(); assert.deepEqual(a.chapters.map((c) => c.title.slice(0, 11)), ['Chapter II ', 'Chapter III']);
  assert.ok(a.achievements.some((x) => x.key === 'seven_day_streak'));
  assert.equal(psql(`select string_agg(status, ',' order by chapter_number) from character_story_progress p join story_chapters c on c.id=p.chapter_id where p.character_id='${cid}'`), 'completed,completed,unlocked,locked,locked');
  const gold = (await fresh(p)).character.gold; assert.equal((await run()).chapters.length, 0); assert.equal((await fresh(p)).character.gold, gold, 'nothing is paid twice');
  assert.equal(psql(`select count(*) from character_inventory ci join items i on i.id=ci.item_id where ci.character_id='${cid}' and i.key='knowledge_scroll'`), '1'); // chapter III reward (+ focus potion from streak)
  await switchCampaign(db, await fresh(p), 'fitness');
  assert.equal(psql(`select count(*) from character_story_progress p join story_chapters c on c.id=p.chapter_id join campaigns k on k.id=c.campaign_id where p.character_id='${cid}' and k.slug='fitness' and p.status='unlocked'`), '1');
  // 100 gym quests → "Hundred Workouts" (tag counting through PostgREST array contains)
  psql(`insert into quests (character_id, quest_date, quest_type, title, description, tags, status, completed_at) select '${cid}', current_date - g, 'side', 'gym '||g, 'x', '{gym}', 'completed', now() from generate_series(1,100) g`);
  const h = await run(); assert.ok(h.achievements.some((x) => x.key === 'hundred_workouts') && h.items.some((i) => i.name === 'Sword of Persistence'));
  assert.ok(!h.achievements.some((x) => x.key === 'fifty_books'));
});

test('weekly report from real activity, AI coach, crisis safety, rate limit', async () => {
  const p = await mk('Reporter'); await A.createHabit(db, p, { title: 'Gym session', questType: 'side', daysOfWeek: [0, 1, 2, 3, 4, 5, 6] });
  for (const n of [0, 1, 2]) { const d = await ensureDailyState(db, p, dm, day(n)); for (const q of d.quests.filter((x) => x.title === 'Gym session')) await completeQuest(db, p, q.id, day(n)); }
  // move the activity timestamps onto the simulated days (the DB clock is real "now")
  for (const n of [0, 1, 2]) psql(`update xp_log set created_at = '${iso(day(n))}T08:00:00Z' where id in (select id from xp_log where character_id='${p.character.id}' order by created_at, id offset ${n} limit 1)`);
  psql(`update quests set completed_at = quest_date::timestamptz + interval '8 hours' where character_id='${p.character.id}' and status='completed'`);
  const rep = await generateReport(db, await fresh(p), dm, '2026-10-26');
  const m = rep.metrics as { questsCompleted: number; activeDays: number; xpByDay: number[] };
  assert.equal(m.questsCompleted, 3); assert.equal(m.activeDays, 3);
  assert.ok(m.xpByDay[2] > 0 && m.xpByDay[3] > 0 && m.xpByDay[4] > 0 && m.xpByDay[0] === 0, JSON.stringify(m.xpByDay)); // Mon..Sun → Wed, Thu, Fri
  assert.ok(rep.summary.includes('Strength +6') && rep.stat_deltas.strength === 6);
  assert.equal(Number(psql(`select count(*) from weekly_reports where character_id='${p.character.id}'`)), 1);
  await generateReport(db, await fresh(p), dm, '2026-10-26'); assert.equal(psql(`select count(*) from weekly_reports where character_id='${p.character.id}'`), '1', 'regenerating replaces, never duplicates');
  const c1 = await coachChat(db, await fresh(p), dm, 'what should I do today?'); assert.ok(c1.reply.length > 20 && c1.source === 'offline');
  assert.equal((await coachChat(db, await fresh(p), dm, 'I want to end my life')).reply, CRISIS_REPLY);
  assert.equal(psql(`select count(*) from coaching_messages where character_id='${p.character.id}'`), '4');
  assert.equal(psql(`select string_agg(role, ',' order by created_at) from coaching_messages where character_id='${p.character.id}'`), 'user,coach,user,coach', 'every question is followed by its answer');
  psql(`insert into coaching_messages (character_id, role, content) select '${p.character.id}', 'user', 'spam' from generate_series(1,40)`);
  await rejects(() => coachChat(db, p, dm, 'hello?'), 429);
});

test('guilds: create, join, contribute, claim once, permissions, leadership handover', async () => {
  const L = await mk('Leader'), M = await mk('Member'), X = await mk('Outsider');
  await A.createHabit(db, L, { title: 'Gym session', questType: 'side', daysOfWeek: [0, 1, 2, 3, 4, 5, 6] });
  const { guild, awards } = await S.createGuild(db, L, { name: 'Phoenix Order', icon: 'flame' });
  assert.ok(awards.achievements.some((a) => a.key === 'guild_joined'));
  await rejects(() => S.createGuild(db, X, { name: 'Phoenix Order', icon: 'shield' }), 409, /taken/);
  await rejects(() => S.createGuild(db, L, { name: 'Second Guild', icon: 'shield' }), 409, /Leave/);
  await S.joinGuild(db, M, guild.id); await rejects(() => S.joinGuild(db, M, guild.id), 409);
  let ov = await S.guildOverview(db, L); assert.equal(ov!.members.length, 2); assert.equal(ov!.quest!.target_value, 2400, 'target rescaled when the 2nd member joined'); assert.equal(ov!.role, 'leader');
  const d = await ensureDailyState(db, L, dm, D0); const done = await completeQuest(db, L, d.quests.find((q) => q.title === 'Gym session')!.id, D0);
  assert.equal(done.guild?.current, done.xp);
  psql(`update guild_quests set current_value = target_value, status = 'completed' where guild_id='${guild.id}'`);
  ov = await S.guildOverview(db, M); assert.ok(ov!.canClaim);
  const claim = await S.claimGuildQuest(db, M, ov!.lastCompleted!.id); assert.equal(claim.gold, 100);
  await rejects(() => S.claimGuildQuest(db, M, ov!.lastCompleted!.id), 409, /already/);
  await rejects(() => S.claimGuildQuest(db, X, ov!.lastCompleted!.id), 403);
  await S.leaveGuild(db, L); // leader leaves → longest-serving member takes over
  assert.equal((await S.guildOverview(db, M))!.role, 'leader');
  await S.leaveGuild(db, M); assert.equal(psql(`select count(*) from guilds where id='${guild.id}'`), '0', 'an empty guild disappears');
  await rejects(() => S.leaveGuild(db, M), 404);
});

test('friends and 1v1 XP duels: escrow, live scores, settlement, payouts, ties', async () => {
  const A1 = await mk('Duelist'), B1 = await mk('Rival');
  const found = await S.searchPlayers(db, A1, (await fresh(B1)).profile.username!.slice(0, 5)); assert.ok(found.some((f) => f.characterId === B1.character.id));
  assert.deepEqual(await S.searchPlayers(db, A1, 'ab'), []); // too short to search
  await rejects(() => S.createChallenge(db, A1, { friendCharacterId: B1.character.id, days: 3, stake: 50 }), 403, /friends/);
  await S.sendFriendRequest(db, A1, B1.character.id); await rejects(() => S.sendFriendRequest(db, B1, A1.character.id), 409);
  await rejects(() => S.sendFriendRequest(db, A1, A1.character.id), 400);
  const fo = await S.friendOverview(db, B1); assert.equal(fo.incoming.length, 1);
  await rejects(() => S.respondFriend(db, A1, fo.incoming[0].id, 'accept'), 400); // only the addressee may accept
  await S.respondFriend(db, B1, fo.incoming[0].id, 'accept'); assert.equal((await S.friendOverview(db, A1)).friends.length, 1);
  await S.createChallenge(db, A1, { friendCharacterId: B1.character.id, days: 3, stake: 50 });
  const ch = (await S.challengeOverview(db, B1))[0]; assert.ok(ch.canAccept);
  await S.respondChallenge(db, B1, ch.id, true);
  assert.deepEqual([(await fresh(A1)).character.gold, (await fresh(B1)).character.gold], [50, 50]); // both stakes in escrow
  await credit(A1, 200); await credit(B1, 50);
  const live = (await S.challengeOverview(db, A1))[0]; assert.deepEqual([live.myXp, live.theirXp], [200, 50]);
  psql(`update xp_log set created_at = now() - interval '1 day' where source = 'test' and character_id in ('${A1.character.id}','${B1.character.id}')`); // activity happened inside the duel window
  psql(`update challenges set ends_at = now() - interval '1 minute', starts_at = now() - interval '3 days' where id='${ch.id}'`);
  const fin = (await S.challengeOverview(db, A1))[0]; assert.equal(fin.status, 'finished'); assert.equal(fin.winnerIsMe, true);
  assert.deepEqual([(await fresh(A1)).character.gold, (await fresh(B1)).character.gold], [150, 50]); // winner takes the pot
  assert.equal((await S.challengeOverview(db, A1)).length, 1); // settling twice never pays twice
  // a tie refunds both stakes
  await S.createChallenge(db, B1, { friendCharacterId: A1.character.id, days: 1, stake: 0 });
  const t = (await S.challengeOverview(db, A1)).find((c) => c.canAccept)!; await S.respondChallenge(db, A1, t.id, true);
  psql(`update challenges set ends_at = now() - interval '1 minute', starts_at = now() - interval '5 hours' where id='${t.id}'`); // a window with no XP in it → 0 vs 0
  assert.equal((await S.challengeOverview(db, A1)).find((c) => c.id === t.id)!.winnerIsMe, null);
  const broke = await mk('Broke'); await rejects(() => S.createChallenge(db, broke, { friendCharacterId: A1.character.id, days: 1, stake: 999 }), 403);
});

test('leaderboards, cron jobs, and the ledger invariant across every test player', async () => {
  const lb = await S.leaderboards(db);
  assert.ok(lb.global.length >= 10 && lb.global[0].lifetime_xp >= lb.global[1].lifetime_xp);
  assert.deepEqual(lb.global.map((r) => r.rank), [...lb.global.map((r) => r.rank)].sort((a, b) => a - b));
  assert.ok(lb.weekly.length >= 5 && lb.weekly.every((r) => r.weekly_xp > 0));
  const yesterday = await mk('Lapsing'); psql(`update streaks set current_streak = 4, longest_streak = 4, last_active_date = (now() at time zone 'Asia/Kolkata')::date - 1 where character_id='${yesterday.character.id}'`);
  const m = await runMorning(db, dm); assert.equal(m.failed, 0); assert.ok(m.processed >= 10);
  const e = await runEvening(db); assert.equal(e.failed, 0);
  assert.equal(psql(`select count(*) from notifications where user_id='${yesterday.profile.id}' and notif_type='streak'`), '1');
  // THE invariant: every XP / gold change in the game went through a ledger
  const bad = psql(`select string_agg(c.name || ' xp ' || c.lifetime_xp || '≠' || coalesce((select sum(amount) from xp_log x where x.character_id=c.id),0) || ' gold ' || c.gold || '≠' || (100 + coalesce((select sum(amount) from gold_transactions g where g.character_id=c.id),0)), '; ') from characters c where c.lifetime_xp <> coalesce((select sum(amount) from xp_log x where x.character_id=c.id),0) or c.gold <> 100 + coalesce((select sum(amount) from gold_transactions g where g.character_id=c.id),0)`);
  assert.equal(bad, '', `ledger mismatch: ${bad}`);
  assert.equal(psql(`select count(*) from characters where gold < 0`), '0');
});
