import { z } from 'zod';
import { api, body } from '@/lib/server/api';
import { STAT_NAMES } from '@/lib/types';
import { safeTimezone } from '@/lib/game/dates';
import { cleanText } from '@/lib/ai/sanitize';
import { HttpError } from '@/lib/server/util';
const Settings = z.object({
  characterName: z.string().trim().min(2).max(24).optional(),
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,20}$/, 'Usernames are 3-20 letters, numbers or underscores').optional(),
  timezone: z.string().max(64).optional(), soundEnabled: z.boolean().optional(),
  difficulty: z.enum(['gentle', 'normal', 'hardcore']).optional(), focusStats: z.array(z.enum(STAT_NAMES)).max(3).optional(),
  notificationPrefs: z.object({ morning_quests: z.boolean(), boss_reminders: z.boolean(), streak_protection: z.boolean(), daily_summary: z.boolean() }).partial().optional(),
});
export const POST = api(async ({ req, db, p }) => {
  const s = await body(req, Settings);
  const profile: Record<string, unknown> = {}, character: Record<string, unknown> = {};
  if (s.username) profile.username = s.username;
  if (s.timezone) profile.timezone = safeTimezone(s.timezone);
  if (s.soundEnabled !== undefined) profile.sound_enabled = s.soundEnabled;
  if (s.notificationPrefs) profile.notification_prefs = { ...p.profile.notification_prefs, ...s.notificationPrefs };
  if (s.characterName) character.name = cleanText(s.characterName, 24);
  if (s.difficulty) character.difficulty = s.difficulty;
  if (s.focusStats) character.focus_stats = s.focusStats;
  if (Object.keys(profile).length) { const r = await db.from('profiles').update(profile).eq('id', p.profile.id); if (r.error) throw new HttpError(r.error.code === '23505' ? 409 : 500, r.error.code === '23505' ? 'That username is taken.' : r.error.message); }
  if (Object.keys(character).length) await db.from('characters').update(character).eq('id', p.character.id);
});
