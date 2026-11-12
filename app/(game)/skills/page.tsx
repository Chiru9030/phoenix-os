import { admin } from '@/lib/supabase/admin';
import { getGameState } from '@/lib/server/session';
import { loadSkills } from '@/lib/server/loaders';
import { PageHeader } from '@/components/ui/primitives';
import { SkillTree } from '@/components/game/SkillTree';
export const metadata = { title: 'Skill Tree' };
export default async function SkillsPage() {
  const { p } = await getGameState();
  const s = await loadSkills(admin(), p);
  return (<><PageHeader title="Skill Tree" subtitle="Spend skill points to shape your build. Different choices make different characters." /><SkillTree nodes={s.nodes} unlocked={s.unlocked} points={s.points} /></>);
}
