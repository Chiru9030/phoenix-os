'use client';
import * as React from 'react';
import { BookOpen, Check, Lock } from 'lucide-react';
import { Badge, Bar } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';

export interface ChapterLite { id: string; chapter_number: number; title: string; narrative: string; status: 'locked' | 'unlocked' | 'completed'; reward_gold: number; reward_item_key: string | null; objective: { label: string; current: number; target: number } | null }
export function StoryBook({ chapters, npcs, campaignName, initialId }: { chapters: ChapterLite[]; npcs: { name: string; role: string | null; description: string | null }[]; campaignName: string; initialId: string | null }) {
  const [id, setId] = React.useState(initialId ?? chapters[0]?.id);
  const ch = chapters.find((c) => c.id === id) ?? chapters[0];
  if (!ch) return null;
  const [roman, ...rest] = ch.title.split(' — ');
  return (
    <div className="grid gap-5 md:grid-cols-[17rem_1fr]">
      <nav aria-label="Chapters" className="space-y-1.5">
        <p className="label-caps px-1">{campaignName}</p>
        {chapters.map((c) => (
          <button key={c.id} onClick={() => setId(c.id)} aria-current={c.id === ch.id ? 'true' : undefined} className={cn('flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors', c.id === ch.id ? 'border-gold-dim bg-surface-raised' : 'border-transparent hover:bg-surface', c.status === 'locked' && 'opacity-60')}>
            <span className="mt-0.5 shrink-0">{c.status === 'completed' ? <Check className="h-4 w-4 text-sage-bright" aria-label="Completed" /> : c.status === 'unlocked' ? <BookOpen className="h-4 w-4 text-gold-bright" aria-label="Current" /> : <Lock className="h-4 w-4 text-parchment-dim" aria-label="Locked" />}</span>
            <span className="text-sm font-semibold leading-snug">{c.title}</span>
          </button>
        ))}
      </nav>
      <article className="card relative overflow-hidden p-6 md:p-10">
        <div className="pointer-events-none absolute inset-3 rounded-lg border border-gold-dim/25" aria-hidden />
        <div className="relative mx-auto max-w-prose">
          <p className="label-caps text-gold">{roman}</p>
          <h2 className="mt-1 font-display text-3xl font-semibold leading-tight">{rest.join(' — ')}</h2>
          <div className="my-5 flex items-center gap-3 text-gold-dim" aria-hidden><span className="h-px flex-1 bg-hairline" /><span>◆</span><span className="h-px flex-1 bg-hairline" /></div>
          {ch.status === 'locked' ? (
            <div className="rounded-xl border border-dashed border-hairline p-6 text-center"><Lock className="mx-auto h-6 w-6 text-parchment-dim" aria-hidden /><p className="mt-2 font-display text-lg">This chapter is sealed.</p>
              {ch.objective && (<div className="mx-auto mt-4 max-w-xs text-left"><div className="mb-1 flex justify-between text-xs"><span className="text-parchment-muted">{ch.objective.label}</span><span className="num text-gold-bright">{ch.objective.current}/{ch.objective.target}</span></div><Bar value={ch.objective.current} max={ch.objective.target} tone="arcane" label="Progress to unlock this chapter" /></div>)}
              <p className="mt-4 text-xs text-parchment-dim">Chapters open in order, so finish the one before it first.</p></div>
          ) : (<><p className="drop-cap font-display text-lg leading-[1.75] text-parchment/95">{ch.narrative}</p>
            <div className="mt-6 flex flex-wrap gap-2">{ch.status === 'completed' ? <Badge tone="sage">Chapter completed</Badge> : <Badge tone="gold">You are here</Badge>}{ch.reward_gold > 0 && <Badge className="num">Reward: {ch.reward_gold} Gold{ch.reward_item_key ? ' + item' : ''}</Badge>}</div></>)}
          {npcs.length > 0 && ch.status !== 'locked' && (<div className="mt-8"><p className="label-caps">Cast of this campaign</p><ul className="mt-2 grid gap-2 sm:grid-cols-2">{npcs.map((n, i) => <li key={`${n.name}-${i}`} className="rounded-lg border border-hairline bg-ink-soft/50 px-3 py-2"><p className="text-sm font-semibold">{n.name}<span className="ml-2 text-xs font-normal text-parchment-dim">{n.role}</span></p><p className="text-xs text-parchment-muted">{n.description}</p></li>)}</ul></div>)}
        </div>
      </article>
    </div>
  );
}
