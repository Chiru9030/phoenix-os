import { daysBetween } from './dates';

export interface StreakResult { currentStreak: number; longestStreak: number; freezeTokens: number; freezeUsed: boolean; broken: boolean }
/** Call once per day, on the first quest completed that day. Idempotent within a day. */
export function updateStreakOnActivity(today: string, last: string | null, cur: number, longest: number, freeze: number): StreakResult {
  const same = { currentStreak: cur, longestStreak: longest, freezeTokens: freeze, freezeUsed: false, broken: false };
  if (last === today) return same;
  if (last === null) return { ...same, currentStreak: 1, longestStreak: Math.max(longest, 1) };
  const gap = daysBetween(last, today);
  if (gap === 1) { const s = cur + 1; return { ...same, currentStreak: s, longestStreak: Math.max(longest, s) }; }
  if (gap === 2 && freeze > 0) { const s = cur + 1; return { currentStreak: s, longestStreak: Math.max(longest, s), freezeTokens: freeze - 1, freezeUsed: true, broken: false }; }
  return { currentStreak: 1, longestStreak: longest, freezeTokens: freeze, freezeUsed: false, broken: cur > 0 };
}
export type StreakState = 'safe' | 'at_risk' | 'broken' | 'none';
/** What to DISPLAY before today's activity: a lapsed streak shows as broken, not as a stale number. */
export function streakStatus(today: string, last: string | null, cur: number, freeze: number): { state: StreakState; display: number } {
  if (last === null || cur === 0) return { state: 'none', display: 0 };
  const gap = daysBetween(last, today);
  if (gap <= 0) return { state: 'safe', display: cur };
  if (gap === 1) return { state: 'at_risk', display: cur };
  if (gap === 2 && freeze > 0) return { state: 'at_risk', display: cur };
  return { state: 'broken', display: 0 };
}
/** A freeze token regenerates every 7 streak days (every ~3.5 with Unshakeable), capped at 3. */
export function regenFreezeToken(streak: number, tokens: number, multiplier = 1): number {
  const interval = Math.max(1, Math.round(7 / multiplier));
  return streak > 0 && streak % interval === 0 ? Math.min(3, tokens + 1) : tokens;
}
