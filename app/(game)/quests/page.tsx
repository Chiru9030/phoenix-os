import Link from 'next/link';
import { Brain } from 'lucide-react';
import { getGameState } from '@/lib/server/session';
import { dayName } from '@/lib/game/dates';
import { PageHeader } from '@/components/ui/primitives';
import { Badge } from '@/components/ui/primitives';
import { QuestBoard } from '@/components/game/QuestBoard';
import { BossCard } from '@/components/game/BossCard';
import { EventBanner } from '@/components/game/EventBanner';

export const metadata = { title: 'Quest Board' };
export default async function QuestsPage() {
  const { day } = await getGameState();
  return (
    <>
      <PageHeader title="Quest Board" subtitle={`${dayName(day.today)}, ${day.today}. Finish real tasks to earn XP, Gold and stats.`} actions={<Link href="/tasks" className="text-sm font-semibold text-gold hover:text-gold-bright">+ Add a goal or habit</Link>} />
      <div className="space-y-5">
        {day.event && <EventBanner event={day.event} />}
        {day.briefing && (<section className="card flex gap-3 p-4" aria-label="Dungeon Master briefing"><Brain className="mt-0.5 h-5 w-5 shrink-0 text-gold" aria-hidden /><div><p className="label-caps">Briefing {day.briefing.generated_by !== 'offline' && <Badge tone="arcane" className="ml-1 normal-case tracking-normal">AI</Badge>}</p><p className="mt-1 text-sm leading-relaxed text-parchment-muted">{day.briefing.narrative}</p></div></section>)}
        {(day.boss || day.hiddenBoss) && <div className="grid gap-4 md:grid-cols-2">{day.hiddenBoss && <BossCard boss={day.hiddenBoss} compact />}{day.boss && <BossCard boss={day.boss} compact />}</div>}
        <QuestBoard quests={day.quests} />
      </div>
    </>
  );
}
