import type { BossContext, BossDraft, BriefingContext, CoachContext, CoachTurn, DMResult, DungeonMaster, GoalInput, QuestContext, QuestDraft, QuestType, StatName, WeeklyReportContent, WeeklyReportContext } from '@/lib/types';
import { STAT_LABELS } from '@/lib/types';
import { daysBetween } from '@/lib/game/dates';
import { TAGS, inferTags, normalizeTags } from '@/lib/game/rewards';
import { CLOSERS, DAILY, GREETINGS, MAIN, MOTIVATORS, OPENERS, SECRET, SIDE, voiceFor, type Template } from './content';
import { pick, seeded, shuffle } from './rng';
import { CRISIS_REPLY, cleanText, looksLikeCrisis } from './sanitize';

const ok = <T>(value: T): DMResult<T> => ({ value, source: 'offline', provider: 'offline' });
const LIMIT = { gentle: 4, normal: 6, hardcore: 8 } as const;
const MIN_SIDE = { gentle: 1, normal: 2, hardcore: 3 } as const;
/** Board size a template-only board grows to (real tasks may push it up to LIMIT). */
const TARGET = { gentle: 4, normal: 5, hardcore: 7 } as const;
const PRIORITY: Record<QuestType, number> = { boss_fight: 0, main: 1, daily_challenge: 2, side: 3 };
const r1 = (n: number) => Math.round(n * 10) / 10;

export const STAT_ADVICE: Record<StatName, string> = {
  strength: 'Add one extra strength session next week, even a short one. Consistency beats intensity.',
  intelligence: 'Block two 90-minute deep-work sessions early in the week, while your energy is highest.',
  wisdom: 'Read or meditate for 15 minutes a day; wisdom compounds quietly.',
  discipline: 'Sleep before 11 PM and wake at a fixed time. Discipline is built on a stable rhythm.',
  charisma: 'Start two conversations you would normally skip. Charisma is a rep, not a trait.',
  health: 'Sleep before 11 PM, drink more water and add two walks for higher energy next week.',
  creativity: 'Schedule one 20-minute creative session whose only goal is to make something.',
  coding_skill: 'Do one small coding problem every day. Short daily reps beat weekend marathons.',
  communication: 'Explain one idea out loud each day, to a friend or an empty room.',
  finance: 'Spend 15 minutes on Sunday reviewing your money, then pick one number to improve.',
};

function templateScore(t: Template, focus: StatName[], low: StatName[], rng: () => number): number {
  let s = rng();
  for (const tag of t.tags) for (const stat of Object.keys(TAGS[tag]?.stats ?? {}) as StatName[]) { if (focus.includes(stat)) s += 2; else if (low.includes(stat)) s += 1; }
  return s;
}
const urgencyText = (iso: string, due: string | null) => {
  if (!due) return '';
  const n = daysBetween(iso, due);
  return n < 0 ? `Overdue by ${-n} day${-n > 1 ? 's' : ''}.` : n === 0 ? 'Due today.' : n === 1 ? 'Due tomorrow.' : `Due in ${n} days.`;
};

export class OfflineDungeonMaster implements DungeonMaster {
  readonly name = 'offline';

