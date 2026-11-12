import { applyXpGain, skillPointsForLevelUp } from '@/lib/game/xp';
import { regenFreezeToken, updateStreakOnActivity, type StreakResult } from '@/lib/game/streaks';
import { aggregateEffects, type Effects } from '@/lib/game/effects';
import { isCriteriaMet } from '@/lib/game/criteria';
import { EMPTY_STATS, STAT_NAMES, type CharacterStats, type CriteriaContext } from '@/lib/types';
import { HttpError, maybe, must, num, type Db } from './util';
import type { AchievementRow, ChapterRow, StoryProgressRow, StreakRow, TitleRow } from './rows';
import { notify } from './notify';

export interface ProgressGrant { xp?: number; gold?: number; stats?: Partial<CharacterStats>; streak?: { today: string; regenMultiplier: number } }
export interface ProgressResult {
  levelBefore: number; levelAfter: number; leveledUp: boolean; skillPointsGained: number; currentXp: number; xpToNext: number;
  streak?: { current: number; longest: number; freezeUsed: boolean; broken: boolean; freezeEarned: boolean };
}

/**
 * The single door through which XP / gold / stats / streak change. Uses a compare-and-set RPC and retries,
 * so two quests completed at the same instant can never overwrite each other's rewards.
 */
export async function grantProgress(db: Db, characterId: string, g: ProgressGrant): Promise<ProgressResult> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const ch = await must<{ level: number; current_xp: number }>(db.from('characters').select('level,current_xp').eq('id', characterId).single());
    const st = g.streak ? await must<StreakRow>(db.from('streaks').select('*').eq('character_id', characterId).single()) : null;
    const xp = Math.max(0, Math.round(g.xp ?? 0));
    const x = applyXpGain(ch.level, ch.current_xp, xp);
    const pts = skillPointsForLevelUp(ch.level, x.newLevel);
    let sr: StreakResult | undefined; let freezeEarned = false;
    if (g.streak && st) {
      sr = updateStreakOnActivity(g.streak.today, st.last_active_date, st.current_streak, st.longest_streak, st.freeze_tokens);
      if (sr.currentStreak > st.current_streak) {
        const t = regenFreezeToken(sr.currentStreak, sr.freezeTokens, g.streak.regenMultiplier);
        freezeEarned = t > sr.freezeTokens; sr = { ...sr, freezeTokens: t };
      }
    }
    const { data, error } = await db.rpc('apply_progress', {
      p_character: characterId, p_expect_level: ch.level, p_expect_xp: ch.current_xp, p_new_level: x.newLevel, p_new_xp: x.newCurrentXp,
      p_xp_delta: xp, p_gold_delta: Math.round(g.gold ?? 0), p_stat_deltas: g.stats ?? {}, p_points_delta: pts,
      p_touch_streak: !!g.streak, p_expect_last: st?.last_active_date ?? null, p_streak_current: sr?.currentStreak ?? 0,
      p_streak_longest: sr?.longestStreak ?? 0, p_streak_freeze: sr?.freezeTokens ?? 0, p_streak_date: g.streak?.today ?? null,
    });
    if (error) throw new Error(`apply_progress: ${error.message}`);
    if (data === true) {
      return {
        levelBefore: ch.level, levelAfter: x.newLevel, leveledUp: x.leveledUp, skillPointsGained: pts, currentXp: x.newCurrentXp, xpToNext: x.xpToNext,
        streak: sr ? { current: sr.currentStreak, longest: sr.longestStreak, freezeUsed: sr.freezeUsed, broken: sr.broken, freezeEarned } : undefined,
      };
    }
  }
  throw new HttpError(409, 'The realm is busy. Please try again.');
}
export function mergeProgress(a: ProgressResult, b: ProgressResult | null): ProgressResult {
  if (!b) return a;
  return { ...a, levelAfter: b.levelAfter, leveledUp: a.leveledUp || b.leveledUp, skillPointsGained: a.skillPointsGained + b.skillPointsGained, currentXp: b.currentXp, xpToNext: b.xpToNext };
}

export async function loadEffects(db: Db, characterId: string): Promise<Effects> {
  const [skills, gear] = await Promise.all([
    must<{ skill_nodes: { effect: Record<string, unknown> } | null }[]>(db.from('character_skills').select('skill_nodes(effect)').eq('character_id', characterId)),
    must<{ items: { effect: Record<string, unknown> } | null }[]>(db.from('character_inventory').select('items(effect)').eq('character_id', characterId).eq('equipped', true)),
  ]);
  const sources = [...skills.map((s) => s.skill_nodes), ...gear.map((g) => g.items)].filter((x): x is { effect: Record<string, unknown> } => !!x);
  return aggregateEffects(sources);
}

