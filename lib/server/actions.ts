import { randomInt } from 'node:crypto';
import { z } from 'zod';
import { cleanText } from '@/lib/ai/sanitize';
import { CLOSERS, OPENERS, voiceFor } from '@/lib/ai/content';
import { hashString } from '@/lib/ai/rng';
import { inferTags, normalizeTags } from '@/lib/game/rewards';
import { DEFAULT_REWARD_TIERS, discountedCost } from '@/lib/game/economy';
import { canUnlockSkill } from '@/lib/game/skills';
import { SPIN_WHEEL, type SpinPrize } from '@/lib/game/events';
import { dayOfWeekFor, todayInTz } from '@/lib/game/dates';
import type { QuestType } from '@/lib/types';
import { HEAD, HttpError, countOf, maybe, must, type Db } from './util';
import type { EventRow, GoalRow, HabitRow, InventoryRow, ItemRow, SkillNodeRow } from './rows';
import type { Player } from './player';
import { GoalSchema, HabitSchema, RewardSchema } from './schemas';
import { grantItem, grantProgress, loadEffects, runAwards, type AwardSummary, type ProgressResult, mergeProgress } from './progress';
import { materializeToday } from './daily';

const flavor = (type: QuestType, seed: string, npc: string) => `${OPENERS[type][hashString(seed) % OPENERS[type].length]} ${CLOSERS[hashString(seed + 'c') % CLOSERS.length].replace('{npc}', npc)}`;

// ── goals & habits (the real-life tasks the Dungeon Master turns into quests) ──
export async function createGoal(db: Db, p: Player, input: z.infer<typeof GoalSchema>, now = new Date()) {
  if ((await countOf(db.from('goals').select('id', HEAD).eq('character_id', p.character.id).eq('status', 'active'))) >= 50) throw new HttpError(400, 'You have 50 active goals. Finish or drop some first.');
  const title = cleanText(input.title, 160), tags = normalizeTags(input.tags ?? []);
  const goal = await must<GoalRow>(db.from('goals').insert({
    character_id: p.character.id, title, notes: input.notes ? cleanText(input.notes, 400) : null, tags: tags.length ? tags : inferTags(title), quest_type: input.questType, due_date: input.dueDate ?? null,
  }).select('*').single());
  const onBoard = await materializeToday(db, p, { type: goal.quest_type, title: goal.title, description: flavor(goal.quest_type, goal.id, voiceFor(p.campaign?.slug ?? 'general').npc), tags: goal.tags, goalId: goal.id }, now);
  return { goal, onBoard };
}
export async function setGoalStatus(db: Db, p: Player, id: string, status: 'active' | 'done' | 'dropped') {
  const rows = await must<GoalRow[]>(db.from('goals').update({ status, completed_at: status === 'done' ? new Date().toISOString() : null }).eq('id', id).eq('character_id', p.character.id).select('*'));
  if (!rows.length) throw new HttpError(404, 'Goal not found');
  if (status !== 'active') await db.from('quests').delete().eq('goal_id', id).eq('character_id', p.character.id).eq('status', 'pending');
  return rows[0];
}
export async function deleteGoal(db: Db, p: Player, id: string) { await must(db.from('goals').delete().eq('id', id).eq('character_id', p.character.id)); }

export async function createHabit(db: Db, p: Player, input: z.infer<typeof HabitSchema>, now = new Date()) {
  if ((await countOf(db.from('habits').select('id', HEAD).eq('character_id', p.character.id).eq('active', true))) >= 30) throw new HttpError(400, 'You have 30 active habits. Pause some first.');
  const title = cleanText(input.title, 120), tags = normalizeTags(input.tags ?? []);
  const habit = await must<HabitRow>(db.from('habits').insert({
    character_id: p.character.id, title, tags: tags.length ? tags : inferTags(title), quest_type: input.questType, days_of_week: [...new Set(input.daysOfWeek)].sort(),
  }).select('*').single());
  const today = todayInTz(p.profile.timezone, now);
  const onBoard = habit.days_of_week.includes(dayOfWeekFor(today))
    ? await materializeToday(db, p, { type: habit.quest_type, title: habit.title, description: flavor(habit.quest_type, habit.id, voiceFor(p.campaign?.slug ?? 'general').npc), tags: habit.tags, habitId: habit.id }, now) : false;
  return { habit, onBoard };
}
export async function setHabitActive(db: Db, p: Player, id: string, active: boolean) {
  const rows = await must<HabitRow[]>(db.from('habits').update({ active }).eq('id', id).eq('character_id', p.character.id).select('*'));
  if (!rows.length) throw new HttpError(404, 'Habit not found');
  return rows[0];
}
export async function deleteHabit(db: Db, p: Player, id: string) { await must(db.from('habits').delete().eq('id', id).eq('character_id', p.character.id)); }