  /** Synchronous core, also used by the LLM engine as the guaranteed-coverage baseline. */
  buildQuests(ctx: QuestContext): QuestDraft[] {
    const rng = seeded(ctx.characterName, ctx.isoDate, ctx.campaignSlug);
    const voice = voiceFor(ctx.campaignSlug);
    const limit = LIMIT[ctx.difficulty];
    const recent = new Set(ctx.recentTitles.map((t) => t.toLowerCase()));
    const byDue = (a: GoalInput, b: GoalInput) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999');
    const tagsFor = (title: string, tags: string[]) => { const n = normalizeTags(tags); return n.length ? n : inferTags(title); };
    const real: QuestDraft[] = [];

    const goalDraft = (g: GoalInput, type: QuestType): QuestDraft => {
      const urg = urgencyText(ctx.isoDate, g.dueDate);
      const desc = type === 'boss_fight'
        ? `${pick(rng, voice.epithets)} ${pick(rng, voice.foes)} guards this task. ${pick(rng, voice.warnings)} ${urg}`.trim()
        : `${pick(rng, OPENERS[type])} ${urg} ${pick(rng, CLOSERS).replace('{npc}', voice.npc)}`.replace(/\s+/g, ' ').trim();
      return { type, title: cleanText(g.title, 120), description: desc, tags: tagsFor(g.title, g.tags), goalId: g.id };
    };
    ctx.goals.filter((g) => g.questType === 'boss_fight').sort(byDue).slice(0, 1).forEach((g) => real.push(goalDraft(g, 'boss_fight')));
    ctx.goals.filter((g) => g.questType === 'main').sort(byDue).slice(0, 2).forEach((g) => real.push(goalDraft(g, 'main')));
    ctx.goals.filter((g) => g.questType === 'side').sort(byDue).slice(0, 2).forEach((g) => real.push(goalDraft(g, 'side')));
    for (const h of ctx.habits) {
      const type: QuestType = h.questType;
      real.push({ type, title: cleanText(h.title, 120), description: `${pick(rng, OPENERS[type])} ${pick(rng, CLOSERS).replace('{npc}', voice.npc)}`, tags: tagsFor(h.title, h.tags), habitId: h.id });
    }

    // Real tasks always win. Cap them at the daily limit, boss → main → daily → side.
    let drafts = real.sort((a, b) => PRIORITY[a.type] - PRIORITY[b.type]).slice(0, limit);

    // Fill gaps from the campaign's template library, steering toward focus + weakest stats.
    const sortedStats = (Object.entries(ctx.stats) as [StatName, number][]).sort((a, b) => a[1] - b[1]).map(([s]) => s);
    const low = sortedStats.slice(0, 3);
    const used = new Set(drafts.map((d) => d.title.toLowerCase()));
    const pool = (map: Record<string, Template[]>) => {
      const list = [...(map[ctx.campaignSlug] ?? []), ...(ctx.campaignSlug === 'general' ? [] : map.general)];
      return shuffle(rng, list).sort((a, b) => templateScore(b, ctx.focusStats, low, rng) - templateScore(a, ctx.focusStats, low, rng));
    };
    const take = (type: QuestType, templates: Template[]): boolean => {
      const t = templates.find((x) => !used.has(x.title.toLowerCase()) && !recent.has(x.title.toLowerCase()))
        ?? templates.find((x) => !used.has(x.title.toLowerCase()));
      if (!t) return false;
      used.add(t.title.toLowerCase());
      const closer = rng() < 0.5 ? ` ${pick(rng, CLOSERS).replace('{npc}', voice.npc)}` : '';
      drafts.push({ type, title: t.title, description: t.description + closer, tags: t.tags });
      return true;
    };
    const count = (type: QuestType) => drafts.filter((d) => d.type === type).length;
    if (count('main') + count('boss_fight') === 0 && drafts.length < limit) take('main', pool(MAIN));
    if (count('daily_challenge') === 0 && drafts.length < limit) take('daily_challenge', shuffle(rng, DAILY));
    while ((count('side') < MIN_SIDE[ctx.difficulty] || drafts.length < TARGET[ctx.difficulty]) && drafts.length < limit) if (!take('side', pool(SIDE))) break;
    if (ctx.isWeekend && drafts.length < limit && rng() < 0.5) take('side', shuffle(rng, SIDE.general));
    drafts = drafts.sort((a, b) => PRIORITY[a.type] - PRIORITY[b.type]).slice(0, limit);
    return drafts;
  }

  async generateDailyQuests(ctx: QuestContext) { return ok(this.buildQuests(ctx)); }

  /** Secret Quest event template (deterministic per player-day). */
  secretQuest(ctx: QuestContext): QuestDraft {
    const t = pick(seeded(ctx.characterName, ctx.isoDate, 'secret'), SECRET);
    return { type: 'side', title: t.title, description: t.description, tags: t.tags };
  }

  async generateBriefing(ctx: BriefingContext) {
    const rng = seeded(ctx.characterName, ctx.isoDate, 'briefing');
    const v = voiceFor(ctx.campaignSlug);
    const main = ctx.drafts.find((d) => d.type === 'boss_fight') ?? ctx.drafts.find((d) => d.type === 'main') ?? ctx.drafts[0];
    const parts: string[] = [pick(rng, GREETINGS).replace('{name}', ctx.characterName)];
    parts.push(`${v.npc} meets you at the edge of ${v.place}${ctx.chapterTitle ? `, deep in ${ctx.chapterTitle.replace(/^Chapter [IVX]+ — /, '')}` : ''}.`);
    const s = ctx.currentStreak;
    parts.push(s === 0 ? 'A fresh page. Today begins your streak.' : s < 3 ? `Day ${s} of your streak. Momentum is fragile, so guard it.` : s < 14 ? `Day ${s} of your streak. ${v.npc} has stopped doubting you.` : `Day ${s} of your streak. Legends are written one ordinary day at a time.`);
    if (main) parts.push(`${main.type === 'boss_fight' ? 'Boss fight' : 'Today\'s main quest'}: "${main.title}". ${pick(rng, MOTIVATORS)}`);
    if (ctx.eventDescription) parts.push(ctx.eventDescription);
    else if (ctx.isWeekend) parts.push(`It is ${ctx.dayName}. The crowds are loud, but quests do not know what day it is.`);
    return ok(parts.join(' '));
  }