export async function grantItem(db: Db, characterId: string, key: string) {
  const { data, error } = await db.rpc('grant_item', { p_character: characterId, p_item_key: key, p_qty: 1 });
  if (error || !data) return null;
  return { key, name: String((data as Record<string, unknown>).name), isNew: !!(data as Record<string, unknown>).is_new };
}
export async function grantTitle(db: Db, characterId: string, key: string): Promise<string | null> {
  const t = await maybe<TitleRow>(db.from('titles').select('*').eq('key', key).maybeSingle());
  if (!t) return null;
  const r = await must<unknown[]>(db.from('character_titles').upsert({ character_id: characterId, title_id: t.id }, { onConflict: 'character_id,title_id', ignoreDuplicates: true }).select());
  if (!r.length) return null;
  const equipped = await must<unknown[]>(db.from('character_titles').select('title_id').eq('character_id', characterId).eq('is_equipped', true));
  if (!equipped.length) await db.from('character_titles').update({ is_equipped: true }).eq('character_id', characterId).eq('title_id', t.id);
  return t.name;
}

export async function buildCriteriaContext(db: Db, characterId: string, tags: string[]): Promise<CriteriaContext> {
  const count = async (q: PromiseLike<{ count: number | null; error: { message: string } | null }>) => { const r = await q; if (r.error) throw new Error(r.error.message); return r.count ?? 0; };
  const head = { count: 'exact' as const, head: true };
  const [ch, statsRow, streak, total, bosses, skills, guild] = await Promise.all([
    must<{ level: number }>(db.from('characters').select('level').eq('id', characterId).single()),
    must<Record<string, unknown>>(db.from('character_stats').select('*').eq('character_id', characterId).single()),
    must<StreakRow>(db.from('streaks').select('*').eq('character_id', characterId).single()),
    count(db.from('quests').select('id', head).eq('character_id', characterId).eq('status', 'completed')),
    count(db.from('boss_battles').select('id', head).eq('character_id', characterId).eq('status', 'defeated')),
    count(db.from('character_skills').select('node_id', head).eq('character_id', characterId)),
    count(db.from('guild_members').select('guild_id', head).eq('character_id', characterId)),
  ]);
  const tagCounts = await Promise.all(tags.map((t) => count(db.from('quests').select('id', head).eq('character_id', characterId).eq('status', 'completed').contains('tags', [t]))));
  const stats: CharacterStats = { ...EMPTY_STATS };
  for (const s of STAT_NAMES) stats[s] = num(statsRow[s]);
  return {
    level: ch.level, stats, currentStreak: streak.current_streak, longestStreak: streak.longest_streak, totalQuestsCompleted: total,
    questsByTag: Object.fromEntries(tags.map((t, i) => [t, tagCounts[i]])), bossesDefeated: bosses, skillsUnlocked: skills, inGuild: guild > 0,
  };
}

export interface AchievementUnlock { key: string; name: string; description: string; icon: string; rewardXp: number; rewardGold: number; itemName?: string; titleName?: string }
export interface ChapterUnlock { title: string; rewardGold: number; itemName?: string }
export interface AwardSummary { achievements: AchievementUnlock[]; chapters: ChapterUnlock[]; items: { name: string; isNew: boolean }[]; titles: string[]; extra: ProgressResult | null }

