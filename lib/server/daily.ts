import { addDays, dayName, dayOfWeekFor, isWeekend, todayInTz } from '@/lib/game/dates';
import { computeBaseRewards } from '@/lib/game/rewards';
import { EVENT_TITLES, describeEvent, rollDailyEvent } from '@/lib/game/events';
import { BOSS_DURATION_DAYS, bossRewards, maxHpFor, nextBossDifficulty } from '@/lib/game/bosses';
import { streakStatus } from '@/lib/game/streaks';
import type { HybridDungeonMaster } from '@/lib/ai/hybrid';
import type { QuestContext, QuestDraft, RandomEventType } from '@/lib/types';
import { HEAD, countOf, maybe, must, type Db } from './util';
import type { BossRow, BriefingRow, EventRow, GoalRow, HabitRow, QuestRow } from './rows';
import type { Player } from './player';
import { grantProgress, loadEffects } from './progress';
import { notify, prefAllows } from './notify';

export interface DayState { today: string; quests: QuestRow[]; briefing: BriefingRow | null; event: EventRow | null; boss: BossRow | null; hiddenBoss: BossRow | null }
const TYPE_ORDER: Record<string, number> = { boss_fight: 0, main: 1, daily_challenge: 2, side: 3 };

async function currentChapterTitle(db: Db, p: Player): Promise<string | undefined> {
  if (!p.character.active_campaign_id) return undefined;
  const rows = await must<{ status: string; story_chapters: { title: string; chapter_number: number; campaign_id: string } | null }[]>(
    db.from('character_story_progress').select('status, story_chapters(title, chapter_number, campaign_id)').eq('character_id', p.character.id).neq('status', 'locked'));
  const mine = rows.map((r) => r.story_chapters).filter((c): c is NonNullable<typeof c> => !!c && c.campaign_id === p.character.active_campaign_id);
  return mine.sort((a, b) => b.chapter_number - a.chapter_number)[0]?.title;
}

export async function buildQuestContext(db: Db, p: Player, today: string, doubleXp: boolean): Promise<QuestContext> {
  const cid = p.character.id, dow = dayOfWeekFor(today);
  const [goals, habits, recent, chapter, npc] = await Promise.all([
    must<GoalRow[]>(db.from('goals').select('*').eq('character_id', cid).eq('status', 'active').order('due_date', { ascending: true, nullsFirst: false }).limit(30)),
    must<HabitRow[]>(db.from('habits').select('*').eq('character_id', cid).eq('active', true).limit(40)),
    must<{ title: string }[]>(db.from('quests').select('title').eq('character_id', cid).gte('quest_date', addDays(today, -7)).lt('quest_date', today).limit(80)),
    currentChapterTitle(db, p),
    p.character.active_campaign_id ? must<{ name: string }[]>(db.from('npcs').select('name').eq('campaign_id', p.character.active_campaign_id).limit(1)) : Promise.resolve([]),
  ]);
  return {
    characterName: p.character.name, level: p.character.level, stats: p.stats, campaignSlug: p.campaign?.slug ?? 'general', campaignName: p.campaign?.name ?? 'The Adventurer\'s Path',
    chapterTitle: chapter, npcName: npc[0]?.name, isoDate: today, dayName: dayName(today), dayOfWeek: dow, isWeekend: isWeekend(today), difficulty: p.character.difficulty,
    currentStreak: streakStatus(today, p.streak.last_active_date, p.streak.current_streak, p.streak.freeze_tokens).display, focusStats: p.character.focus_stats,
    recentTitles: recent.map((r) => r.title),
    goals: goals.map((g) => ({ id: g.id, title: g.title, tags: g.tags, questType: g.quest_type, dueDate: g.due_date, notes: g.notes })),
    habits: habits.filter((h) => h.days_of_week.includes(dow)).map((h) => ({ id: h.id, title: h.title, tags: h.tags, questType: h.quest_type })),
    doubleXpActive: doubleXp,
  };
}

export function questRow(p: Player, today: string, d: QuestDraft, source: 'ai' | 'offline' | 'manual' | 'event', doubleXp: boolean, mult = 1) {
  const base = computeBaseRewards({ type: d.type, tags: d.tags, level: p.character.level, difficulty: p.character.difficulty });
  return {
    character_id: p.character.id, quest_date: today, quest_type: d.type, title: d.title, description: d.description, tags: d.tags,
    xp_reward: Math.round(base.xp * mult), gold_reward: Math.round(base.gold * mult), stat_rewards: base.stats, source, double_xp: doubleXp,
    goal_id: d.goalId ?? null, habit_id: d.habitId ?? null,
  };
}