  async generateBoss(ctx: BossContext): Promise<DMResult<BossDraft>> {
    const rng = seeded(ctx.seed, ctx.campaignSlug);
    const v = voiceFor(ctx.campaignSlug);
    const tone = ctx.difficulty === 'legendary' ? 'A legend whispered about in every guild hall.' : ctx.difficulty === 'very_hard' ? 'A brutal opponent that has broken stronger adventurers.' : ctx.difficulty === 'hard' ? 'A serious fight. Prepare accordingly.' : 'A worthy first test.';
    return ok({
      name: `The ${pick(rng, v.epithets)} ${pick(rng, v.foes)}`,
      description: `${tone} ${v.npc} warns: "${pick(rng, v.warnings)}" It has appeared near ${v.place} and will stay for seven days. Every quest you complete wounds it.`,
    });
  }

  async generateWeeklyReport(ctx: WeeklyReportContext): Promise<DMResult<WeeklyReportContent>> {
    const m = ctx.metrics;
    const rate = Math.round(m.completionRate * 100);
    const lead = rate >= 80 ? 'A legendary week.' : rate >= 50 ? 'A solid week with room to sharpen.' : 'A rough week, and that is useful data, not a verdict.';
    const top = (Object.entries(m.statDeltas) as [StatName, number][]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const statLine = top.length ? top.map(([s, v]) => `${STAT_LABELS[s]} +${r1(v)}`).join(', ') : 'No stat growth recorded yet';
    const totalXp = m.xpByDay.reduce((a, b) => a + b, 0);
    const summary = `${lead} ${ctx.characterName} finished ${m.questsCompleted} of ${m.questsTotal} quests (${rate}%) across ${m.activeDays} active day${m.activeDays === 1 ? '' : 's'} for ${totalXp} XP. ${statLine}.${m.bossesDefeated ? ` Bosses defeated: ${m.bossesDefeated}.` : ''}`;
    let weakness: string, recommendation: string;
    if (m.questsTotal > 0 && rate < 50) { weakness = `Consistency: only ${rate}% of quests were finished.`; recommendation = 'Next week, shrink the board: pick your 3 non-negotiables each morning and treat everything else as bonus.'; }
    else if (m.activeDays < 5) { weakness = `Rhythm: only ${m.activeDays} active day${m.activeDays === 1 ? '' : 's'}.`; recommendation = 'Do one small quest on every day, even your worst one. A streak is built from ordinary days.'; }
    else if (m.weakestStat) { weakness = `${STAT_LABELS[m.weakestStat]}: your lowest-gaining stat this week.`; recommendation = STAT_ADVICE[m.weakestStat]; }
    else { weakness = 'Nothing glaring. Your next edge is variety.'; recommendation = 'Try one quest from a stat you rarely train, just to widen your build.'; }
    return ok({ summary, weakness, recommendation });
  }

  async coach(ctx: CoachContext, _history: CoachTurn[], message: string): Promise<DMResult<string>> {
    if (looksLikeCrisis(message)) return ok(CRISIS_REPLY);
    const m = message.toLowerCase();
    const next = ctx.pendingQuestTitles[0];
    let reply: string;
    if (/(motivat|tired|lazy|can'?t|burn(ed)? ?out|give up|overwhelm|stress|stuck|exhaust)/.test(m)) {
      reply = `That sounds heavy, and it is allowed to be. Shrink the quest instead of skipping it: ${next ? `do just ten minutes of "${next}"` : 'pick the smallest thing on your board'}. Starting is the whole fight${ctx.currentStreak > 1 ? `, and a ${ctx.currentStreak}-day streak says you have done harder things than this` : ''}.`;
    } else if (/(plan|schedule|today|what should|where (do|should) i start|prioriti|next)/.test(m)) {
      reply = ctx.pendingQuestTitles.length ? `Here is a clean order for today: ${ctx.pendingQuestTitles.slice(0, 3).map((t, i) => `${i + 1}) ${t}`).join('  ')}. Start with the first, because it is the one with the biggest payoff.` : 'Your board is clear for today. Use the space to rest, or add a goal and I will turn it into a quest.';
    } else if (/streak/.test(m)) {
      reply = ctx.currentStreak > 0 ? `You are on a ${ctx.currentStreak}-day streak. Finish just one quest today and it grows.` : 'You have no active streak, which means any quest completed today starts a brand-new one.';
    } else if (/boss/.test(m)) {
      reply = ctx.activeBossName ? `${ctx.activeBossName} loses health every time you finish a quest, and Boss Fight quests hit twice as hard. Steady daily damage beats one heroic day.` : 'No boss is active right now. A new one arrives when the old one is defeated or flees.';
    } else if (/(stat|weak|improve|level|grow|better)/.test(m) && ctx.weakestStat) {
      reply = `Your lowest stat is ${STAT_LABELS[ctx.weakestStat]}. ${STAT_ADVICE[ctx.weakestStat]}`;
    } else {
      reply = `You are level ${ctx.level} in ${ctx.campaignName}${ctx.currentStreak ? ` with a ${ctx.currentStreak}-day streak` : ''}. ${ctx.completedToday ? `${ctx.completedToday} quest${ctx.completedToday > 1 ? 's' : ''} done today. ` : ''}${next ? `Next best move: "${next}".` : 'Nothing pending, so you are free to level up something new.'}`;
    }
    return ok(reply);
  }
}
