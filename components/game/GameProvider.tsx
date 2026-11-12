'use client';
import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Award, Crown, Flame, Info, Skull, Sparkles, Swords, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { playSfx, type Sfx } from '@/lib/audio/sfx';
import { track } from '@/lib/client/analytics';
import { STAT_LABELS, type StatName } from '@/lib/types';
import type { CompletionResult } from '@/lib/server/quests';

type Tone = 'gold' | 'arcane' | 'sage' | 'ember';
interface ToastItem { id: number; title: string; body?: string; tone: Tone }
type Moment = { kind: 'level'; level: number; points: number } | { kind: 'boss'; name: string; xp: number; gold: number; item?: string } | { kind: 'chapter'; title: string; gold: number; item?: string };
interface Ctx { sound: boolean; play: (s: Sfx) => void; toast: (t: Omit<ToastItem, 'id'>) => void; celebrate: (r: CompletionResult) => void; reward: (r: { xp?: number; gold?: number; label: string; level?: number; points?: number; achievements?: string[] }) => void }
const GameCtx = React.createContext<Ctx | null>(null);
export const useGame = () => { const c = React.useContext(GameCtx); if (!c) throw new Error('useGame must be used inside <GameProvider>'); return c; };

const TONE: Record<Tone, string> = { gold: 'border-gold-dim bg-surface-raised text-gold-bright', arcane: 'border-arcane-dim bg-surface-raised text-arcane-bright', sage: 'border-sage/50 bg-surface-raised text-sage-bright', ember: 'border-ember/60 bg-surface-raised text-ember-bright' };
const TONE_ICON: Record<Tone, React.ReactNode> = { gold: <Sparkles className="h-4 w-4" />, arcane: <Trophy className="h-4 w-4" />, sage: <Award className="h-4 w-4" />, ember: <Swords className="h-4 w-4" /> };

async function confetti(colors: string[], strong = false) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const { default: fire } = await import('canvas-confetti');
  const base = { colors, disableForReducedMotion: true, ticks: 220, gravity: 0.9, scalar: 1 };
  fire({ ...base, particleCount: strong ? 140 : 80, spread: 80, origin: { y: 0.55 } });
  if (strong) setTimeout(() => { fire({ ...base, particleCount: 60, angle: 60, spread: 60, origin: { x: 0, y: 0.7 } }); fire({ ...base, particleCount: 60, angle: 120, spread: 60, origin: { x: 1, y: 0.7 } }); }, 220);
}

