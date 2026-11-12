import { xpToClearLevel } from '@/lib/game/xp';
import { streakStatus } from '@/lib/game/streaks';
import type { Player } from './player';

export function playerView(p: Player, today: string) {
  const s = streakStatus(today, p.streak.last_active_date, p.streak.current_streak, p.streak.freeze_tokens);
  return {
    name: p.character.name, characterClass: p.character.character_class, level: p.character.level, currentXp: p.character.current_xp, xpToNext: xpToClearLevel(p.character.level),
    gold: p.character.gold, lifetimeXp: p.character.lifetime_xp, skillPoints: p.points.available, stats: p.stats, avatarSeed: p.character.avatar_seed,
    streak: { current: s.display, state: s.state, longest: p.streak.longest_streak, freezeTokens: p.streak.freeze_tokens },
    campaign: p.campaign ? { slug: p.campaign.slug, name: p.campaign.name } : null, soundEnabled: p.profile.sound_enabled,
  };
}
export type PlayerView = ReturnType<typeof playerView>;