async function syncStory(db: Db, characterId: string, userId: string, campaignId: string | null, ctx: CriteriaContext): Promise<(ChapterUnlock & { itemKey: string | null })[]> {
  if (!campaignId) return [];
  const chapters = await must<ChapterRow[]>(db.from('story_chapters').select('*').eq('campaign_id', campaignId).order('chapter_number'));
  const prog = await must<StoryProgressRow[]>(db.from('character_story_progress').select('*').eq('character_id', characterId));
  const byId = new Map(prog.map((r) => [r.chapter_id, r.status as string]));
  const missing = chapters.filter((c) => !byId.has(c.id));
  if (missing.length) {
    await must(db.from('character_story_progress').upsert(missing.map((c) => ({ character_id: characterId, chapter_id: c.id, status: c.chapter_number === 1 ? 'unlocked' : 'locked', unlocked_at: c.chapter_number === 1 ? new Date().toISOString() : null })), { onConflict: 'character_id,chapter_id', ignoreDuplicates: true }).select());
    missing.forEach((c) => byId.set(c.id, c.chapter_number === 1 ? 'unlocked' : 'locked'));
  }
  const unlocked: (ChapterUnlock & { itemKey: string | null })[] = [];
  for (let i = 1; i < chapters.length; i++) {
    const c = chapters[i];
    if (byId.get(c.id) !== 'locked') continue;
    if (byId.get(chapters[i - 1].id) === 'locked' || !isCriteriaMet(c.unlock_criteria, ctx)) continue;
    const now = new Date().toISOString();
    const won = await must<unknown[]>(db.from('character_story_progress').update({ status: 'unlocked', unlocked_at: now }).eq('character_id', characterId).eq('chapter_id', c.id).eq('status', 'locked').select());
    if (!won.length) continue; // another request got there first
    byId.set(c.id, 'unlocked');
    await db.from('character_story_progress').update({ status: 'completed', completed_at: now }).eq('character_id', characterId).eq('chapter_id', chapters[i - 1].id).eq('status', 'unlocked');
    byId.set(chapters[i - 1].id, 'completed');
    unlocked.push({ title: c.title, rewardGold: c.reward_gold, itemKey: c.reward_item_key });
    await notify(db, userId, { type: 'story', title: 'New chapter unlocked', body: c.title });
  }
  return unlocked;
}

/** After any progress: unlock achievements + story chapters, pay their rewards, and repeat while rewards unlock more. */
export async function runAwards(db: Db, who: { characterId: string; userId: string; campaignId: string | null }): Promise<AwardSummary> {
  const out: AwardSummary = { achievements: [], chapters: [], items: [], titles: [], extra: null };
  for (let round = 0; round < 4; round++) {
    const [all, got] = await Promise.all([
      must<AchievementRow[]>(db.from('achievements').select('*')),
      must<{ achievement_id: string }[]>(db.from('character_achievements').select('achievement_id').eq('character_id', who.characterId)),
    ]);
    const have = new Set(got.map((g) => g.achievement_id));
    const pending = all.filter((a) => !have.has(a.id));
    const tags = [...new Set(pending.flatMap((a) => (a.criteria.type === 'quest_completed_count' && a.criteria.tag ? [a.criteria.tag] : [])))];
    const ctx = await buildCriteriaContext(db, who.characterId, tags);
    const fresh = pending.filter((a) => isCriteriaMet(a.criteria, ctx));
    const chapters = await syncStory(db, who.characterId, who.userId, who.campaignId, ctx);
    if (!fresh.length && !chapters.length) break;
    let xp = 0, gold = 0;
    for (const a of fresh) {
      const ins = await must<unknown[]>(db.from('character_achievements').upsert({ character_id: who.characterId, achievement_id: a.id }, { onConflict: 'character_id,achievement_id', ignoreDuplicates: true }).select());
      if (!ins.length) continue;
      xp += a.reward_xp; gold += a.reward_gold;
      const unlock: AchievementUnlock = { key: a.key, name: a.name, description: a.description, icon: a.icon, rewardXp: a.reward_xp, rewardGold: a.reward_gold };
      if (a.reward_item_key) { const it = await grantItem(db, who.characterId, a.reward_item_key); if (it) { unlock.itemName = it.name; out.items.push({ name: it.name, isNew: it.isNew }); } }
      if (a.reward_title_key) { const tn = await grantTitle(db, who.characterId, a.reward_title_key); if (tn) { unlock.titleName = tn; out.titles.push(tn); } }
      out.achievements.push(unlock);
      await notify(db, who.userId, { type: 'achievement', title: `Achievement: ${a.name}`, body: a.description });
    }
    for (const c of chapters) {
      gold += c.rewardGold;
      const unlock: ChapterUnlock = { title: c.title, rewardGold: c.rewardGold };
      if (c.itemKey) { const it = await grantItem(db, who.characterId, c.itemKey); if (it) { unlock.itemName = it.name; out.items.push({ name: it.name, isNew: it.isNew }); } }
      out.chapters.push(unlock);
    }
    if (xp || gold) {
      const r = await grantProgress(db, who.characterId, { xp, gold });
      out.extra = out.extra ? mergeProgress(out.extra, r) : r;
      if (xp) await db.from('xp_log').insert({ character_id: who.characterId, source: 'achievement', amount: xp });
      if (gold) await db.from('gold_transactions').insert({ character_id: who.characterId, amount: gold, reason: 'Achievement & chapter rewards' });
    }
  }
  return out;
}
