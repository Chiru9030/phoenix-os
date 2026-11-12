import { ALL_QUESTS_BONUS } from '@/lib/game/xp';
import { finalizeRewards } from '@/lib/game/effects';
import { damageForQuest } from '@/lib/game/bosses';
import { todayInTz } from '@/lib/game/dates';
import type { CharacterStats, QuestType } from '@/lib/types';
import { round2 } from '@/lib/utils';
import { HEAD, HttpError, countOf, maybe, must, type Db } from './util';
import type { BossRow, EventRow, QuestRow } from './rows';
import type { Player } from './player';
import { grantItem, grantProgress, loadEffects, mergeProgress, runAwards, type AwardSummary, type ProgressResult } from './progress';
import { notify } from './notify';

export interface BossHit { id: string; name: string; damage: number; currentHp: number; maxHp: number; defeated: boolean; rewards?: { xp: number; gold: number; itemName?: string } }
export interface CompletionResult {
  quest: { id: string; title: string; type: QuestType };
  xp: number; gold: number; stats: Partial<CharacterStats>; bonuses: string[];
  dayCleared: { xp: number; gold: number } | null;
  progress: ProgressResult; bosses: BossHit[]; awards: AwardSummary;
  guild: { title: string; current: number; target: number; completed: boolean } | null;
  warnings: string[];
}
const emptyAwards = (): AwardSummary => ({ achievements: [], chapters: [], items: [], titles: [], extra: null });

async function hitBosses(db: Db, p: Player, quest: QuestRow, xpEarned: number): Promise<{ hits: BossHit[]; extra: ProgressResult | null }> {
  const cid = p.character.id;
  const bosses = await must<BossRow[]>(db.from('boss_battles').select('*').eq('character_id', cid).eq('status', 'active'));
  const damage = damageForQuest(xpEarned, quest.quest_type);
  const hits: BossHit[] = []; let rx = 0, rg = 0;
  for (const b of bosses) {
    const rows = await must<{ current_hp: number; max_hp: number; defeated_now: boolean }[]>(db.rpc('damage_boss', { p_boss: b.id, p_damage: damage }));
    const r = rows?.[0]; if (!r) continue;
    const hit: BossHit = { id: b.id, name: b.name, damage, currentHp: r.current_hp, maxHp: r.max_hp, defeated: r.defeated_now };
    if (r.defeated_now) {
      rx += b.xp_reward; rg += b.gold_reward;
      const item = b.item_reward_key ? await grantItem(db, cid, b.item_reward_key) : null;
      hit.rewards = { xp: b.xp_reward, gold: b.gold_reward, itemName: item?.name };
      await notify(db, p.profile.id, { type: 'boss', title: `Boss defeated: ${b.name}`, body: `+${b.xp_reward} XP, +${b.gold_reward} Gold` });
    }
    hits.push(hit);
  }
  let extra: ProgressResult | null = null;
  if (rx || rg) {
    extra = await grantProgress(db, cid, { xp: rx, gold: rg });
    await db.from('xp_log').insert({ character_id: cid, source: 'boss', amount: rx });
    await db.from('gold_transactions').insert({ character_id: cid, amount: rg, reason: 'Boss defeated' });
  }
  return { hits, extra };
}

async function contributeToGuild(db: Db, cid: string, xpEarned: number, bonusPct: number) {
  const gm = await maybe<{ guild_id: string }>(db.from('guild_members').select('guild_id').eq('character_id', cid).maybeSingle());
  if (!gm) return null;
  const { ensureGuildQuest } = await import('./social');
  await ensureGuildQuest(db, gm.guild_id);
  const amount = Math.max(1, Math.round(xpEarned * (1 + bonusPct / 100)));
  const rows = await must<{ quest_id: string; title: string; current_value: number; target_value: number; completed_now: boolean }[]>(db.rpc('bump_guild_quest', { p_guild: gm.guild_id, p_amount: amount }));
  const r = rows?.[0];
  return r ? { title: r.title, current: r.current_value, target: r.target_value, completed: r.completed_now } : null;
}

/**
 * Completes a quest and pays everything out. The status flip is the idempotency gate (a quest can only be
 * completed once); the primary reward is one atomic compare-and-set; everything after it is best-effort
 * and reported in `warnings` rather than failing a quest the player has genuinely finished.
 */
