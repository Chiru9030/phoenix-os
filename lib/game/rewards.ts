import type { CharacterStats, Difficulty, QuestType, StatName } from '@/lib/types';
import { round2 } from '@/lib/utils';

export interface TagConfig { label: string; xp: number; stats: Partial<Record<StatName, number>> }
// XP values for the named activities come straight from the product spec.
export const TAGS: Record<string, TagConfig> = {
  wake_up_early:   { label: 'Wake early',      xp: 20, stats: { discipline: 2 } },
  gym:             { label: 'Gym',             xp: 50, stats: { strength: 2, health: 1 } },
  cardio:          { label: 'Cardio',          xp: 40, stats: { health: 2, discipline: 0.5 } },
  deep_work:       { label: 'Deep work',       xp: 80, stats: { intelligence: 2, discipline: 1 } },
  study:           { label: 'Study',           xp: 60, stats: { intelligence: 1.5, wisdom: 1 } },
  reading:         { label: 'Reading',         xp: 25, stats: { wisdom: 1.5, intelligence: 0.5 } },
  meditation:      { label: 'Meditation',      xp: 15, stats: { wisdom: 1, discipline: 1 } },
  internship:      { label: 'Internship',      xp: 60, stats: { coding_skill: 2, discipline: 1 } },
  coding_practice: { label: 'Coding practice', xp: 40, stats: { coding_skill: 2, intelligence: 1 } },
  networking:      { label: 'Networking',      xp: 35, stats: { charisma: 2, communication: 1.5 } },
  speaking:        { label: 'Speaking',        xp: 35, stats: { communication: 2, charisma: 1 } },
  hydration:       { label: 'Hydration',       xp: 15, stats: { health: 1 } },
  sleep:           { label: 'Sleep',           xp: 20, stats: { health: 1.5, discipline: 1 } },
  finance:         { label: 'Finance',         xp: 30, stats: { finance: 2, wisdom: 0.5 } },
  creative:        { label: 'Creative',        xp: 35, stats: { creativity: 2.5 } },
  writing:         { label: 'Writing',         xp: 30, stats: { creativity: 1.5, communication: 1 } },
  admin:           { label: 'Life admin',      xp: 20, stats: { discipline: 1 } },
};
/** Modifier-only tag (affects skill bonuses, grants no base XP/stats). */
export const MODIFIER_TAGS = ['morning'];
export const ALL_TAGS = [...Object.keys(TAGS), ...MODIFIER_TAGS];

export function normalizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const out = new Set<string>();
  for (const t of tags) {
    const k = String(t).toLowerCase().trim().replace(/[\s-]+/g, '_').replace(/[^a-z_]/g, '');
    if (ALL_TAGS.includes(k)) out.add(k);
  }
  return [...out].slice(0, 4);
}

const RULES: [RegExp, string][] = [
  [/\b(gym|workout|lift|weights?|strength|push[- ]?ups?|squats?)\b/i, 'gym'],
  [/\b(run|running|jog|cardio|cycling|swim|walk(ing)?|steps)\b/i, 'cardio'],
  [/\b(read|reading|book|pages?|chapter|novel)\b/i, 'reading'],
  [/\b(meditat\w*|mindful\w*|breath\w*)\b/i, 'meditation'],
  [/\b(leetcode|code|coding|debug|program\w*|dsa|algorithm\w*|commit|pull request)\b/i, 'coding_practice'],
  [/\b(intern\w*|module|ticket|sprint)\b/i, 'internship'],
  [/\b(deep work|focus session|pomodoro|project work)\b/i, 'deep_work'],
  [/\b(study|revise|revision|homework|assignment|lecture|syllabus|exam|notes|course)\b/i, 'study'],
  [/\b(network\w*|linkedin|coffee chat|reach out|connect with)\b/i, 'networking'],
  [/\b(present\w*|speak\w*|interview|mock|pitch)\b/i, 'speaking'],
  [/\b(water|hydrat\w*|litres?|liters?)\b/i, 'hydration'],
  [/\b(sleep|bed ?time|nap)\b/i, 'sleep'],
  [/\b(budget|invest\w*|save|savings|expense\w*|finance|portfolio)\b/i, 'finance'],
  [/\b(design|draw\w*|paint\w*|music|compose|create|build)\b/i, 'creative'],
  [/\b(write|writing|journal|blog|essay|diary)\b/i, 'writing'],
  [/\b(wake|alarm|5 ?am|6 ?am)\b/i, 'wake_up_early'],
  [/\b(clean|laundry|bills?|paperwork|organi[sz]e|email)\b/i, 'admin'],
];
/** Best-effort tag inference for user-typed tasks. First match wins. */
export function inferTags(text: string): string[] {
  const found: string[] = [];
  for (const [re, tag] of RULES) if (re.test(text) && !found.includes(tag)) found.push(tag);
  if (/\b(morning|(?:[4-9]|10) ?am)\b/i.test(text)) found.push('morning');
  return found.slice(0, 3);
}

const TYPE_BASE_XP: Record<QuestType, number> = { main: 70, side: 30, daily_challenge: 25, boss_fight: 150 };
const TYPE_XP_MULT: Record<QuestType, number> = { main: 1.25, side: 1, daily_challenge: 0.9, boss_fight: 2.5 };
const TYPE_STAT_MULT: Record<QuestType, number> = { main: 1.5, side: 1, daily_challenge: 1, boss_fight: 2.5 };
const DIFF_MULT: Record<Difficulty, number> = { gentle: 0.9, normal: 1, hardcore: 1.15 };
const FALLBACK_STATS: Record<QuestType, Partial<CharacterStats>> = { main: { discipline: 1 }, side: { wisdom: 0.5 }, daily_challenge: { discipline: 0.5 }, boss_fight: { discipline: 2 } };

export interface BaseRewards { xp: number; gold: number; stats: Partial<CharacterStats> }
/** The ONLY place quest rewards are decided. LLM output never touches these numbers. */
export function computeBaseRewards(p: { type: QuestType; tags: string[]; level: number; difficulty: Difficulty }): BaseRewards {
  const known = p.tags.filter((t) => TAGS[t]);
  const tagXp = Math.max(0, ...known.map((t) => TAGS[t].xp));
  let xp = (tagXp > 0 ? tagXp : TYPE_BASE_XP[p.type]) * TYPE_XP_MULT[p.type];
  xp *= 1 + Math.min(0.4, 0.02 * (Math.max(1, p.level) - 1));
  xp = Math.round(xp * DIFF_MULT[p.difficulty]);
  const gold = Math.round(xp * 0.4);
  const stats: Partial<CharacterStats> = {};
  for (const t of known) for (const [s, v] of Object.entries(TAGS[t].stats) as [StatName, number][]) stats[s] = round2((stats[s] ?? 0) + v * TYPE_STAT_MULT[p.type]);
  if (!Object.keys(stats).length) for (const [s, v] of Object.entries(FALLBACK_STATS[p.type]) as [StatName, number][]) stats[s] = v;
  return { xp, gold, stats };
}
