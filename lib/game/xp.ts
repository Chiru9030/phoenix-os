// Superlinear leveling: early levels come fast (hook), later levels reward sustained effort.
// ~Level 10 ≈ 4 weeks of steady play, level 25 ≈ 8 months.
const BASE_XP = 80;
const EXPONENT = 1.35;
export const xpToClearLevel = (level: number) => Math.round(BASE_XP * Math.pow(Math.max(1, level), EXPONENT));

export interface XpApplyResult { newLevel: number; newCurrentXp: number; xpToNext: number; leveledUp: boolean; levelsGained: number }
export function applyXpGain(level: number, currentXp: number, gained: number): XpApplyResult {
  let lvl = level, xp = currentXp + Math.max(0, Math.round(gained)), gainedLevels = 0;
  let need = xpToClearLevel(lvl);
  while (xp >= need) { xp -= need; lvl++; gainedLevels++; need = xpToClearLevel(lvl); }
  return { newLevel: lvl, newCurrentXp: xp, xpToNext: need, leveledUp: gainedLevels > 0, levelsGained: gainedLevels };
}
/** 1 skill point per level, +1 bonus on every 5th level. */
export function skillPointsForLevelUp(fromLevel: number, toLevel: number): number {
  let pts = 0; for (let l = fromLevel + 1; l <= toLevel; l++) pts += 1 + (l % 5 === 0 ? 1 : 0); return pts;
}
export const ALL_QUESTS_BONUS = { xp: 50, gold: 25, discipline: 2 } as const;
/** Cosmetic crest tier: bronze → runic → gilded. Never gates gameplay. */
export const crestTier = (level: number): 1 | 2 | 3 => (level >= 25 ? 3 : level >= 10 ? 2 : 1);
