// Shared domain types. Mirrors supabase/migrations/0001_schema.sql.

export const STAT_NAMES = ['strength','intelligence','wisdom','discipline','charisma','health','creativity','coding_skill','communication','finance'] as const;
export type StatName = (typeof STAT_NAMES)[number];
export const STAT_LABELS: Record<StatName, string> = {
  strength: 'Strength', intelligence: 'Intelligence', wisdom: 'Wisdom', discipline: 'Discipline', charisma: 'Charisma',
  health: 'Health', creativity: 'Creativity', coding_skill: 'Coding Skill', communication: 'Communication', finance: 'Finance',
};
export type CharacterStats = Record<StatName, number>;
export const EMPTY_STATS: CharacterStats = {
  strength: 0, intelligence: 0, wisdom: 0, discipline: 0, charisma: 0, health: 0, creativity: 0, coding_skill: 0, communication: 0, finance: 0,
};

export const QUEST_TYPES = ['main', 'side', 'daily_challenge', 'boss_fight'] as const;
export type QuestType = (typeof QUEST_TYPES)[number];
export const QUEST_TYPE_LABELS: Record<QuestType, string> = { main: 'Main Quest', side: 'Side Quest', daily_challenge: 'Daily Challenge', boss_fight: 'Boss Fight' };

export const SKILL_BRANCHES = ['strength', 'knowledge', 'communication', 'finance', 'creativity', 'leadership', 'focus'] as const;
export type SkillBranch = (typeof SKILL_BRANCHES)[number];

export const RANDOM_EVENT_TYPES = ['double_xp', 'secret_quest', 'treasure_chest', 'lucky_spin', 'hidden_boss', 'weekend_festival'] as const;
export type RandomEventType = (typeof RANDOM_EVENT_TYPES)[number];

export type Difficulty = 'gentle' | 'normal' | 'hardcore';
export type BossDifficulty = 'normal' | 'hard' | 'very_hard' | 'legendary';

/** Unlock/achievement criteria (stored as jsonb). */
export type Criteria =
  | { type: 'always' }
  | { type: 'quest_completed_count'; value: number; tag?: string }
  | { type: 'streak'; value: number }
  | { type: 'stat_threshold'; stat: StatName; value: number }
  | { type: 'level'; value: number }
  | { type: 'boss_defeated_count'; value: number }
  | { type: 'skill_unlocked_count'; value: number }
  | { type: 'guild_member'; value: number };

export interface CriteriaContext {
  level: number;
  stats: CharacterStats;
  currentStreak: number;
  longestStreak: number;
  totalQuestsCompleted: number;
  questsByTag: Record<string, number>;
  bossesDefeated: number;
  skillsUnlocked: number;
  inGuild: boolean;
}

/** Anything that carries an `effect` jsonb (skill nodes, equipped items). */
export interface EffectSource { effect: Record<string, unknown> }

export interface GoalInput { id: string; title: string; tags: string[]; questType: 'main' | 'side' | 'boss_fight'; dueDate: string | null; notes?: string | null }
export interface HabitInput { id: string; title: string; tags: string[]; questType: 'main' | 'side' | 'daily_challenge' }

/** What a Dungeon Master proposes. Rewards are ALWAYS computed by the engine, never by the model. */
export interface QuestDraft {
  type: QuestType;
  title: string;
  description: string;
  tags: string[];
  goalId?: string;
  habitId?: string;
}

export interface QuestContext {
  characterName: string;
  level: number;
  stats: CharacterStats;
  campaignSlug: string;
  campaignName: string;
  chapterTitle?: string;
  npcName?: string;
  currentStreak: number;
  isoDate: string;
  dayName: string;
  dayOfWeek: number;
  isWeekend: boolean;
  difficulty: Difficulty;
  focusStats: StatName[];
  recentTitles: string[];
  goals: GoalInput[];
  habits: HabitInput[];
  doubleXpActive: boolean;
}

export interface BossDraft { name: string; description: string }
export interface BossContext { characterName: string; level: number; campaignSlug: string; campaignName: string; difficulty: BossDifficulty; seed: string }

export interface WeeklyMetrics {
  weekStart: string; weekEnd: string; xpByDay: number[];
  questsCompleted: number; questsTotal: number; completionRate: number;
  statDeltas: Partial<CharacterStats>; strongestStat: StatName | null; weakestStat: StatName | null;
  activeDays: number; currentStreak: number; bossesDefeated: number; tagCounts: Record<string, number>;
}
export interface WeeklyReportContent { summary: string; weakness: string; recommendation: string }
export interface WeeklyReportContext { characterName: string; level: number; campaignName: string; metrics: WeeklyMetrics }

export interface CoachContext {
  characterName: string; level: number; stats: CharacterStats; currentStreak: number; campaignName: string;
  pendingQuestTitles: string[]; completedToday: number; activeBossName?: string; weakestStat: StatName | null;
}
export interface CoachTurn { role: 'user' | 'coach'; content: string }

export interface BriefingContext extends QuestContext { drafts: { type: QuestType; title: string }[]; eventDescription?: string }

export interface DMResult<T> { value: T; source: 'ai' | 'offline'; provider: string }

export interface DungeonMaster {
  readonly name: string;
  generateDailyQuests(ctx: QuestContext): Promise<DMResult<QuestDraft[]>>;
  generateBriefing(ctx: BriefingContext): Promise<DMResult<string>>;
  generateBoss(ctx: BossContext): Promise<DMResult<BossDraft>>;
  generateWeeklyReport(ctx: WeeklyReportContext): Promise<DMResult<WeeklyReportContent>>;
  coach(ctx: CoachContext, history: CoachTurn[], message: string): Promise<DMResult<string>>;
}
