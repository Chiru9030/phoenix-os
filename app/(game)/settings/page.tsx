import { getGameState } from '@/lib/server/session';
import { dungeonMaster } from '@/lib/server/dm';
import { PageHeader } from '@/components/ui/primitives';
import { SettingsClient } from '@/components/game/SettingsClient';
export const metadata = { title: 'Settings' };
export default async function SettingsPage() {
  const { p } = await getGameState();
  const prefs = { morning_quests: true, boss_reminders: true, streak_protection: true, daily_summary: true, ...p.profile.notification_prefs };
  return (<><PageHeader title="Settings" subtitle="Make the game fit your life." /><SettingsClient initial={{ characterName: p.character.name, username: p.profile.username ?? '', timezone: p.profile.timezone, difficulty: p.character.difficulty, focusStats: p.character.focus_stats, soundEnabled: p.profile.sound_enabled, prefs, dm: dungeonMaster().name }} /></>);
}
