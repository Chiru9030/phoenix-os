import { admin } from '@/lib/supabase/admin';
import { getGameState } from '@/lib/server/session';
import { must } from '@/lib/server/util';
import { PageHeader } from '@/components/ui/primitives';
import { CoachChat } from '@/components/game/CoachChat';
export const metadata = { title: 'AI Coach' };
export default async function CoachPage() {
  const { p } = await getGameState();
  const rows = await must<{ role: 'user' | 'coach'; content: string }[]>(admin().from('coaching_messages').select('role,content').eq('character_id', p.character.id).order('created_at', { ascending: false }).limit(30));
  return (<><PageHeader title="AI Coach" subtitle="Ask for a plan, a push, or a plain-spoken look at your progress." /><CoachChat initial={rows.reverse()} /></>);
}