async function tryLock(db: Db, cid: string, today: string): Promise<boolean> {
  const rows = await must<unknown[]>(db.from('daily_briefings').upsert({ character_id: cid, briefing_date: today, narrative: '…', generated_by: 'pending' }, { onConflict: 'character_id,briefing_date', ignoreDuplicates: true }).select());
  return rows.length > 0;
}

async function spawnHiddenBoss(db: Db, p: Player, dm: HybridDungeonMaster, now: Date) {
  const maxHp = Math.round(maxHpFor(p.character.level, 'hard') * 0.45);
  const draft = await dm.generateBoss({ characterName: p.character.name, level: p.character.level, campaignSlug: p.campaign?.slug ?? 'general', campaignName: p.campaign?.name ?? '', difficulty: 'hard', seed: `${p.character.id}:hidden:${now.toISOString().slice(0, 10)}` });
  const r = bossRewards(maxHp * 2, 'hard');
  await db.from('boss_battles').insert({ character_id: p.character.id, campaign_id: p.character.active_campaign_id, name: draft.value.name, description: draft.value.description, difficulty: 'hard', max_hp: maxHp, current_hp: maxHp, xp_reward: r.xp, gold_reward: r.gold, item_reward_key: 'streak_charm', is_hidden: true, expires_at: new Date(now.getTime() + 22 * 3600_000).toISOString() });
}

async function persistEvent(db: Db, p: Player, dm: HybridDungeonMaster, today: string, type: RandomEventType, now: Date) {
  const info = describeEvent(type);
  const inserted = await must<unknown[]>(db.from('random_events').upsert({ character_id: p.character.id, event_date: today, event_type: type, description: info.description, effect: info.effect, resolved: type !== 'lucky_spin' }, { onConflict: 'character_id,event_date', ignoreDuplicates: true }).select());
  if (!inserted.length) return;
  if (type === 'treasure_chest') {
    await grantProgress(db, p.character.id, { gold: 75 });
    await db.from('gold_transactions').insert({ character_id: p.character.id, amount: 75, reason: 'Treasure Chest' });
  }
  if (type === 'hidden_boss') await spawnHiddenBoss(db, p, dm, now);
  await notify(db, p.profile.id, { type: 'event', title: EVENT_TITLES[type], body: info.description });
}

async function generateDay(db: Db, p: Player, dm: HybridDungeonMaster, today: string, now: Date, push: boolean) {
  const cid = p.character.id;
  await db.from('quests').delete().eq('character_id', cid).eq('quest_date', today).eq('status', 'pending'); // clear debris from a crashed attempt
  const fx = await loadEffects(db, cid);
  const existing = await maybe<EventRow>(db.from('random_events').select('*').eq('character_id', cid).eq('event_date', today).maybeSingle());
  const eventType = existing?.event_type ?? rollDailyEvent(isWeekend(today), fx.eventChanceBonusPct);
  const isDouble = eventType === 'double_xp';
  const ctx = await buildQuestContext(db, p, today, isDouble);
  const dq = await dm.generateDailyQuests(ctx);
  const rows = dq.value.map((d) => questRow(p, today, d, dq.source, isDouble));
  const shown = dq.value.map((d) => ({ type: d.type, title: d.title }));
  if (eventType === 'secret_quest') { const s = dm.secretQuest(ctx); rows.push(questRow(p, today, s, 'event', isDouble, 2)); shown.push({ type: s.type, title: s.title }); }
  await must(db.from('quests').insert(rows), 'insert quests');
  if (eventType) await persistEvent(db, p, dm, today, eventType, now);
  const brief = await dm.generateBriefing({ ...ctx, drafts: shown, eventDescription: eventType ? describeEvent(eventType).description : undefined });
  await must(db.from('daily_briefings').update({ narrative: brief.value, generated_by: brief.source === 'ai' ? brief.provider : 'offline' }).eq('character_id', cid).eq('briefing_date', today));
  if (prefAllows(p.profile.notification_prefs, 'morning_quests')) await notify(db, p.profile.id, { type: 'morning', title: 'Your quests are ready', body: `${shown.length} quests await, ${p.character.name}.`, push });
}

async function ensureBoss(db: Db, p: Player, dm: HybridDungeonMaster, now: Date) {
  const cid = p.character.id;
  const active = await countOf(db.from('boss_battles').select('id', HEAD).eq('character_id', cid).eq('status', 'active').eq('is_hidden', false));
  if (active > 0) return;
  const defeated = await countOf(db.from('boss_battles').select('id', HEAD).eq('character_id', cid).eq('status', 'defeated').eq('is_hidden', false));
  const difficulty = nextBossDifficulty(p.character.level, defeated);
  const maxHp = maxHpFor(p.character.level, difficulty), r = bossRewards(maxHp, difficulty);
  const draft = await dm.generateBoss({ characterName: p.character.name, level: p.character.level, campaignSlug: p.campaign?.slug ?? 'general', campaignName: p.campaign?.name ?? '', difficulty, seed: `${cid}:${defeated}` });
  const res = await db.from('boss_battles').insert({
    character_id: cid, campaign_id: p.character.active_campaign_id, name: draft.value.name, description: draft.value.description, difficulty, max_hp: maxHp, current_hp: maxHp,
    xp_reward: r.xp, gold_reward: r.gold, item_reward_key: r.itemKey, expires_at: new Date(now.getTime() + BOSS_DURATION_DAYS * 86_400_000).toISOString(),
  });
  if (res.error && res.error.code !== '23505') throw new Error(res.error.message); // 23505 = another request spawned it first
  if (!res.error) await notify(db, p.profile.id, { type: 'boss', title: 'A boss approaches', body: draft.value.name });
}

