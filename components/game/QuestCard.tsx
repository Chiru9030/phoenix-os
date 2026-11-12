'use client';
import { Check, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { GameIcon } from './icons';
import { TAGS } from '@/lib/game/rewards';
import { QUEST_TYPE_LABELS, type QuestType } from '@/lib/types';
import { cn } from '@/lib/utils';

export interface QuestLite { id: string; quest_type: QuestType; title: string; description: string; tags: string[]; xp_reward: number; gold_reward: number; status: 'pending' | 'completed' | 'expired'; source: string; double_xp: boolean }
const SEAL: Record<QuestType, { icon: string; ring: string; bar: string; text: string }> = {
  main: { icon: 'crown', ring: 'border-gold bg-gold/15', bar: 'bg-gold', text: 'text-gold-bright' },
  side: { icon: 'scroll', ring: 'border-arcane bg-arcane/15', bar: 'bg-arcane', text: 'text-arcane-bright' },
  daily_challenge: { icon: 'sparkles', ring: 'border-sage bg-sage/15', bar: 'bg-sage', text: 'text-sage-bright' },
  boss_fight: { icon: 'skull', ring: 'border-ember bg-ember/15', bar: 'bg-ember', text: 'text-ember-bright' },
};
/** A quest as a wax-sealed scroll: the seal's colour and glyph tell you the quest type at a glance. */
export function QuestCard({ quest, done, busy, onComplete }: { quest: QuestLite; done: boolean; busy: boolean; onComplete: () => void }) {
  const s = SEAL[quest.quest_type];
  return (
    <article className={cn('card relative overflow-hidden transition-opacity', done && 'opacity-60')} aria-label={`${QUEST_TYPE_LABELS[quest.quest_type]}: ${quest.title}`}>
      <span className={cn('absolute inset-y-0 left-0 w-1.5', s.bar)} aria-hidden />
      <div className="p-4 pl-6 sm:flex sm:items-start sm:gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <div className={cn('relative mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 shadow-[inset_0_-3px_6px_rgba(0,0,0,0.35)]', s.ring, done && 'grayscale')}>
            {done ? <Check className="h-5 w-5 text-sage-bright" aria-hidden /> : <GameIcon name={s.icon} className={cn('h-5 w-5', s.text)} />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn('label-caps', s.text)}>{QUEST_TYPE_LABELS[quest.quest_type]}</span>
              {quest.double_xp && !done && <Badge tone="gold">2× XP today</Badge>}
              {quest.source === 'event' && <Badge tone="arcane">Secret</Badge>}
              {quest.source === 'ai' && <Badge tone="muted" title="Written by the AI Dungeon Master"><Sparkles className="h-3 w-3" aria-hidden />AI</Badge>}
            </div>
            <h3 className={cn('mt-1 font-display text-lg font-semibold leading-snug', done && 'line-through decoration-parchment-dim')}>{quest.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-parchment-muted">{quest.description}</p>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <Badge tone="gold" className="num">+{quest.xp_reward * (quest.double_xp ? 2 : 1)} XP</Badge>
              <Badge tone="gold" className="num">+{quest.gold_reward} Gold</Badge>
              {quest.tags.filter((t) => TAGS[t]).map((t) => <Badge key={t}>{TAGS[t].label}</Badge>)}
            </div>
          </div>
        </div>
        {!done && <Button variant="gold" size="sm" className="mt-3 w-full shrink-0 sm:mt-1 sm:w-auto" onClick={onComplete} loading={busy} aria-label={`Complete quest: ${quest.title}`}>Complete</Button>}
      </div>
    </article>
  );
}
