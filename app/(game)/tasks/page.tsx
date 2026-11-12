import { admin } from '@/lib/supabase/admin';
import { getGameState } from '@/lib/server/session';
import { loadTasks } from '@/lib/server/loaders';
import { PageHeader } from '@/components/ui/primitives';
import { TaskManager } from '@/components/game/TaskManager';

export const metadata = { title: 'Goals & Habits' };
export default async function TasksPage() {
  const { p, day } = await getGameState();
  const { goals, habits } = await loadTasks(admin(), p);
  return (<><PageHeader title="Goals & Habits" subtitle="Tell the Dungeon Master what is really on your plate. Goals are one-off tasks and deadlines; habits repeat. Each morning they become your quests." /><TaskManager goals={goals} habits={habits} today={day.today} /></>);
}
