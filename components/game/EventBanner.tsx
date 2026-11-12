import { Gift, PartyPopper, Sparkles, Skull, Coins, Zap } from 'lucide-react';
import { EVENT_TITLES } from '@/lib/game/events';
import type { RandomEventType } from '@/lib/types';
import { LuckyWheel } from './LuckyWheel';

const ICON: Record<RandomEventType, React.ReactNode> = { double_xp: <Zap />, secret_quest: <Sparkles />, treasure_chest: <Coins />, lucky_spin: <Gift />, hidden_boss: <Skull />, weekend_festival: <PartyPopper /> };
export function EventBanner({ event }: { event: { event_type: RandomEventType; description: string; resolved: boolean } }) {
  return (
    <section className="relative overflow-hidden rounded-xl border border-gold-dim bg-gradient-to-r from-gold/15 via-arcane/10 to-transparent p-4" aria-label="Today's random event">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gold-dim bg-ink-soft text-gold-bright [&>svg]:h-5 [&>svg]:w-5" aria-hidden>{ICON[event.event_type]}</div>
        <div className="min-w-0 flex-1"><p className="label-caps text-gold">Random event · {EVENT_TITLES[event.event_type]}</p><p className="mt-0.5 text-sm text-parchment">{event.description}</p></div>
        {event.event_type === 'lucky_spin' && !event.resolved && <LuckyWheel />}
        {event.event_type === 'lucky_spin' && event.resolved && <span className="text-xs text-parchment-dim">Spin used today</span>}
      </div>
    </section>
  );
}