// ── gold economy ──
export const RedeemSchema = z.discriminatedUnion('kind', [z.object({ kind: z.literal('default'), index: z.number().int().min(0) }), z.object({ kind: z.literal('custom'), id: z.string().uuid() })]);
export async function createReward(db: Db, p: Player, input: z.infer<typeof RewardSchema>) {
  if ((await countOf(db.from('rewards').select('id', HEAD).eq('character_id', p.character.id).eq('active', true))) >= 20) throw new HttpError(400, 'You have 20 custom rewards already.');
  return must(db.from('rewards').insert({ character_id: p.character.id, label: cleanText(input.label, 80), gold_cost: input.goldCost }).select('*').single());
}
export async function deleteReward(db: Db, p: Player, id: string) { await must(db.from('rewards').update({ active: false }).eq('id', id).eq('character_id', p.character.id)); }
export async function redeem(db: Db, p: Player, sel: z.infer<typeof RedeemSchema>) {
  const cid = p.character.id; let label: string, cost: number;
  if (sel.kind === 'default') { const t = DEFAULT_REWARD_TIERS[sel.index]; if (!t) throw new HttpError(404, 'Unknown reward'); label = t.label; cost = t.goldCost; }
  else { const r = await maybe<{ label: string; gold_cost: number; active: boolean }>(db.from('rewards').select('*').eq('id', sel.id).eq('character_id', cid).maybeSingle()); if (!r || !r.active) throw new HttpError(404, 'Reward not found'); label = r.label; cost = r.gold_cost; }
  const fx = await loadEffects(db, cid), price = discountedCost(cost, fx.redemptionDiscountPct);
  const { data, error } = await db.rpc('spend_gold', { p_character: cid, p_amount: price });
  if (error) throw new Error(error.message);
  if (data === -1) throw new HttpError(402, `You need ${price} Gold for that reward.`);
  await db.from('reward_redemptions').insert({ character_id: cid, reward_label: label, gold_cost: price });
  await db.from('gold_transactions').insert({ character_id: cid, amount: -price, reason: `Redeemed: ${label}`.slice(0, 120) });
  return { label, price, goldLeft: data as number };
}

// ── inventory ──
export async function useItem(db: Db, p: Player, key: string) {
  const cid = p.character.id;
  const item = await maybe<ItemRow>(db.from('items').select('*').eq('key', key).maybeSingle());
  if (!item || item.item_type !== 'consumable') throw new HttpError(400, 'That item cannot be used.');
  for (let i = 0; ; i++) { // consume one with compare-and-set on quantity
    const inv = await maybe<InventoryRow>(db.from('character_inventory').select('*').eq('character_id', cid).eq('item_id', item.id).maybeSingle());
    if (!inv || inv.quantity < 1) throw new HttpError(404, 'You do not have that item.');
    const q = inv.quantity === 1
      ? db.from('character_inventory').delete().eq('character_id', cid).eq('item_id', item.id).eq('quantity', 1).select()
      : db.from('character_inventory').update({ quantity: inv.quantity - 1 }).eq('character_id', cid).eq('item_id', item.id).eq('quantity', inv.quantity).select();
    if ((await must<unknown[]>(q)).length) break;
    if (i >= 3) throw new HttpError(409, 'Busy, try again.');
  }
  const use = ((item.effect as { use?: { xp?: number; gold?: number; freeze_token?: number } }).use) ?? {};
  let progress: ProgressResult = await grantProgress(db, cid, { xp: use.xp ?? 0, gold: use.gold ?? 0 });
  if (use.freeze_token) {
    const st = await must<{ freeze_tokens: number }>(db.from('streaks').select('freeze_tokens').eq('character_id', cid).single());
    await db.from('streaks').update({ freeze_tokens: Math.min(3, st.freeze_tokens + use.freeze_token) }).eq('character_id', cid);
  }
  if (use.xp) await db.from('xp_log').insert({ character_id: cid, source: `item:${key}`, amount: use.xp });
  if (use.gold) await db.from('gold_transactions').insert({ character_id: cid, amount: use.gold, reason: `Used ${item.name}` });
  const awards = await runAwards(db, { characterId: cid, userId: p.profile.id, campaignId: p.character.active_campaign_id });
  progress = mergeProgress(progress, awards.extra);
  return { item: item.name, xp: use.xp ?? 0, gold: use.gold ?? 0, freezeToken: use.freeze_token ?? 0, progress, awards };
}
export async function equipItem(db: Db, p: Player, key: string, equip: boolean) {
  const cid = p.character.id;
  const item = await maybe<ItemRow>(db.from('items').select('*').eq('key', key).maybeSingle());
  if (!item || !item.slot) throw new HttpError(400, 'That item cannot be equipped.');
  const inv = await maybe<InventoryRow>(db.from('character_inventory').select('*').eq('character_id', cid).eq('item_id', item.id).maybeSingle());
  if (!inv) throw new HttpError(404, 'You do not own that item.');
  if (equip) {
    const worn = await must<{ item_id: string; items: { slot: string } | null }[]>(db.from('character_inventory').select('item_id, items(slot)').eq('character_id', cid).eq('equipped', true));
    for (const w of worn.filter((x) => x.items?.slot === item.slot)) await db.from('character_inventory').update({ equipped: false }).eq('character_id', cid).eq('item_id', w.item_id);
  }
  await must(db.from('character_inventory').update({ equipped: equip }).eq('character_id', cid).eq('item_id', item.id));
  return { item: item.name, equipped: equip };
}
export async function equipTitle(db: Db, p: Player, titleKey: string | null) {
  const cid = p.character.id;
  await db.from('character_titles').update({ is_equipped: false }).eq('character_id', cid);
  if (!titleKey) return null;
  const t = await maybe<{ id: string; name: string }>(db.from('titles').select('id,name').eq('key', titleKey).maybeSingle());
  if (!t) throw new HttpError(404, 'Unknown title');
  const rows = await must<unknown[]>(db.from('character_titles').update({ is_equipped: true }).eq('character_id', cid).eq('title_id', t.id).select());
  if (!rows.length) throw new HttpError(403, 'You have not earned that title.');
  return t.name;
}

