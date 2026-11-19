import Link from 'next/link';
import { Brain, ListChecks } from 'lucide-react';
import { getGameState } from '@/lib/server/session';
import { dayName } from '@/lib/game/dates';
import { PageHeader, Badge } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { QuestBoard } from '@/components/game/QuestBoard';
import { QuickQuestBar } from '@/components/game/QuickQuestBar';
import { BossCard } from '@/components/game/BossCard';
import { EventBanner } from '@/components/game/EventBanner';

export const metadata = { title: 'Quest Board' };

export default async function QuestsPage() {
  const { day } = await getGameState();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Quest Board"
        subtitle={`${dayName(day.today)}, ${day.today}. Finish real tasks to earn XP, Gold, and stat growth.`}
        actions={
          <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs">
            <Link href="/tasks">
              <ListChecks className="h-4 w-4 text-gold" />
              Manage Goals & Habits
            </Link>
          </Button>
        }
      />

      {day.event && <EventBanner event={day.event} />}

      {(day.boss || day.hiddenBoss) && (
        <div className="grid gap-4 md:grid-cols-2">
          {day.hiddenBoss && <BossCard boss={day.hiddenBoss} compact />}
          {day.boss && <BossCard boss={day.boss} compact />}
        </div>
      )}

      {/* Quick Add Quest & AI Generator Bar */}
      <QuickQuestBar />

      {/* Quests Display */}
      <QuestBoard quests={day.quests} />
    </div>
  );
}
