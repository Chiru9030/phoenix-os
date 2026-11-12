import { admin } from '@/lib/supabase/admin';
import { getGameState } from '@/lib/server/session';
import { challengeOverview, friendOverview } from '@/lib/server/social';
import { PageHeader } from '@/components/ui/primitives';
import { FriendsClient } from '@/components/game/FriendsClient';
export const metadata = { title: 'Friends & Duels' };
export default async function FriendsPage() {
  const { p, view } = await getGameState();
  const [f, duels] = await Promise.all([friendOverview(admin(), p), challengeOverview(admin(), p)]);
  return (<><PageHeader title="Friends & Duels" subtitle="Accountability works better with an ally. Add friends, then dare them to a head-to-head XP duel." /><FriendsClient friends={f.friends} incoming={f.incoming} outgoing={f.outgoing} duels={duels} gold={view.gold} /></>);
}
