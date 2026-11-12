import { timingSafeEqual } from 'node:crypto';
import { addDays, dayOfWeekFor, todayInTz } from '@/lib/game/dates';
import type { HybridDungeonMaster } from '@/lib/ai/hybrid';
import { must, type Db } from './util';
import { loadPlayer, type Player } from './player';
import { ensureDailyState } from './daily';
import { ensureLastWeekReport } from './reports';
import { notify, prefAllows } from './notify';

export function cronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // never open by default
  const got = Buffer.from(req.headers.get('authorization') ?? ''), want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}
export interface Page { offset: number; limit: number }
export function pageFrom(req: Request): Page {
  const q = new URL(req.url).searchParams, int = (k: string, d: number, max: number) => { const n = Number.parseInt(q.get(k) ?? '', 10); return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : d; };
  return { offset: int('offset', 0, 1_000_000), limit: Math.max(1, int('limit', 100, 200)) };
}
async function forEachPlayer(db: Db, fn: (p: Player) => Promise<void>, page: Page = { offset: 0, limit: 100 }) {
  const rows = await must<{ user_id: string }[]>(db.from('characters').select('user_id').eq('onboarded', true).order('created_at').order('id').range(page.offset, page.offset + page.limit - 1));
  let failed = 0;
  for (let i = 0; i < rows.length; i += 5) {
    await Promise.all(rows.slice(i, i + 5).map(async (r) => {
      try { const p = await loadPlayer(db, r.user_id); if (p) await fn(p); } catch (e) { failed++; console.error('[cron]', (e as Error).message); }
    }));
  }
  return { processed: rows.length, failed, nextOffset: rows.length === page.limit ? page.offset + page.limit : null };
}
/** Pre-generates today's board (so the morning push is real) and, on Mondays, last week's report. */
export const runMorning = (db: Db, dm: HybridDungeonMaster, page?: Page, now = new Date()) => forEachPlayer(db, async (p) => {
  await ensureDailyState(db, p, dm, now, { push: true });
  if (dayOfWeekFor(todayInTz(p.profile.timezone, now)) === 1) await ensureLastWeekReport(db, p, dm, now);
}, page);
/** Evening nudges: protect streaks that are at risk and warn about bosses about to flee. */
export const runEvening = (db: Db, page?: Page, now = new Date()) => forEachPlayer(db, async (p) => {
  const today = todayInTz(p.profile.timezone, now), prefs = p.profile.notification_prefs;
  if (p.streak.current_streak > 0 && p.streak.last_active_date === addDays(today, -1) && prefAllows(prefs, 'streak_protection'))
    await notify(db, p.profile.id, { type: 'streak', title: 'Protect your streak', body: `Your ${p.streak.current_streak}-day streak ends tonight unless you finish one quest.`, push: true });
  const boss = await db.from('boss_battles').select('name,expires_at').eq('character_id', p.character.id).eq('status', 'active').eq('is_hidden', false).maybeSingle();
  if (boss.data?.expires_at && new Date(boss.data.expires_at).getTime() - now.getTime() < 36 * 3600_000 && prefAllows(prefs, 'boss_reminders'))
    await notify(db, p.profile.id, { type: 'boss', title: 'Your boss is about to flee', body: `${boss.data.name} leaves soon. Land a few more hits.`, push: true });
}, page);
