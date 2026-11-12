import { admin } from '@/lib/supabase/admin';
import { must } from '@/lib/server/util';
import { getGameState } from '@/lib/server/session';
import { GameProvider } from '@/components/game/GameProvider';
import { AppShell } from '@/components/layout/AppShell';
import type { Notif } from '@/components/layout/NotificationsBell';
import { OneSignalInit } from '@/components/layout/OneSignalInit';

export const dynamic = 'force-dynamic';
export default async function GameLayout({ children }: { children: React.ReactNode }) {
  const { p, view } = await getGameState();
  const notifications = await must<Notif[]>(admin().from('notifications').select('id,notif_type,title,body,is_read,created_at').eq('user_id', p.profile.id).order('created_at', { ascending: false }).limit(12));
  return (
    <GameProvider soundEnabled={view.soundEnabled}>
      <AppShell view={view} notifications={notifications}>{children}</AppShell>
      <OneSignalInit userId={p.profile.id} />
    </GameProvider>
  );
}
