'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Coins, Gift, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Bar, Input, Label } from '@/components/ui/primitives';
import { api } from '@/lib/client/api';
import { discountedCost } from '@/lib/game/economy';
import { useGame } from './GameProvider';

interface Opt { key: string; label: string; cost: number; sel: { kind: 'default'; index: number } | { kind: 'custom'; id: string }; custom: boolean }
export function RewardsClient({ gold, discountPct, defaults, custom, history }: { gold: number; discountPct: number; defaults: { label: string; goldCost: number }[]; custom: { id: string; label: string; gold_cost: number }[]; history: { id: string; reward_label: string; gold_cost: number; redeemed_at: string }[] }) {
  const router = useRouter(), game = useGame();
  const [busy, setBusy] = React.useState<string | null>(null), [confirm, setConfirm] = React.useState<string | null>(null);
  const [label, setLabel] = React.useState(''), [cost, setCost] = React.useState('300');
  const opts: Opt[] = [...defaults.map((d, i) => ({ key: `d${i}`, label: d.label, cost: d.goldCost, sel: { kind: 'default' as const, index: i }, custom: false })), ...custom.map((c) => ({ key: c.id, label: c.label, cost: c.gold_cost, sel: { kind: 'custom' as const, id: c.id }, custom: true }))];
  async function run(id: string, fn: () => Promise<void>) { setBusy(id); try { await fn(); router.refresh(); } catch (e) { game.play('error'); game.toast({ tone: 'ember', title: (e as Error).message }); } finally { setBusy(null); setConfirm(null); } }
  function redeem(o: Opt) {
    if (confirm !== o.key) { setConfirm(o.key); setTimeout(() => setConfirm((c) => (c === o.key ? null : c)), 4000); return; }
    void run(o.key, async () => { const r = await api<{ label: string; price: number }>('/api/rewards/redeem', { body: o.sel }); game.play('coin'); game.toast({ tone: 'gold', title: `Enjoy it: ${r.label}`, body: `You spent ${r.price} Gold. You earned this.` }); });
  }
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_21rem]">
      <section aria-label="Rewards" className="space-y-3">
        {discountPct > 0 && <p className="rounded-lg border border-sage/40 bg-sage/10 px-3 py-2 text-sm text-sage-bright">Your skills give you <span className="num font-semibold">{discountPct}%</span> off every reward.</p>}
        {opts.map((o) => { const price = discountedCost(o.cost, discountPct), can = gold >= price; return (
          <div key={o.key} className="card flex items-center gap-4 p-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-gold-dim bg-gold/10"><Gift className="h-5 w-5 text-gold-bright" aria-hidden /></div>
            <div className="min-w-0 flex-1"><p className="font-semibold">{o.label}</p><div className="mt-1.5 flex items-center gap-3"><Bar value={gold} max={price} className="h-1.5 flex-1" label={`Progress toward ${o.label}`} /><span className="num whitespace-nowrap text-xs text-gold-bright">{price !== o.cost && <s className="mr-1 text-parchment-dim">{o.cost}</s>}{price} Gold</span></div>{!can && <p className="mt-1 text-xs text-parchment-dim">{price - gold} Gold to go</p>}</div>
            <Button variant={confirm === o.key ? 'danger' : 'gold'} size="sm" disabled={!can} loading={busy === o.key} onClick={() => redeem(o)} aria-label={`Redeem ${o.label} for ${price} Gold`}>{confirm === o.key ? 'Confirm?' : 'Redeem'}</Button>
            {o.custom && <Button size="icon" variant="ghost" aria-label={`Remove ${o.label}`} onClick={() => run('x' + o.key, async () => { await api(`/api/rewards?id=${o.key}`, { method: 'DELETE' }); })}><Trash2 className="h-4 w-4" /></Button>}
          </div>); })}
      </section>
      <aside className="space-y-5">
        <div className="card p-5"><p className="label-caps">Your Gold</p><p className="num mt-1 flex items-center gap-2 font-display text-4xl font-semibold text-gold-bright"><Coins className="h-7 w-7" aria-hidden />{gold}</p></div>
        <form className="card space-y-3 p-5" onSubmit={(e) => { e.preventDefault(); void run('add', async () => { await api('/api/rewards', { body: { label, goldCost: Number(cost) } }); setLabel(''); game.toast({ tone: 'sage', title: 'Reward added' }); }); }}>
          <h2 className="font-display text-lg font-semibold">Add your own reward</h2>
          <div><Label htmlFor="rl">Reward</Label><Input id="rl" required maxLength={80} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Pizza night" /></div>
          <div><Label htmlFor="rc">Gold cost</Label><Input id="rc" type="number" min={10} max={100000} step={10} required value={cost} onChange={(e) => setCost(e.target.value)} className="num" /></div>
          <Button type="submit" variant="gold" className="w-full" loading={busy === 'add'}>Add reward</Button>
          <p className="text-xs text-parchment-dim">Rules of thumb: a normal day earns about 100 Gold. Price rewards you would not otherwise allow yourself.</p>
        </form>
        {history.length > 0 && <div className="card p-5"><h2 className="font-display text-lg font-semibold">Recently redeemed</h2><ul className="mt-3 space-y-2">{history.map((h) => <li key={h.id} className="flex justify-between gap-3 text-sm"><span className="text-parchment-muted">{h.reward_label}</span><span className="num shrink-0 text-xs text-parchment-dim">{new Date(h.redeemed_at).toLocaleDateString()}</span></li>)}</ul></div>}
      </aside>
    </div>
  );
}