// ── skill tree ──
export async function unlockSkill(db: Db, p: Player, key: string) {
  const cid = p.character.id;
  const node = await maybe<SkillNodeRow>(db.from('skill_nodes').select('*').eq('key', key).maybeSingle());
  if (!node) throw new HttpError(404, 'Unknown skill');
  const [have, pts] = await Promise.all([
    must<{ node_id: string }[]>(db.from('character_skills').select('node_id').eq('character_id', cid)),
    must<{ available_points: number }>(db.from('character_skill_points').select('available_points').eq('character_id', cid).single()),
  ]);
  const check = canUnlockSkill(node, new Set(have.map((h) => h.node_id)), pts.available_points);
  if (!check.ok) throw new HttpError(400, check.reason ?? 'Cannot unlock');
  const { data: spent } = await db.rpc('spend_skill_points', { p_character: cid, p_cost: node.cost });
  if (!spent) throw new HttpError(400, 'Not enough skill points');
  const ins = await db.from('character_skills').insert({ character_id: cid, node_id: node.id });
  if (ins.error) { await db.from('character_skill_points').update({ available_points: pts.available_points }).eq('character_id', cid); throw new HttpError(409, 'Already unlocked'); }
  const awards = await runAwards(db, { characterId: cid, userId: p.profile.id, campaignId: p.character.active_campaign_id });
  return { node: node.name, awards };
}

// ── lucky spin ──
export async function spinWheel(db: Db, p: Player, now = new Date()) {
  const cid = p.character.id, today = todayInTz(p.profile.timezone, now);
  const won = await must<EventRow[]>(db.from('random_events').update({ resolved: true }).eq('character_id', cid).eq('event_date', today).eq('event_type', 'lucky_spin').eq('resolved', false).select('*'));
  if (!won.length) throw new HttpError(409, 'There is no wheel to spin right now.');
  const index = randomInt(SPIN_WHEEL.length), prize: SpinPrize = SPIN_WHEEL[index];
  let progress: ProgressResult | null = null, itemName: string | undefined;
  if (prize.kind === 'gold') { progress = await grantProgress(db, cid, { gold: prize.amount }); await db.from('gold_transactions').insert({ character_id: cid, amount: prize.amount!, reason: 'Lucky Spin' }); }
  if (prize.kind === 'xp') { progress = await grantProgress(db, cid, { xp: prize.amount }); await db.from('xp_log').insert({ character_id: cid, source: 'lucky_spin', amount: prize.amount! }); }
  if (prize.kind === 'item') itemName = (await grantItem(db, cid, prize.itemKey!))?.name;
  const awards: AwardSummary = await runAwards(db, { characterId: cid, userId: p.profile.id, campaignId: p.character.active_campaign_id });
  return { index, prize, itemName, progress: progress ? mergeProgress(progress, awards.extra) : awards.extra, awards, segments: SPIN_WHEEL.length };
}
