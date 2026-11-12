'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Check, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/primitives';
import { api } from '@/lib/client/api';
import { canUnlockSkill } from '@/lib/game/skills';
import { SKILL_BRANCHES, type SkillBranch } from '@/lib/types';
import { cn } from '@/lib/utils';
import { GameIcon } from './icons';
import { useGame } from './GameProvider';

export interface NodeLite { id: string; branch: SkillBranch; key: string; name: string; description: string; tier: number; cost: number; prerequisite_node_id: string | null }
const BRANCH: Record<SkillBranch, { name: string; icon: string; blurb: string }> = {
  strength: { name: 'Strength', icon: 'dumbbell', blurb: 'Body and boss-breaking' }, knowledge: { name: 'Knowledge', icon: 'book-open', blurb: 'Learning that compounds' },
  communication: { name: 'Communication', icon: 'users', blurb: 'People and presence' }, finance: { name: 'Finance', icon: 'coins', blurb: 'Gold and good deals' },
  creativity: { name: 'Creativity', icon: 'sparkles', blurb: 'Ideas and luck' }, leadership: { name: 'Leadership', icon: 'crown', blurb: 'Main-quest mastery' }, focus: { name: 'Focus', icon: 'eye', blurb: 'Calm and consistency' },
};
export function SkillTree({ nodes, unlocked, points }: { nodes: NodeLite[]; unlocked: string[]; points: { available: number; spent: number } }) {
  const router = useRouter(), game = useGame();
  const [busy, setBusy] = React.useState<string | null>(null);
  const have = React.useMemo(() => new Set(unlocked), [unlocked]);
  async function unlock(n: NodeLite) {
    setBusy(n.key); game.play('click');
    try { const r = await api<{ node: string; awards: { achievements: { name: string }[] } }>('/api/skills/unlock', { body: { key: n.key } }); game.reward({ label: `Skill unlocked: ${r.node}`, achievements: r.awards.achievements.map((a) => a.name) }); router.refresh(); }
    catch (e) { game.play('error'); game.toast({ tone: 'ember', title: (e as Error).message }); } finally { setBusy(null); }
  }
  return (
    <div>
      <div className="card mb-5 flex flex-wrap items-center justify-between gap-3 p-4"><p className="text-sm text-parchment-muted">You earn <span className="text-parchment">1 skill point per level</span> (2 on every 5th). Each branch unlocks in order.</p><div className="flex gap-2"><Badge tone="gold" className="num text-sm">{points.available} available</Badge><Badge className="num text-sm">{points.spent} spent</Badge></div></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {SKILL_BRANCHES.map((b) => {
          const list = nodes.filter((n) => n.branch === b).sort((x, y) => x.tier - y.tier);
          return (
            <section key={b} className="card p-4" aria-label={`${BRANCH[b].name} branch`}>
              <div className="mb-4 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg border border-gold-dim bg-gold/10"><GameIcon name={BRANCH[b].icon} className="h-5 w-5 text-gold-bright" /></div><div><h3 className="font-display font-semibold leading-tight">{BRANCH[b].name}</h3><p className="text-xs text-parchment-dim">{BRANCH[b].blurb}</p></div></div>
              <ol className="relative space-y-3 before:absolute before:bottom-6 before:left-[1.05rem] before:top-6 before:w-px before:bg-hairline">
                {list.map((n) => {
                  const owned = have.has(n.id), check = canUnlockSkill(n, have, points.available), ready = check.ok, prereqMet = !n.prerequisite_node_id || have.has(n.prerequisite_node_id);
                  return (
                    <li key={n.key} className={cn('relative flex gap-3 rounded-lg border p-3', owned ? 'border-gold-dim bg-gold/10' : ready ? 'border-arcane-dim bg-arcane/10' : 'border-hairline bg-ink-soft/50', !owned && !prereqMet && 'opacity-60')}>
                      <span className={cn('z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px]', owned ? 'border-gold bg-gold text-ink' : ready ? 'border-arcane bg-ink text-arcane-bright' : 'border-hairline bg-ink text-parchment-dim')}>{owned ? <Check className="h-3.5 w-3.5" aria-label="Unlocked" /> : prereqMet ? <span className="num font-semibold">{n.tier}</span> : <Lock className="h-3 w-3" aria-label="Locked" />}</span>
                      <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{n.name}</p><p className="text-xs leading-relaxed text-parchment-muted">{n.description}</p>
                        {!owned && prereqMet && <Button size="sm" variant={ready ? 'arcane' : 'outline'} className="mt-2" disabled={!ready} loading={busy === n.key} onClick={() => unlock(n)} title={check.reason}>Unlock · {n.cost} pt{n.cost > 1 ? 's' : ''}</Button>}</div>
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}
      </div>
    </div>
  );
}
