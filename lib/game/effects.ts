import type { CharacterStats, EffectSource, QuestType, StatName } from '@/lib/types';
import { round2 } from '@/lib/utils';
import type { BaseRewards } from './rewards';

export interface Effects {
  statBonusPct: Partial<Record<StatName, number>>;
  tagXpBonusPct: Record<string, number>;
  typeXpBonusPct: Partial<Record<QuestType, number>>;
  goldBonusPctByType: Partial<Record<QuestType, number>>;
  bossXpBonusPct: number;
  guildContributionBonusPct: number;
  guildQuestXpBonusPct: number;
  eventChanceBonusPct: number;
  freezeRegenMultiplier: number;
  redemptionDiscountPct: number;
  weekendGoldMultiplier: number;
}
export const emptyEffects = (): Effects => ({
  statBonusPct: {}, tagXpBonusPct: {}, typeXpBonusPct: {}, goldBonusPctByType: {}, bossXpBonusPct: 0, guildContributionBonusPct: 0,
  guildQuestXpBonusPct: 0, eventChanceBonusPct: 0, freezeRegenMultiplier: 1, redemptionDiscountPct: 0, weekendGoldMultiplier: 1,
});
const addMap = (target: Record<string, number>, src: unknown) => {
  if (src && typeof src === 'object') for (const [k, v] of Object.entries(src as Record<string, unknown>)) if (typeof v === 'number') target[k] = (target[k] ?? 0) + v;
};
/** Merges skill-node + equipped-item effects into one typed object. */
export function aggregateEffects(sources: EffectSource[]): Effects {
  const o = emptyEffects();
  for (const { effect: e } of sources) {
    addMap(o.statBonusPct as Record<string, number>, e.stat_bonus_pct);
    addMap(o.tagXpBonusPct, e.quest_tag_xp_bonus_pct);
    addMap(o.typeXpBonusPct as Record<string, number>, e.quest_type_xp_bonus_pct);
    addMap(o.goldBonusPctByType as Record<string, number>, e.gold_bonus_pct_by_quest_type);
    if (typeof e.boss_xp_bonus_pct === 'number') o.bossXpBonusPct += e.boss_xp_bonus_pct;
    if (typeof e.guild_contribution_bonus_pct === 'number') o.guildContributionBonusPct += e.guild_contribution_bonus_pct;
    if (typeof e.guild_quest_xp_bonus_pct === 'number') o.guildQuestXpBonusPct += e.guild_quest_xp_bonus_pct;
    if (typeof e.random_event_chance_bonus_pct === 'number') o.eventChanceBonusPct += e.random_event_chance_bonus_pct;
    if (typeof e.freeze_token_regen_multiplier === 'number') o.freezeRegenMultiplier *= e.freeze_token_regen_multiplier;
    if (typeof e.redemption_discount_pct === 'number') o.redemptionDiscountPct += e.redemption_discount_pct;
    if (typeof e.weekend_gold_multiplier === 'number') o.weekendGoldMultiplier = Math.max(o.weekendGoldMultiplier, e.weekend_gold_multiplier);
  }
  return o;
}

export interface FinalRewards { xp: number; gold: number; stats: Partial<CharacterStats>; bonuses: string[] }
/** Applies skill/equipment bonuses and today's event multipliers to a quest's BASE rewards. */
export function finalizeRewards(
  base: BaseRewards, q: { type: QuestType; tags: string[]; doubleXp: boolean }, fx: Effects, ctx: { festival: boolean },
): FinalRewards {
  const bonuses: string[] = [];
  let xpPct = (fx.typeXpBonusPct[q.type] ?? 0) + (q.type === 'boss_fight' ? fx.bossXpBonusPct : 0);
  for (const t of q.tags) xpPct += fx.tagXpBonusPct[t] ?? 0;
  let xp = base.xp * (1 + xpPct / 100);
  if (xpPct) bonuses.push(`+${xpPct}% XP (skills & gear)`);
  if (q.doubleXp) { xp *= 2; bonuses.push('Double XP Day ×2'); }
  const goldPct = fx.goldBonusPctByType[q.type] ?? 0;
  let gold = base.gold * (1 + goldPct / 100);
  if (goldPct) bonuses.push(`+${goldPct}% Gold`);
  if (ctx.festival) { const m = 1 + 0.5 * fx.weekendGoldMultiplier; gold *= m; bonuses.push(`Weekend Festival ×${m} Gold`); }
  const stats: Partial<CharacterStats> = {};
  for (const [s, v] of Object.entries(base.stats) as [StatName, number][]) stats[s] = round2(v * (1 + (fx.statBonusPct[s] ?? 0) / 100));
  return { xp: Math.round(xp), gold: Math.round(gold), stats, bonuses };
}