export function GameProvider({ soundEnabled, children }: { soundEnabled: boolean; children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);
  const [moments, setMoments] = React.useState<Moment[]>([]);
  const idRef = React.useRef(0);
  const play = React.useCallback((s: Sfx) => playSfx(s, soundEnabled), [soundEnabled]);
  const toast = React.useCallback((t: Omit<ToastItem, 'id'>) => {
    const id = ++idRef.current;
    setToasts((x) => [...x.slice(-3), { ...t, id }]);
    setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), 5200);
  }, []);
  const pushMoment = (m: Moment) => setMoments((x) => [...x, m]);

  const celebrate = React.useCallback((r: CompletionResult) => {
    play('complete'); setTimeout(() => play('coin'), 260);
    const stats = (Object.entries(r.stats) as [StatName, number][]).filter(([, v]) => v > 0).map(([s, v]) => `${STAT_LABELS[s]} +${Math.round(v * 10) / 10}`).join('  ·  ');
    toast({ tone: 'gold', title: `+${r.xp} XP   +${r.gold} Gold`, body: [stats, ...r.bonuses].filter(Boolean).join('  ·  ') });
    if (r.dayCleared) toast({ tone: 'sage', title: 'Board cleared!', body: `All-quests bonus: +${r.dayCleared.xp} XP, +${r.dayCleared.gold} Gold` });
    if (r.progress.streak?.freezeUsed) toast({ tone: 'sage', title: 'Streak Freeze used', body: 'A missed day was covered. Your streak lives.' });
    if (r.progress.streak?.freezeEarned) toast({ tone: 'sage', title: 'Streak Freeze earned', body: 'Your consistency earned a protective token.' });
    for (const b of r.bosses) { if (b.defeated) pushMoment({ kind: 'boss', name: b.name, xp: b.rewards?.xp ?? 0, gold: b.rewards?.gold ?? 0, item: b.rewards?.itemName }); else toast({ tone: 'ember', title: `${b.name} takes ${b.damage} damage`, body: `${b.currentHp} / ${b.maxHp} HP left` }); }
    for (const a of r.awards.achievements) { toast({ tone: 'arcane', title: `Achievement: ${a.name}`, body: [a.description, a.titleName && `Title earned: ${a.titleName}`, a.itemName && `Item: ${a.itemName}`].filter(Boolean).join('  ·  ') }); setTimeout(() => play('achievement'), 500); }
    for (const c of r.awards.chapters) pushMoment({ kind: 'chapter', title: c.title, gold: c.rewardGold, item: c.itemName });
    if (r.guild?.completed) toast({ tone: 'sage', title: 'Guild quest complete!', body: 'Claim your reward on the Guild page.' });
    if (r.progress.leveledUp) pushMoment({ kind: 'level', level: r.progress.levelAfter, points: r.progress.skillPointsGained });
    track('quest_completed', { type: r.quest.type, xp: r.xp, leveled_up: r.progress.leveledUp });
  }, [play, toast]);

  const reward = React.useCallback<Ctx['reward']>((r) => {
    play('coin'); toast({ tone: 'gold', title: r.label, body: [r.xp ? `+${r.xp} XP` : '', r.gold ? `+${r.gold} Gold` : ''].filter(Boolean).join('   ') });
    for (const a of r.achievements ?? []) toast({ tone: 'arcane', title: `Achievement: ${a}` });
    if (r.level) pushMoment({ kind: 'level', level: r.level, points: r.points ?? 0 });
  }, [play, toast]);

  const current = moments[0];
  React.useEffect(() => {
    if (!current) return;
    if (current.kind === 'level') { play('levelup'); void confetti(['#d4a94e', '#f0c869', '#7c6fe8', '#fff3cf'], true); track('level_up', { level: current.level }); }
    if (current.kind === 'boss') { play('boss'); void confetti(['#c9503f', '#e36b54', '#f0c869'], true); }
    if (current.kind === 'chapter') { play('achievement'); void confetti(['#7c6fe8', '#9b8fff', '#f0c869']); }
  }, [current, play]);

  const value = React.useMemo<Ctx>(() => ({ sound: soundEnabled, play, toast, celebrate, reward }), [soundEnabled, play, toast, celebrate, reward]);
  return (
    <GameCtx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-3 bottom-20 z-[60] flex flex-col items-center gap-2 md:inset-x-auto md:bottom-5 md:right-5 md:items-end" role="status" aria-live="polite">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div key={t.id} layout initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, x: 40 }} transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              className={`pointer-events-auto flex w-full max-w-sm gap-3 rounded-xl border px-4 py-3 shadow-seal ${TONE[t.tone]}`}>
              <div className="mt-0.5 shrink-0">{TONE_ICON[t.tone]}</div>
              <div className="min-w-0"><p className="num text-sm font-semibold">{t.title}</p>{t.body && <p className="mt-0.5 text-xs text-parchment-muted">{t.body}</p>}</div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {current && (
          <motion.div key={moments.length + current.kind} className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" aria-modal="true" aria-label="Celebration">
            <motion.div initial={{ scale: 0.8, y: 30, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 22 }} className="card w-full max-w-md p-8 text-center">
              {current.kind === 'level' && (<>
                <Crown className="mx-auto h-10 w-10 text-gold-bright" aria-hidden /><p className="label-caps mt-3">Level up</p>
                <p className="num mt-1 font-display text-7xl font-semibold text-gold-bright">{current.level}</p>
                <p className="mt-2 text-sm text-parchment-muted">Your crest grows brighter. {current.points > 0 && <>You earned <span className="font-semibold text-parchment">{current.points} skill point{current.points > 1 ? 's' : ''}</span> to spend in the Skill Tree.</>}</p>
              </>)}
              {current.kind === 'boss' && (<>
                <Skull className="mx-auto h-10 w-10 text-ember-bright" aria-hidden /><p className="label-caps mt-3">Boss defeated</p>
                <p className="mt-1 font-display text-2xl font-semibold">{current.name}</p>
                <p className="num mt-3 text-lg text-gold-bright">+{current.xp} XP &nbsp; +{current.gold} Gold</p>{current.item && <p className="mt-1 text-sm text-parchment-muted">Drop: {current.item}</p>}
              </>)}
              {current.kind === 'chapter' && (<>
                <Flame className="mx-auto h-10 w-10 text-arcane-bright" aria-hidden /><p className="label-caps mt-3">A new chapter opens</p>
                <p className="mt-1 font-display text-2xl font-semibold">{current.title}</p>
                <p className="mt-2 text-sm text-parchment-muted">Read it in Story Mode.{current.gold > 0 && <> Reward: <span className="num text-gold-bright">+{current.gold} Gold</span></>}{current.item && <> · {current.item}</>}</p>
              </>)}
              <Button variant="gold" className="mt-6 w-full" onClick={() => { setMoments((m) => m.slice(1)); playSfx('click', soundEnabled); }} autoFocus><Info className="hidden" />Continue</Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </GameCtx.Provider>
  );
}
