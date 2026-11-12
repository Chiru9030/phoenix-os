import { criteriaProgress, type CriteriaProgress } from '@/lib/game/criteria';
import { addDays, weekStartMonday } from '@/lib/game/dates';
import type { Criteria } from '@/lib/types';
import { must, type Db } from './util';
import type { AchievementRow, ChapterRow, GoalRow, HabitRow, InventoryRow, ItemRow, SkillNodeRow, StoryProgressRow, TitleRow } from './rows';
import type { Player } from './player';
import { buildCriteriaContext, loadEffects } from './progress';
import { buildWeeklyMetrics } from './reports';

export async function loadStory(db: Db, p: Player) {
  const cid = p.character.id, campaignId = p.character.active_campaign_id;
  const [chapters, progress, npcs, ctx] = await Promise.all([
    campaignId ? must<ChapterRow[]>(db.from('story_chapters').select('*').eq('campaign_id', campaignId).order('chapter_number')) : Promise.resolve([] as ChapterRow[]),
    must<StoryProgressRow[]>(db.from('character_story_progress').select('*').eq('character_id', cid)),
    campaignId ? must<{ name: string; role: string | null; description: string | null }[]>(db.from('npcs').select('name,role,description').eq('campaign_id', campaignId)) : Promise.resolve([]),
    buildCriteriaContext(db, cid, []),
  ]);
  const status = new Map(progress.map((r) => [r.chapter_id, r.status]));
  const list = chapters.map((c) => {
    const st = (c.chapter_number === 1 && !status.has(c.id) ? 'unlocked' : status.get(c.id) ?? 'locked') as 'locked' | 'unlocked' | 'completed';
    return { ...c, status: st, objective: st === 'locked' ? criteriaProgress(c.unlock_criteria as Criteria, ctx) : null as CriteriaProgress | null };
  });
  const current = [...list].reverse().find((c) => c.status !== 'locked') ?? list[0] ?? null;
  const next = list.find((c) => c.status === 'locked') ?? null;
  const uniqueNpcs = Array.from(new Map(npcs.map((n) => [n.name, n])).values());
  return { chapters: list, current, next, npcs: uniqueNpcs };
}
export type StoryView = Awaited<ReturnType<typeof loadStory>>;

export async function loadAchievements(db: Db, p: Player) {
  const cid = p.character.id;
  const [all, got] = await Promise.all([
    must<AchievementRow[]>(db.from('achievements').select('*').order('category')),
    must<{ achievement_id: string; unlocked_at: string }[]>(db.from('character_achievements').select('achievement_id,unlocked_at').eq('character_id', cid)),
  ]);
  const tags = [...new Set(all.flatMap((a) => (a.criteria.type === 'quest_completed_count' && a.criteria.tag ? [a.criteria.tag] : [])))];
  const ctx = await buildCriteriaContext(db, cid, tags);
  const at = new Map(got.map((g) => [g.achievement_id, g.unlocked_at]));
  return all.map((a) => ({ ...a, unlockedAt: at.get(a.id) ?? null, progress: criteriaProgress(a.criteria, ctx) }))
    .sort((x, y) => Number(!!y.unlockedAt) - Number(!!x.unlockedAt) || y.progress.current / y.progress.target - x.progress.current / x.progress.target);
}

export async function loadInventory(db: Db, p: Player) {
  const cid = p.character.id;
  const [inv, owned, allTitles] = await Promise.all([
    must<(InventoryRow & { items: ItemRow })[]>(db.from('character_inventory').select('*, items(*)').eq('character_id', cid)),
    must<{ title_id: string; is_equipped: boolean }[]>(db.from('character_titles').select('title_id,is_equipped').eq('character_id', cid)),
    must<TitleRow[]>(db.from('titles').select('*')),
  ]);
  const have = new Map(owned.map((o) => [o.title_id, o.is_equipped]));
  return {
    items: inv.filter((i) => i.items).map((i) => ({ ...i.items, quantity: i.quantity, equipped: i.equipped })),
    titles: allTitles.map((t) => ({ ...t, owned: have.has(t.id), equipped: have.get(t.id) ?? false })),
  };
}

export async function loadSkills(db: Db, p: Player) {
  const [nodes, have] = await Promise.all([
    must<SkillNodeRow[]>(db.from('skill_nodes').select('*').order('tier')),
    must<{ node_id: string }[]>(db.from('character_skills').select('node_id').eq('character_id', p.character.id)),
  ]);
  return { nodes, unlocked: have.map((h) => h.node_id), points: p.points };
}

export async function loadRewards(db: Db, p: Player) {
  const cid = p.character.id;
  const [custom, history, fx] = await Promise.all([
    must<{ id: string; label: string; gold_cost: number }[]>(db.from('rewards').select('id,label,gold_cost').eq('character_id', cid).eq('active', true).order('gold_cost')),
    must<{ id: string; reward_label: string; gold_cost: number; redeemed_at: string }[]>(db.from('reward_redemptions').select('*').eq('character_id', cid).order('redeemed_at', { ascending: false }).limit(8)),
    loadEffects(db, cid),
  ]);
  return { custom, history, discountPct: Math.min(50, fx.redemptionDiscountPct) };
}

export async function loadTasks(db: Db, p: Player) {
  const cid = p.character.id;
  const [goals, habits] = await Promise.all([
    must<GoalRow[]>(db.from('goals').select('*').eq('character_id', cid).neq('status', 'dropped').order('status').order('due_date', { ascending: true, nullsFirst: false }).limit(60)),
    must<HabitRow[]>(db.from('habits').select('*').eq('character_id', cid).order('created_at').limit(40)),
  ]);
  return { goals, habits };
}
export async function loadWeekXp(db: Db, p: Player, today: string) {
  const start = weekStartMonday(today);
  const m = await buildWeeklyMetrics(db, p, start);
  return { start, xpByDay: m.xpByDay, completed: m.questsCompleted, activeDays: m.activeDays, end: addDays(start, 6) };
}
