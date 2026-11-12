import type { BossDifficulty, QuestType } from '@/lib/types';

const DIFF_HP: Record<BossDifficulty, number> = { normal: 1, hard: 1.4, very_hard: 1.9, legendary: 2.6 };
export const maxHpFor = (level: number, d: BossDifficulty) => Math.round((900 + 60 * Math.max(1, level)) * DIFF_HP[d]);
export function bossRewards(maxHp: number, d: BossDifficulty) {
  const item = d === 'legendary' ? 'golden_badge' : d === 'very_hard' ? 'streak_charm' : d === 'hard' ? 'gold_pouch' : null;
  return { xp: Math.round(maxHp * 0.25), gold: Math.round(maxHp * 0.12), itemKey: item };
}
/** Deterministic difficulty ladder: gentle start, every 8th boss is a legend. */
export function nextBossDifficulty(level: number, bossesDefeated: number): BossDifficulty {
  const n = bossesDefeated + 1;
  if (n % 8 === 0) return 'legendary';
  if (level >= 8 && n % 3 === 0) return 'very_hard';
  if (level >= 4 && n % 2 === 0) return 'hard';
  return 'normal';
}
/** Every quest you finish hurts the active boss; Boss Fight quests hit twice as hard. */
export const damageForQuest = (xpEarned: number, type: QuestType) => Math.round(xpEarned * (type === 'boss_fight' ? 2 : 1));
export const BOSS_DURATION_DAYS = 7;