export async function completeQuest(db: Db, p: Player, questId: string, now = new Date()): Promise<CompletionResult> {
  const cid = p.character.id, today = todayInTz(p.profile.timezone, now);
  const gate = await db.from('quests').update({ status: 'completed', completed_at: now.toISOString() })
    .eq('id', questId).eq('character_id', cid).eq('status', 'pending').eq('quest_date', today).select('*');
  if (gate.error) throw new Error(gate.error.message);
  if (!gate.data?.length) {
    const q = await maybe<{ status: string }>(db.from('quests').select('status').eq('id', questId).eq('character_id', cid).maybeSingle());
    if (!q) throw new HttpError(404, 'Quest not found');
    throw new HttpError(q.status === 'completed' ? 409 : 410, q.status === 'completed' ? 'You already completed this quest.' : 'This quest has expired.');
  }
  const quest = gate.data[0] as QuestRow;

  let fin: ReturnType<typeof finalizeRewards>, dayCleared: CompletionResult['dayCleared'] = null, progress: ProgressResult, fxBonusGuild = 0, clearedGate = false;
  try {
    const [fx, ev, remaining, total] = await Promise.all([
      loadEffects(db, cid),
      maybe<EventRow>(db.from('random_events').select('*').eq('character_id', cid).eq('event_date', today).maybeSingle()),
      countOf(db.from('quests').select('id', HEAD).eq('character_id', cid).eq('quest_date', today).eq('status', 'pending')),
      countOf(db.from('quests').select('id', HEAD).eq('character_id', cid).eq('quest_date', today)),
    ]);
    fxBonusGuild = fx.guildContributionBonusPct;
    fin = finalizeRewards({ xp: quest.xp_reward, gold: quest.gold_reward, stats: quest.stat_rewards }, { type: quest.quest_type, tags: quest.tags, doubleXp: quest.double_xp }, fx, { festival: ev?.event_type === 'weekend_festival' });
    let xp = fin.xp, gold = fin.gold; const stats: Partial<CharacterStats> = { ...fin.stats };
    if (remaining === 0 && total >= 3) { // all of today's quests are done; the atomic gate guarantees the bonus is paid once, even when the last quests finish simultaneously
      const won = await must<unknown[]>(db.from('daily_briefings').update({ cleared_at: now.toISOString() }).eq('character_id', cid).eq('briefing_date', today).is('cleared_at', null).select('id'));
      if (won.length) {
        clearedGate = true; dayCleared = { xp: ALL_QUESTS_BONUS.xp, gold: ALL_QUESTS_BONUS.gold };
        xp += ALL_QUESTS_BONUS.xp; gold += ALL_QUESTS_BONUS.gold;
        stats.discipline = round2((stats.discipline ?? 0) + ALL_QUESTS_BONUS.discipline);
      }
    }
    progress = await grantProgress(db, cid, { xp, gold, stats, streak: { today, regenMultiplier: fx.freezeRegenMultiplier } });
  } catch (e) {
    await db.from('quests').update({ status: 'pending', completed_at: null }).eq('id', questId); // nothing was paid: let the player retry
    if (clearedGate) await db.from('daily_briefings').update({ cleared_at: null }).eq('character_id', cid).eq('briefing_date', today);
    throw e;
  }

  const warnings: string[] = [];
  const step = async <T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> => {
    try { return await fn(); } catch (e) { warnings.push(label); console.error(`[completeQuest] ${label}:`, (e as Error).message); return fallback; }
  };
  await step('ledger', async () => {
    const xpRows = [{ character_id: cid, source: `quest:${quest.quest_type}`, amount: fin.xp }];
    const goldRows = [{ character_id: cid, amount: fin.gold, reason: `Quest: ${quest.title}`.slice(0, 120) }];
    if (dayCleared) { xpRows.push({ character_id: cid, source: 'day_cleared', amount: dayCleared.xp }); goldRows.push({ character_id: cid, amount: dayCleared.gold, reason: 'All quests cleared' }); }
    await db.from('xp_log').insert(xpRows); await db.from('gold_transactions').insert(goldRows);
  }, undefined);
  if (quest.goal_id) await step('goal', async () => { await db.from('goals').update({ status: 'done', completed_at: now.toISOString() }).eq('id', quest.goal_id!).eq('character_id', cid); }, undefined);
  const boss = await step('boss', () => hitBosses(db, p, quest, fin.xp), { hits: [] as BossHit[], extra: null as ProgressResult | null });
  progress = mergeProgress(progress, boss.extra);
  const guild = await step('guild', () => contributeToGuild(db, cid, fin.xp, fxBonusGuild), null);
  const awards = await step('awards', () => runAwards(db, { characterId: cid, userId: p.profile.id, campaignId: p.character.active_campaign_id }), emptyAwards());
  progress = mergeProgress(progress, awards.extra);
  if (progress.leveledUp) await step('notify', () => notify(db, p.profile.id, { type: 'level', title: `Level ${progress.levelAfter}!`, body: `You reached level ${progress.levelAfter}.` }), undefined);

  return { quest: { id: quest.id, title: quest.title, type: quest.quest_type }, xp: fin.xp, gold: fin.gold, stats: fin.stats, bonuses: fin.bonuses, dayCleared, progress, bosses: boss.hits, awards, guild, warnings };
}
