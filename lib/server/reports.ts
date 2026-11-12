import { addDays, daysBetween, todayInTz, weekStartMonday } from '@/lib/game/dates';
import { STAT_NAMES, type CharacterStats, type CoachContext, type CoachTurn, type StatName, type WeeklyMetrics } from '@/lib/types';
import type { HybridDungeonMaster } from '@/lib/ai/hybrid';
import { HEAD, HttpError, countOf, maybe, must, type Db } from './util';
import type { BossRow, QuestRow, WeeklyReportRow } from './rows';
import type { Player } from './player';
import { round2 } from '@/lib/utils';

export async function buildWeeklyMetrics(db: Db, p: Player, weekStart: string): Promise<WeeklyMetrics> {
  const cid = p.character.id, tz = p.profile.timezone, weekEnd = addDays(weekStart, 6);
  const from = `${addDays(weekStart, -1)}T00:00:00Z`, to = `${addDays(weekEnd, 2)}T00:00:00Z`;
  const [quests, logs, bosses] = await Promise.all([
    must<Pick<QuestRow, 'quest_date' | 'status' | 'tags' | 'stat_rewards' | 'completed_at'>[]>(db.from('quests').select('quest_date,status,tags,stat_rewards,completed_at').eq('character_id', cid).gte('quest_date', weekStart).lte('quest_date', weekEnd)),
    must<{ amount: number; created_at: string }[]>(db.from('xp_log').select('amount,created_at').eq('character_id', cid).gt('amount', 0).gte('created_at', from).lt('created_at', to)),
    must<Pick<BossRow, 'completed_at'>[]>(db.from('boss_battles').select('completed_at').eq('character_id', cid).eq('status', 'defeated').gte('completed_at', from).lt('completed_at', to)),
  ]);
  const local = (iso: string) => todayInTz(tz, new Date(iso));
  const inWeek = (d: string) => { const i = daysBetween(weekStart, d); return i >= 0 && i < 7; };
  const xpByDay = Array<number>(7).fill(0);
  for (const l of logs) { const i = daysBetween(weekStart, local(l.created_at)); if (i >= 0 && i < 7) xpByDay[i] += l.amount; }
  const done = quests.filter((q) => q.status === 'completed');
  const statDeltas: Partial<CharacterStats> = {}, tagCounts: Record<string, number> = {};
  for (const q of done) {
    for (const [s, v] of Object.entries(q.stat_rewards ?? {}) as [StatName, number][]) statDeltas[s] = round2((statDeltas[s] ?? 0) + v);
    for (const t of q.tags ?? []) tagCounts[t] = (tagCounts[t] ?? 0) + 1;
  }
  const total = quests.filter((q) => q.status !== 'expired' || true).length;
  const ranked = [...STAT_NAMES].sort((a, b) => (statDeltas[a] ?? 0) - (statDeltas[b] ?? 0) || p.stats[a] - p.stats[b]);
  const strongest = [...STAT_NAMES].sort((a, b) => (statDeltas[b] ?? 0) - (statDeltas[a] ?? 0))[0];
  return {
    weekStart, weekEnd, xpByDay, questsCompleted: done.length, questsTotal: total, completionRate: total ? done.length / total : 0, statDeltas,
    strongestStat: (statDeltas[strongest] ?? 0) > 0 ? strongest : null, weakestStat: ranked[0] ?? null,
    activeDays: new Set(done.map((q) => (q.completed_at ? local(q.completed_at) : q.quest_date)).filter(inWeek)).size,
    currentStreak: p.streak.current_streak, bossesDefeated: bosses.filter((b) => b.completed_at && inWeek(local(b.completed_at))).length, tagCounts,
  };
}

export async function generateReport(db: Db, p: Player, dm: HybridDungeonMaster, weekStart: string): Promise<WeeklyReportRow> {
  const metrics = await buildWeeklyMetrics(db, p, weekStart);
  const r = await dm.generateWeeklyReport({ characterName: p.character.name, level: p.character.level, campaignName: p.campaign?.name ?? '', metrics });
  return must<WeeklyReportRow>(db.from('weekly_reports').upsert({
    character_id: p.character.id, week_start: weekStart, week_end: metrics.weekEnd, stat_deltas: metrics.statDeltas, metrics, summary: r.value.summary,
    weakness: r.value.weakness, recommendation: r.value.recommendation, generated_by: r.source === 'ai' ? r.provider : 'offline',
  }, { onConflict: 'character_id,week_start' }).select('*').single());
}
/** Auto-creates last full week's report the first time it is needed (cron or page load). */
export async function ensureLastWeekReport(db: Db, p: Player, dm: HybridDungeonMaster, now = new Date()): Promise<void> {
  const today = todayInTz(p.profile.timezone, now), start = addDays(weekStartMonday(today), -7);
  if (todayInTz(p.profile.timezone, new Date(p.character.created_at)) > addDays(start, 6)) return; // character didn't exist that week
  const have = await maybe<{ id: string }>(db.from('weekly_reports').select('id').eq('character_id', p.character.id).eq('week_start', start).maybeSingle());
  if (!have) await generateReport(db, p, dm, start);
}
export const listReports = (db: Db, cid: string, limit = 8) => must<WeeklyReportRow[]>(db.from('weekly_reports').select('*').eq('character_id', cid).order('week_start', { ascending: false }).limit(limit));

// ── AI coach ──
export async function coachChat(db: Db, p: Player, dm: HybridDungeonMaster, message: string) {
  const cid = p.character.id;
  const sent = await countOf(db.from('coaching_messages').select('id', HEAD).eq('character_id', cid).eq('role', 'user').gte('created_at', new Date(Date.now() - 86_400_000).toISOString()));
  if (sent >= 40) throw new HttpError(429, 'The coach needs a rest. Try again tomorrow.');
  const today = todayInTz(p.profile.timezone);
  const [history, pending, doneToday, boss] = await Promise.all([
    must<CoachTurn[]>(db.from('coaching_messages').select('role,content').eq('character_id', cid).order('created_at', { ascending: false }).limit(8)),
    must<{ title: string }[]>(db.from('quests').select('title').eq('character_id', cid).eq('quest_date', today).eq('status', 'pending').limit(8)),
    countOf(db.from('quests').select('id', HEAD).eq('character_id', cid).eq('quest_date', today).eq('status', 'completed')),
    maybe<{ name: string }>(db.from('boss_battles').select('name').eq('character_id', cid).eq('status', 'active').eq('is_hidden', false).maybeSingle()),
  ]);
  const weakest = [...STAT_NAMES].sort((a, b) => p.stats[a] - p.stats[b])[0] ?? null;
  const ctx: CoachContext = { characterName: p.character.name, level: p.character.level, stats: p.stats, currentStreak: p.streak.current_streak, campaignName: p.campaign?.name ?? '', pendingQuestTitles: pending.map((q) => q.title), completedToday: doneToday, activeBossName: boss?.name, weakestStat: weakest };
  const reply = await dm.coach(ctx, history.reverse(), message);
  const t = Date.now(); // explicit, distinct timestamps: rows from one statement would share now() and could render out of order
  await db.from('coaching_messages').insert([{ character_id: cid, role: 'user', content: message, created_at: new Date(t).toISOString() }, { character_id: cid, role: 'coach', content: reply.value, created_at: new Date(t + 1).toISOString() }]);
  return { reply: reply.value, source: reply.source };
}
