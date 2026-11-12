import { admin } from '@/lib/supabase/admin';
import { getGameState } from '@/lib/server/session';
import { browseGuilds, guildOverview } from '@/lib/server/social';
import { PageHeader } from '@/components/ui/primitives';
import { GuildClient } from '@/components/game/GuildClient';
export const metadata = { title: 'Guild' };
export default async function GuildPage() {
  const { p } = await getGameState();
  const g = await guildOverview(admin(), p);
  const browse = g ? [] : (await browseGuilds(admin())).map((x) => ({ id: x.id, name: x.name, description: x.description, icon: x.icon, members: x.guild_members?.[0]?.count ?? 0 }));
  return (<><PageHeader title="Guild" subtitle="Adventure is better in a party. Pool XP on weekly guild quests and share the rewards." /><GuildClient guild={g ? { guild: g.guild, role: g.role, members: g.members, quest: g.quest, lastCompleted: g.lastCompleted, canClaim: g.canClaim } : null} browse={browse} /></>);
}
