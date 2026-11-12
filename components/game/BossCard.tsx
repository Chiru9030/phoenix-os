import { Skull, Timer } from 'lucide-react';
import { Badge, Bar } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';

export interface BossLite { id: string; name: string; description: string; difficulty: 'normal' | 'hard' | 'very_hard' | 'legendary'; max_hp: number; current_hp: number; xp_reward: number; gold_reward: number; item_reward_key: string | null; is_hidden: boolean; expires_at: string | null }
const DIFF = { normal: 'Normal', hard: 'Hard', very_hard: 'Very hard', legendary: 'Legendary' } as const;
function timeLeft(iso: string | null) {
  if (!iso) return null; const ms = new Date(iso).getTime() - Date.now(); if (ms <= 0) return 'fleeing now';
  const h = Math.floor(ms / 3_600_000); return h >= 48 ? `${Math.floor(h / 24)} days left` : `${h}h left`;
}
export function BossCard({ boss, compact }: { boss: BossLite; compact?: boolean }) {
  const pct = Math.round((boss.current_hp / boss.max_hp) * 100), left = timeLeft(boss.expires_at);
  return (
    <section className={cn('card relative overflow-hidden', boss.difficulty === 'legendary' && 'border-gold-dim')} aria-label={`Boss: ${boss.name}`}>
      <div className="pointer-events-none absolute -right-6 -top-6 opacity-[0.07]"><Skull className="h-36 w-36" aria-hidden /></div>
      <div className="relative p-5">
        <div className="flex flex-wrap items-center gap-2"><span className="label-caps text-ember-bright">{boss.is_hidden ? 'Hidden boss' : 'Weekly boss'}</span><Badge tone={boss.difficulty === 'legendary' ? 'gold' : 'ember'}>{DIFF[boss.difficulty]}</Badge>{left && <Badge className="gap-1"><Timer className="h-3 w-3" aria-hidden />{left}</Badge>}</div>
        <h3 className="mt-2 font-display text-xl font-semibold">{boss.name}</h3>
        {!compact && <p className="mt-1 text-sm leading-relaxed text-parchment-muted">{boss.description}</p>}
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs"><span className="text-parchment-dim">Health</span><span className="num text-ember-bright">{boss.current_hp} / {boss.max_hp}</span></div>
          <Bar value={boss.current_hp} max={boss.max_hp} tone="ember" label={`${boss.name} health ${pct}%`} className="h-3" />
          <p className="mt-2 text-xs text-parchment-dim">Every quest you finish wounds it. Boss Fight quests hit twice as hard.</p>
        </div>
        <p className="num mt-3 text-xs text-parchment-muted">Reward: <span className="text-gold-bright">{boss.xp_reward} XP · {boss.gold_reward} Gold</span>{boss.item_reward_key ? ' · rare drop' : ''}</p>
      </div>
    </section>
  );
}
