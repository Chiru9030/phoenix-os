import type { BossDifficulty, CharacterStats, Criteria, Difficulty, QuestType, RandomEventType, SkillBranch, StatName } from '@/lib/types';

export interface ProfileRow { id: string; username: string | null; display_name: string | null; avatar_url: string | null; timezone: string; notification_prefs: Record<string, boolean>; sound_enabled: boolean }
export interface CampaignRow { id: string; slug: string; name: string; description: string | null; icon: string | null; theme_color: string | null }
export interface CharacterRow {
  id: string; user_id: string; name: string; character_class: string; level: number; current_xp: number; lifetime_xp: number; gold: number; avatar_seed: string;
  active_campaign_id: string | null; focus_stats: StatName[]; difficulty: Difficulty; onboarded: boolean; created_at: string;
}
export interface StreakRow { character_id: string; current_streak: number; longest_streak: number; last_active_date: string | null; freeze_tokens: number }
export interface QuestRow {
  id: string; character_id: string; quest_date: string; quest_type: QuestType; title: string; description: string; tags: string[]; xp_reward: number; gold_reward: number;
  stat_rewards: Partial<CharacterStats>; status: 'pending' | 'completed' | 'expired'; source: 'ai' | 'offline' | 'manual' | 'event'; double_xp: boolean;
  goal_id: string | null; habit_id: string | null; created_at: string; completed_at: string | null;
}
export interface GoalRow { id: string; character_id: string; title: string; notes: string | null; tags: string[]; quest_type: 'main' | 'side' | 'boss_fight'; due_date: string | null; status: 'active' | 'done' | 'dropped'; created_at: string; completed_at: string | null }
export interface HabitRow { id: string; character_id: string; title: string; tags: string[]; quest_type: 'main' | 'side' | 'daily_challenge'; days_of_week: number[]; active: boolean; created_at: string }
export interface BossRow {
  id: string; character_id: string; name: string; description: string; difficulty: BossDifficulty; max_hp: number; current_hp: number; xp_reward: number; gold_reward: number;
  item_reward_key: string | null; is_hidden: boolean; status: 'active' | 'defeated' | 'fled'; started_at: string; expires_at: string | null; completed_at: string | null;
}
export interface EventRow { id: string; character_id: string; event_date: string; event_type: RandomEventType; description: string; effect: Record<string, unknown>; resolved: boolean }
export interface BriefingRow { id: string; character_id: string; briefing_date: string; narrative: string; generated_by: string }
export interface AchievementRow { id: string; key: string; name: string; description: string; icon: string; category: string; criteria: Criteria; reward_xp: number; reward_gold: number; reward_item_key: string | null; reward_title_key: string | null }
export interface ItemRow { id: string; key: string; name: string; description: string; icon: string; rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'; item_type: 'consumable' | 'equipment' | 'badge'; slot: 'weapon' | 'shield' | 'tome' | 'badge' | null; effect: Record<string, unknown> }
export interface InventoryRow { character_id: string; item_id: string; quantity: number; equipped: boolean; acquired_at: string }
export interface TitleRow { id: string; key: string; name: string; description: string | null }
export interface SkillNodeRow { id: string; branch: SkillBranch; key: string; name: string; description: string; tier: number; cost: number; prerequisite_node_id: string | null; effect: Record<string, unknown> }
export interface ChapterRow { id: string; campaign_id: string; chapter_number: number; title: string; narrative: string; unlock_criteria: Criteria; reward_gold: number; reward_item_key: string | null }
export interface StoryProgressRow { character_id: string; chapter_id: string; status: 'locked' | 'unlocked' | 'completed'; unlocked_at: string | null; completed_at: string | null }
export interface WeeklyReportRow { id: string; week_start: string; week_end: string; stat_deltas: Partial<CharacterStats>; metrics: Record<string, unknown>; summary: string; weakness: string | null; recommendation: string | null; generated_by: string; created_at: string }
export interface NotificationRow { id: string; user_id: string; notif_type: string; title: string; body: string | null; is_read: boolean; created_at: string }
