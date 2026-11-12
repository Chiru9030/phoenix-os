'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, ScrollText } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bar, Empty } from '@/components/ui/primitives';
import { api, ApiError } from '@/lib/client/api';
import type { CompletionResult } from '@/lib/server/quests';
import { QuestCard, type QuestLite } from './QuestCard';
import { useGame } from './GameProvider';

export function QuestBoard({ quests, limit, showProgress = true }: { quests: QuestLite[]; limit?: number; showProgress?: boolean }) {
  const router = useRouter(), game = useGame();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<Set<string>>(new Set());
  const isDone = (q: QuestLite) => q.status === 'completed' || done.has(q.id);
  const pending = quests.filter((q) => !isDone(q)), finished = quests.filter(isDone);
  const shown = limit ? pending.slice(0, limit) : pending;

  async function complete(q: QuestLite) {
    if (busy) return;
    setBusy(q.id); game.play('click');
    try {
      const r = await api<CompletionResult>('/api/quests/complete', { body: { questId: q.id } });
      setDone((s) => new Set(s).add(q.id)); game.celebrate(r); router.refresh();
    } catch (e) {
      game.play('error'); game.toast({ tone: 'ember', title: (e as Error).message });
      if (e instanceof ApiError && (e.status === 409 || e.status === 410)) router.refresh();
    } finally { setBusy(null); }
  }
  if (!quests.length) return <Empty icon={<ScrollText className="h-8 w-8" />} title="Your board is empty">Add a goal or habit in Goals &amp; Habits and the Dungeon Master will turn it into a quest.</Empty>;
  return (
    <div className="space-y-4">
      {showProgress && (
        <div className="flex items-center gap-3">
          <Bar value={finished.length} max={quests.length} tone="sage" className="flex-1" label="Quests completed today" />
          <span className="num whitespace-nowrap text-xs text-parchment-muted">{finished.length}/{quests.length} done{quests.length >= 3 && finished.length < quests.length ? ' · clear all for +50 XP' : ''}</span>
        </div>
      )}
      <AnimatePresence initial={false}>
        {shown.map((q) => (
          <motion.div key={q.id} layout exit={{ opacity: 0, scale: 0.96, height: 0 }} transition={{ duration: 0.3 }}>
            <QuestCard quest={q} done={false} busy={busy === q.id} onComplete={() => complete(q)} />
          </motion.div>
        ))}
      </AnimatePresence>
      {limit && pending.length > limit && <Link href="/quests" className="flex items-center justify-center gap-1 text-sm font-semibold text-gold hover:text-gold-bright">{pending.length - limit} more on the Quest Board <ChevronRight className="h-4 w-4" /></Link>}
      {pending.length === 0 && <div className="card px-6 py-8 text-center"><p className="font-display text-xl text-gold-bright">Board cleared.</p><p className="mt-1 text-sm text-parchment-muted">Every quest is done. Rest well. The Dungeon Master has new ones waiting tomorrow.</p></div>}
      {!limit && finished.length > 0 && (<section aria-label="Completed quests" className="space-y-3 pt-2"><p className="label-caps">Completed today</p>{finished.map((q) => <QuestCard key={q.id} quest={q} done busy={false} onComplete={() => {}} />)}</section>)}
    </div>
  );
}
