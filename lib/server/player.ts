import { z } from 'zod';
import { EMPTY_STATS, STAT_NAMES, type CharacterStats } from '@/lib/types';
import { CLASS_NAMES, classStats } from '@/lib/game/classes';
import { safeTimezone } from '@/lib/game/dates';
import { cleanText } from '@/lib/ai/sanitize';
import { HttpError, maybe, must, num, type Db } from './util';
import type { CampaignRow, CharacterRow, ChapterRow, ProfileRow, StoryProgressRow, StreakRow } from './rows';
import { notify } from './notify';

export interface Player {
  profile: ProfileRow; character: CharacterRow; stats: CharacterStats; streak: StreakRow;
  points: { available: number; spent: number }; campaign: CampaignRow | null;
}

export async function ensureProfile(db: Db, user: { id: string; email?: string | null }): Promise<void> {
  const row = await maybe<{ id: string }>(db.from('profiles').select('id').eq('id', user.id).maybeSingle());
  if (row) return;
  const handle = (user.email ?? 'player').split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '') || 'player';
  await db.from('profiles').upsert({ id: user.id, username: `${handle}_${Math.random().toString(36).slice(2, 6)}`, display_name: (user.email ?? 'Adventurer').split('@')[0] }, { onConflict: 'id', ignoreDuplicates: true });
}

export async function loadPlayer(db: Db, userId: string): Promise<Player | null> {
  const character = await maybe<CharacterRow>(db.from('characters').select('*').eq('user_id', userId).maybeSingle());
  if (!character) return null;
  const [profile, statsRow, streak, pts, campaign] = await Promise.all([
    must<ProfileRow>(db.from('profiles').select('*').eq('id', userId).single()),
    must<Record<string, unknown>>(db.from('character_stats').select('*').eq('character_id', character.id).single()),
    must<StreakRow>(db.from('streaks').select('*').eq('character_id', character.id).single()),
    must<{ available_points: number; spent_points: number }>(db.from('character_skill_points').select('*').eq('character_id', character.id).single()),
    character.active_campaign_id ? maybe<CampaignRow>(db.from('campaigns').select('*').eq('id', character.active_campaign_id).maybeSingle()) : Promise.resolve(null),
  ]);
  const stats: CharacterStats = { ...EMPTY_STATS };
  for (const s of STAT_NAMES) stats[s] = num(statsRow[s]);
  return { profile, character: { ...character, gold: num(character.gold), lifetime_xp: num(character.lifetime_xp) }, stats, streak, points: { available: pts.available_points, spent: pts.spent_points }, campaign };
}

export const CAMPAIGN_SLUGS = ['general', 'fitness', 'placement', 'startup', 'upsc', 'exam'] as const;
export const OnboardSchema = z.object({
  name: z.string().trim().min(2, 'Pick a name with at least 2 characters').max(24),
  characterClass: z.enum(CLASS_NAMES as [string, ...string[]]),
  campaignSlug: z.enum(CAMPAIGN_SLUGS),
  focusStats: z.array(z.enum(STAT_NAMES)).max(3).default([]),
  difficulty: z.enum(['gentle', 'normal', 'hardcore']).default('normal'),
  timezone: z.string().max(64).optional(),
});
export type OnboardInput = z.infer<typeof OnboardSchema>;

/** Makes sure a character has a progress row for every chapter of a campaign (chapter 1 starts unlocked). */
export async function seedStoryProgress(db: Db, characterId: string, campaignId: string): Promise<void> {
  const chapters = await must<ChapterRow[]>(db.from('story_chapters').select('*').eq('campaign_id', campaignId).order('chapter_number'));
  const have = await must<StoryProgressRow[]>(db.from('character_story_progress').select('chapter_id').eq('character_id', characterId));
  const haveIds = new Set(have.map((r) => r.chapter_id));
  const rows = chapters.filter((c) => !haveIds.has(c.id)).map((c) => ({
    character_id: characterId, chapter_id: c.id, status: c.chapter_number === 1 ? 'unlocked' : 'locked', unlocked_at: c.chapter_number === 1 ? new Date().toISOString() : null,
  }));
  if (rows.length) await must(db.from('character_story_progress').upsert(rows, { onConflict: 'character_id,chapter_id', ignoreDuplicates: true }).select());
}

export async function createCharacter(db: Db, userId: string, input: OnboardInput): Promise<Player> {
  const existing = await loadPlayer(db, userId);
  if (existing?.character.onboarded) throw new HttpError(409, 'You already have a character.');
  const campaign = await must<CampaignRow>(db.from('campaigns').select('*').eq('slug', input.campaignSlug).single());
  if (input.timezone) await db.from('profiles').update({ timezone: safeTimezone(input.timezone) }).eq('id', userId);
  const ch = await must<CharacterRow>(db.from('characters').insert({
    user_id: userId, name: cleanText(input.name, 24), character_class: input.characterClass, active_campaign_id: campaign.id,
    focus_stats: input.focusStats, difficulty: input.difficulty, onboarded: true,
  }).select('*').single(), 'create character');
  await must(db.from('character_stats').insert({ character_id: ch.id, ...classStats(input.characterClass) }));
  await must(db.from('streaks').insert({ character_id: ch.id }));
  await must(db.from('character_skill_points').insert({ character_id: ch.id }));
  await seedStoryProgress(db, ch.id, campaign.id);
  await notify(db, userId, { type: 'welcome', title: `Welcome, ${ch.name}`, body: 'Your story begins today. Open your quest board and complete your first quest.' });
  return (await loadPlayer(db, userId))!;
}

export async function switchCampaign(db: Db, p: Player, slug: string): Promise<CampaignRow> {
  const campaign = await maybe<CampaignRow>(db.from('campaigns').select('*').eq('slug', slug).maybeSingle());
  if (!campaign) throw new HttpError(404, 'Unknown campaign');
  await must(db.from('characters').update({ active_campaign_id: campaign.id }).eq('id', p.character.id));
  await seedStoryProgress(db, p.character.id, campaign.id);
  return campaign;
}