export async function loadDay(db: Db, p: Player, today: string): Promise<DayState> {
  const cid = p.character.id;
  const [quests, briefing, event, bosses] = await Promise.all([
    must<QuestRow[]>(db.from('quests').select('*').eq('character_id', cid).eq('quest_date', today).order('created_at')),
    maybe<BriefingRow>(db.from('daily_briefings').select('*').eq('character_id', cid).eq('briefing_date', today).maybeSingle()),
    maybe<EventRow>(db.from('random_events').select('*').eq('character_id', cid).eq('event_date', today).maybeSingle()),
    must<BossRow[]>(db.from('boss_battles').select('*').eq('character_id', cid).eq('status', 'active')),
  ]);
  quests.sort((a, b) => (a.status === b.status ? 0 : a.status === 'pending' ? -1 : 1) || TYPE_ORDER[a.quest_type] - TYPE_ORDER[b.quest_type]);
  return { today, quests, briefing: briefing && briefing.generated_by !== 'pending' ? briefing : null, event, boss: bosses.find((b) => !b.is_hidden) ?? null, hiddenBoss: bosses.find((b) => b.is_hidden) ?? null };
}

/** Lazy daily rollover: safe to call on every page load. Exactly one request generates a given player-day. */
/** `opts.push` is set only by the scheduled job: a player already in the app doesn't need a push about the board they are looking at. */
export async function ensureDailyState(db: Db, p: Player, dm: HybridDungeonMaster, now = new Date(), opts: { push?: boolean } = {}): Promise<DayState> {
  const cid = p.character.id, today = todayInTz(p.profile.timezone, now);
  await db.from('quests').update({ status: 'expired' }).eq('character_id', cid).lt('quest_date', today).eq('status', 'pending');
  await db.from('boss_battles').update({ status: 'fled', completed_at: now.toISOString() }).eq('character_id', cid).eq('status', 'active').lt('expires_at', now.toISOString());
  let locked = await tryLock(db, cid, today);
  if (!locked) {
    const b = await maybe<BriefingRow & { created_at: string }>(db.from('daily_briefings').select('*').eq('character_id', cid).eq('briefing_date', today).maybeSingle());
    if (b && b.generated_by === 'pending' && now.getTime() - new Date(b.created_at).getTime() > 60_000) { // a previous attempt died mid-flight
      await db.from('daily_briefings').delete().eq('id', b.id).eq('generated_by', 'pending');
      locked = await tryLock(db, cid, today);
    }
  }
  if (!locked) { // another request is generating this day: wait briefly instead of returning an empty board
    for (let i = 0; i < 20; i++) {
      const b = await maybe<{ generated_by: string }>(db.from('daily_briefings').select('generated_by').eq('character_id', cid).eq('briefing_date', today).maybeSingle());
      if (!b || b.generated_by !== 'pending') break;
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  if (locked) {
    try { await generateDay(db, p, dm, today, now, !!opts.push); }
    catch (e) { await db.from('daily_briefings').delete().eq('character_id', cid).eq('briefing_date', today).eq('generated_by', 'pending'); throw e; }
  }
  await ensureBoss(db, p, dm, now);
  return loadDay(db, p, today);
}

/** A goal/habit added mid-day shows up on today's board immediately instead of tomorrow. */
export async function materializeToday(db: Db, p: Player, d: QuestDraft, now = new Date()): Promise<boolean> {
  const today = todayInTz(p.profile.timezone, now);
  const briefing = await maybe<{ generated_by: string }>(db.from('daily_briefings').select('generated_by').eq('character_id', p.character.id).eq('briefing_date', today).maybeSingle());
  if (!briefing || briefing.generated_by === 'pending') return false; // board not generated yet: it will pick the task up
  const pending = await countOf(db.from('quests').select('id', HEAD).eq('character_id', p.character.id).eq('quest_date', today).eq('status', 'pending'));
  if (pending >= 12) return false;
  const res = await db.from('quests').insert(questRow(p, today, d, 'manual', false));
  return !res.error; // unique index makes this idempotent per goal/habit per day
}
