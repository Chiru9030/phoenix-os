'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { animate, motion, useMotionValue } from 'framer-motion';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/client/api';
import { SPIN_WHEEL } from '@/lib/game/events';
import { useGame } from './GameProvider';

const N = SPIN_WHEEL.length, SEG = 360 / N, R = 120;
const polar = (deg: number, r: number) => [R + r * Math.sin((deg * Math.PI) / 180), R - r * Math.cos((deg * Math.PI) / 180)] as const;
interface SpinResult { index: number; prize: { label: string }; itemName?: string; progress: { leveledUp: boolean; levelAfter: number; skillPointsGained: number } | null; awards: { achievements: { name: string }[] } }

export function LuckyWheel({ label = 'Spin the wheel' }: { label?: string }) {
  const router = useRouter(), game = useGame();
  const rot = useMotionValue(0);
  const [state, setState] = React.useState<'idle' | 'spinning' | 'done'>('idle');
  const [prize, setPrize] = React.useState<string | null>(null);
  async function spin() {
    setState('spinning'); game.play('click');
    try {
      const r = await api<SpinResult>('/api/events/spin', { body: {} });
      const target = 360 * 6 + (360 - (r.index + 0.5) * SEG);
      await animate(rot, target, { duration: 3.6, ease: [0.12, 0.8, 0.2, 1] });
      setPrize(r.itemName ?? r.prize.label); setState('done');
      game.reward({ label: `The wheel lands on ${r.itemName ?? r.prize.label}!`, level: r.progress?.leveledUp ? r.progress.levelAfter : undefined, points: r.progress?.skillPointsGained, achievements: r.awards.achievements.map((a) => a.name) });
      router.refresh();
    } catch (e) { game.play('error'); game.toast({ tone: 'ember', title: (e as Error).message }); setState('idle'); router.refresh(); }
  }
  return (
    <Dialog>
      <DialogTrigger asChild><Button variant="gold">{label}</Button></DialogTrigger>
      <DialogContent title="Wheel of Fortune" description="One free spin today. The server decides your prize before the wheel turns.">
        <div className="relative mx-auto w-64">
          <div className="absolute left-1/2 top-[-6px] z-10 -translate-x-1/2 text-gold-bright" aria-hidden><svg width="22" height="26" viewBox="0 0 22 26"><path d="M11 24 1 4h20z" fill="currentColor" stroke="#100f17" strokeWidth="2" /></svg></div>
          <motion.svg viewBox={`0 0 ${R * 2} ${R * 2}`} style={{ rotate: rot }} className="w-full drop-shadow-[0_0_18px_rgba(212,169,78,0.25)]" role="img" aria-label={`Wheel with prizes: ${SPIN_WHEEL.map((s) => s.label).join(', ')}`}>
            {SPIN_WHEEL.map((s, i) => {
              const [x1, y1] = polar(i * SEG, R - 2), [x2, y2] = polar((i + 1) * SEG, R - 2), [tx, ty] = polar((i + 0.5) * SEG, R * 0.66);
              return (<g key={i}><path d={`M${R} ${R} L${x1} ${y1} A${R - 2} ${R - 2} 0 0 1 ${x2} ${y2}Z`} fill={i % 2 ? '#242032' : '#2b2740'} stroke="#332f47" />
                <text x={tx} y={ty} transform={`rotate(${(i + 0.5) * SEG} ${tx} ${ty})`} textAnchor="middle" dominantBaseline="central" fontSize="11" fontWeight="700" fill={s.kind === 'item' ? '#9b8fff' : s.kind === 'xp' ? '#89c2a4' : '#f0c869'} fontFamily="IBM Plex Mono, monospace">{s.label}</text></g>);
            })}
            <circle cx={R} cy={R} r="14" fill="#100f17" stroke="#d4a94e" strokeWidth="3" />
          </motion.svg>
        </div>
        <div className="mt-5 text-center">
          {state === 'done' ? <p className="font-display text-xl text-gold-bright">You won: {prize}</p> : <Button variant="gold" size="lg" onClick={spin} loading={state === 'spinning'}>Spin</Button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
