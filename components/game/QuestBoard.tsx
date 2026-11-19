'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, ScrollText, Sparkles, CheckCircle2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bar } from '@/components/ui/primitives';
import { api, ApiError } from '@/lib/client/api';
import type { CompletionResult } from '@/lib/server/quests';
import { QuestCard, type QuestLite } from './QuestCard';
import { useGame } from './GameProvider';

export function QuestBoard({
  quests,
  limit,
  showProgress = true,
}: {
  quests: QuestLite[];
  limit?: number;
  showProgress?: boolean;
}) {
  const router = useRouter();
  const game = useGame();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<Set<string>>(new Set());

  const isDone = (q: QuestLite) => q.status === 'completed' || done.has(q.id);
  const pending = quests.filter((q) => !isDone(q));
  const finished = quests.filter(isDone);
  const shown = limit ? pending.slice(0, limit) : pending;

  async function complete(q: QuestLite) {
    if (busy) return;
    setBusy(q.id);
    game.play('click');
    try {
      const r = await api<CompletionResult>('/api/quests/complete', {
        body: { questId: q.id },
      });
      setDone((s) => new Set(s).add(q.id));
      game.celebrate(r);
      router.refresh();
    } catch (e) {
      game.play('error');
      game.toast({ tone: 'ember', title: (e as Error).message });
      if (e instanceof ApiError && (e.status === 409 || e.status === 410)) {
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  if (!quests.length) {
    return (
      <div className="rounded-2xl border border-dashed border-hairline/80 bg-surface/40 p-8 text-center backdrop-blur-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-gold/30 bg-gold/10 text-gold-bright">
          <ScrollText className="h-6 w-6" />
        </div>
        <h3 className="mt-3 font-display text-lg font-semibold text-parchment">
          Your Quest Board is Ready
        </h3>
        <p className="mx-auto mt-1 max-w-md text-sm text-parchment-muted">
          Add your real-life tasks above with <span className="text-gold-bright">+ Add</span> or click{' '}
          <span className="text-arcane-bright">✨ AI Generate</span> to let the Dungeon Master craft 3 tailored quests.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showProgress && quests.length > 0 && (
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-4 rounded-xl border border-hairline/50 bg-surface/50 px-4 py-2.5">
          <div className="flex items-center gap-2 text-xs font-medium text-parchment-muted">
            <CheckCircle2 className="h-4 w-4 text-sage-bright" />
            <span>Progress:</span>
          </div>
          <Bar
            value={finished.length}
            max={quests.length}
            tone="sage"
            className="flex-1"
            label="Quests completed today"
          />
          <span className="num whitespace-nowrap text-xs font-semibold text-parchment">
            {finished.length} of {quests.length} completed
            {quests.length >= 3 && finished.length < quests.length && (
              <span className="text-gold-bright ml-1">· +50 XP bonus on clear</span>
            )}
          </span>
        </div>
      )}

      <AnimatePresence initial={false}>
        {shown.map((q) => (
          <motion.div
            key={q.id}
            layout
            exit={{ opacity: 0, scale: 0.96, height: 0 }}
            transition={{ duration: 0.25 }}
          >
            <QuestCard
              quest={q}
              done={false}
              busy={busy === q.id}
              onComplete={() => complete(q)}
            />
          </motion.div>
        ))}
      </AnimatePresence>

      {limit && pending.length > limit && (
        <Link
          href="/quests"
          className="flex items-center justify-center gap-1.5 rounded-xl border border-hairline bg-surface/60 py-2.5 text-xs font-semibold text-gold-bright hover:border-gold hover:bg-gold/5 transition-all"
        >
          View {pending.length - limit} more quests on the Quest Board
          <ChevronRight className="h-4 w-4" />
        </Link>
      )}

      {pending.length === 0 && (
        <div className="rounded-2xl border border-gold/40 bg-gradient-to-r from-gold/10 via-surface to-gold/10 px-6 py-8 text-center shadow-sm">
          <Sparkles className="mx-auto h-8 w-8 text-gold-bright animate-bounce" />
          <p className="mt-2 font-display text-xl font-bold text-gold-bright">
            Quest Board Cleared!
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-parchment-muted">
            Outstanding discipline, adventurer. Every quest for today is complete. You earned your rest.
            Add another task above if you want to keep pushing.
          </p>
        </div>
      )}

      {!limit && finished.length > 0 && (
        <section aria-label="Completed quests" className="space-y-3 pt-3">
          <p className="label-caps text-xs text-parchment-dim">Completed Today ({finished.length})</p>
          {finished.map((q) => (
            <QuestCard key={q.id} quest={q} done busy={false} onComplete={() => {}} />
          ))}
        </section>
      )}
    </div>
  );
}
