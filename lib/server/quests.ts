import { ALL_QUESTS_BONUS } from '@/lib/game/xp';
import { finalizeRewards } from '@/lib/game/effects';
import { damageForQuest } from '@/lib/game/bosses';
import { todayInTz } from '@/lib/game/dates';
import { computeBaseRewards, inferTags, normalizeTags } from '@/lib/game/rewards';
import { cleanText } from '@/lib/ai/sanitize';
import type { HybridDungeonMaster } from '@/lib/ai/hybrid';
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

export async function createQuickQuest(
  db: Db,
  p: Player,
  input: { title: string; type?: QuestType; tags?: string[]; description?: string },
  now = new Date()
): Promise<QuestRow> {
  const today = todayInTz(p.profile.timezone, now);
  const title = cleanText(input.title, 160);
  if (!title) throw new HttpError(400, 'Quest title is required.');
  const tags = input.tags && input.tags.length ? normalizeTags(input.tags) : inferTags(title);
  const type: QuestType = input.type ?? (title.length > 35 ? 'main' : 'side');
  const base = computeBaseRewards({ type, tags, level: p.character.level, difficulty: p.character.difficulty });
  const desc = input.description ? cleanText(input.description, 300) : `Adventurer's task: ${title}. Complete today to earn rewards.`;

  const quest = await must<QuestRow>(
    db.from('quests').insert({
      character_id: p.character.id,
      quest_date: today,
      quest_type: type,
      title,
      description: desc,
      tags,
      xp_reward: base.xp,
      gold_reward: base.gold,
      stat_rewards: base.stats,
      source: 'manual',
      double_xp: false,
    }).select('*').single(),
    'create quest'
  );
  return quest;
}

export async function deletePendingQuest(db: Db, p: Player, questId: string): Promise<void> {
  await must(
    db.from('quests')
      .delete()
      .eq('id', questId)
      .eq('character_id', p.character.id)
      .eq('status', 'pending')
  );
}

export interface AiQuestDraft {
  title: string;
  description: string;
  type: QuestType;
  tags: string[];
}

function proceduralQuests(prompt: string): AiQuestDraft[] {
  const p = prompt.toLowerCase();
  const drafts: AiQuestDraft[] = [];

  if (/(code|dev|program|react|next|node|python|java|api|sql|database|bug|git|fullstack|frontend|backend|dsa|leetcode|algo)/i.test(p)) {
    drafts.push({
      type: 'main',
      title: `Code Architecture: Core sprint on ${cleanText(prompt, 50)}`,
      description: `Construct and test the main functionality. Write clean code and keep your terminal green.`,
      tags: ['coding_practice', 'deep_work'],
    });
    drafts.push({
      type: 'side',
      title: `Problem Solving: Solve 1 algorithmic challenge`,
      description: `Sharpen your analytical problem-solving speed with an active coding exercise.`,
      tags: ['coding_practice', 'intelligence'],
    });
    drafts.push({
      type: 'daily_challenge',
      title: `Deep Focus Sprint: 45 minutes zero distractions`,
      description: `No social media or browser tab jumping. Pure developer flow state.`,
      tags: ['deep_work', 'discipline'],
    });
  } else if (/(study|exam|calculus|revision|test|quiz|semester|math|physics|college|notes|read|learn)/i.test(p)) {
    drafts.push({
      type: 'main',
      title: `Deep Study Session: Focus on ${cleanText(prompt, 50)}`,
      description: `Master the hardest concepts today. Take active notes and summarize formulas.`,
      tags: ['study', 'deep_work'],
    });
    drafts.push({
      type: 'side',
      title: `Active Recall: 25 minutes self-testing`,
      description: `Test yourself without looking at the notes to lock knowledge into long-term memory.`,
      tags: ['study', 'wisdom'],
    });
    drafts.push({
      type: 'daily_challenge',
      title: `Unbroken Focus: Complete 2 Pomodoro blocks`,
      description: `Stay seated and immersed until the timer chimes.`,
      tags: ['discipline', 'study'],
    });
  } else if (/(gym|workout|fitness|run|cardio|lift|weights|pushup|health|diet|walk|steps)/i.test(p)) {
    drafts.push({
      type: 'main',
      title: `Physical Conditioning: ${cleanText(prompt, 50)}`,
      description: `Push through your scheduled workout with full intensity and disciplined form.`,
      tags: ['gym', 'strength'],
    });
    drafts.push({
      type: 'side',
      title: `Hydration & Mobility: 2L water & 10m stretch`,
      description: `Hydrate your body and stretch your joints to accelerate muscle recovery.`,
      tags: ['hydration', 'cardio'],
    });
    drafts.push({
      type: 'daily_challenge',
      title: `Peak Effort: One extra set to failure`,
      description: `Give everything you have on the final set. Growth happens at the boundary.`,
      tags: ['gym', 'discipline'],
    });
  } else {
    drafts.push({
      type: 'main',
      title: `Primary Quest: Execute ${cleanText(prompt, 60)}`,
      description: `Tackle the most important priority on your plate today without hesitation.`,
      tags: ['deep_work', 'discipline'],
    });
    drafts.push({
      type: 'side',
      title: `Environment Reset: Clear workspace and organize tools`,
      description: `A clutter-free physical space creates mental clarity and unstoppable momentum.`,
      tags: ['admin', 'discipline'],
    });
    drafts.push({
      type: 'daily_challenge',
      title: `Unstoppable Momentum: 30 minutes single-tasking`,
      description: `Pick one crucial task and execute it with absolute, singular focus.`,
      tags: ['discipline', 'wisdom'],
    });
  }

  return drafts;
}

export async function generateAiQuests(
  db: Db,
  p: Player,
  _dm: HybridDungeonMaster,
  prompt: string,
  now = new Date()
): Promise<QuestRow[]> {
  const cleanPrompt = cleanText(prompt, 160);
  if (!cleanPrompt) throw new HttpError(400, 'Please enter a goal or topic for AI quest generation.');
  const today = todayInTz(p.profile.timezone, now);

  const pending = await countOf(
    db.from('quests').select('id', HEAD)
      .eq('character_id', p.character.id)
      .eq('quest_date', today)
      .eq('status', 'pending')
  );
  if (pending >= 12) throw new HttpError(400, 'You already have 12 pending quests today. Complete some before generating more.');

  const drafts = proceduralQuests(cleanPrompt);
  const rowsToInsert = drafts.map((d) => {
    const base = computeBaseRewards({ type: d.type, tags: d.tags, level: p.character.level, difficulty: p.character.difficulty });
    return {
      character_id: p.character.id,
      quest_date: today,
      quest_type: d.type,
      title: d.title,
      description: d.description,
      tags: d.tags,
      xp_reward: base.xp,
      gold_reward: base.gold,
      stat_rewards: base.stats,
      source: 'ai',
      double_xp: false,
    };
  });

  const quests = await must<QuestRow[]>(
    db.from('quests').insert(rowsToInsert).select('*'),
    'insert ai quests'
  );

  return quests;
}
