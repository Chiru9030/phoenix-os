'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge, Empty } from '@/components/ui/primitives';
import { api } from '@/lib/client/api';
import { GameIcon } from './icons';
import { useGame } from './GameProvider';

export interface ItemLite { key: string; name: string; description: string; icon: string; rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'; item_type: 'consumable' | 'equipment' | 'badge'; slot: string | null; quantity: number; equipped: boolean }
export interface TitleLite { key: string; name: string; description: string | null; owned: boolean; equipped: boolean }
const RARITY = { common: 'muted', uncommon: 'sage', rare: 'arcane', epic: 'gold', legendary: 'ember' } as const;
const SLOT = { weapon: 'Weapon', shield: 'Shield', tome: 'Tome', badge: 'Badge' } as Record<string, string>;
interface UseResult { item: string; xp: number; gold: number; freezeToken: number; progress: { leveledUp: boolean; levelAfter: number; skillPointsGained: number }; awards: { achievements: { name: string }[] } }

export function InventoryClient({ items, titles }: { items: ItemLite[]; titles: TitleLite[] }) {
  const router = useRouter(), game = useGame();
  const [busy, setBusy] = React.useState<string | null>(null);
  async function act(id: string, fn: () => Promise<void>) { setBusy(id); try { await fn(); router.refresh(); } catch (e) { game.play('error'); game.toast({ tone: 'ember', title: (e as Error).message }); } finally { setBusy(null); } }
  const gear = items.filter((i) => i.item_type !== 'consumable'), consumables = items.filter((i) => i.item_type === 'consumable');
  const Card = ({ i, children }: { i: ItemLite; children: React.ReactNode }) => (
    <div className="card flex items-start gap-3 p-4"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-hairline bg-ink-soft"><GameIcon name={i.icon} className="h-5 w-5 text-gold" /></div>
      <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-display font-semibold">{i.name}</p><Badge tone={RARITY[i.rarity]}>{i.rarity}</Badge>{i.slot && <Badge>{SLOT[i.slot]}</Badge>}{i.equipped && <Badge tone="sage">Equipped</Badge>}</div><p className="mt-1 text-sm text-parchment-muted">{i.description}</p></div>{children}</div>
  );
  return (
    <div className="space-y-8">
      <section aria-label="Gear"><h2 className="font-display text-xl font-semibold">Gear</h2><p className="mb-3 text-sm text-parchment-muted">One item per slot. Equipped gear gives passive bonuses to every quest you finish.</p>
        {gear.length === 0 ? <Empty icon={<GameIcon name="shield" className="h-8 w-8" />} title="No gear yet">Achievements, chapters and bosses drop gear. Your first piece is closer than you think.</Empty> : <div className="grid gap-3 lg:grid-cols-2">{gear.map((i) => (
          <Card key={i.key} i={i}>{i.slot && <Button size="sm" variant={i.equipped ? 'outline' : 'gold'} loading={busy === i.key} onClick={() => act(i.key, async () => { await api('/api/items/equip', { body: { key: i.key, equip: !i.equipped } }); game.play('click'); })}>{i.equipped ? 'Unequip' : 'Equip'}</Button>}</Card>))}</div>}</section>
      <section aria-label="Consumables"><h2 className="font-display text-xl font-semibold">Consumables</h2><p className="mb-3 text-sm text-parchment-muted">Use them any time. Effects are instant.</p>
        {consumables.length === 0 ? <Empty icon={<GameIcon name="flask-conical" className="h-8 w-8" />} title="Nothing to use">Treasure chests, the lucky wheel and rewards drop scrolls, potions and charms.</Empty> : <div className="grid gap-3 lg:grid-cols-2">{consumables.map((i) => (
          <Card key={i.key} i={i}><div className="flex shrink-0 flex-col items-end gap-2"><Badge className="num">×{i.quantity}</Badge><Button size="sm" variant="gold" loading={busy === i.key} onClick={() => act(i.key, async () => { const r = await api<UseResult>('/api/items/use', { body: { key: i.key } }); game.reward({ label: `Used ${r.item}`, xp: r.xp, gold: r.gold, level: r.progress.leveledUp ? r.progress.levelAfter : undefined, points: r.progress.skillPointsGained, achievements: r.awards.achievements.map((a) => a.name) }); if (r.freezeToken) game.toast({ tone: 'sage', title: 'Streak Freeze gained' }); })}>Use</Button></div></Card>))}</div>}</section>
      <section aria-label="Titles"><h2 className="font-display text-xl font-semibold">Titles</h2><p className="mb-3 text-sm text-parchment-muted">Your equipped title appears beside your name.</p>
        <div className="grid gap-3 md:grid-cols-2">{titles.map((t) => (
          <div key={t.key} className={`card flex items-center gap-3 p-4 ${t.owned ? '' : 'opacity-55'}`}>{t.owned ? <GameIcon name="crown" className="h-5 w-5 shrink-0 text-gold" /> : <Lock className="h-5 w-5 shrink-0 text-parchment-dim" aria-hidden />}
            <div className="min-w-0 flex-1"><p className="font-display font-semibold">{t.name}</p><p className="text-xs text-parchment-muted">{t.description}</p></div>
            {t.owned && <Button size="sm" variant={t.equipped ? 'outline' : 'gold'} loading={busy === 't' + t.key} onClick={() => act('t' + t.key, async () => { await api('/api/titles/equip', { body: { key: t.equipped ? null : t.key } }); })}>{t.equipped ? 'Unequip' : 'Equip'}</Button>}</div>))}</div></section>
    </div>
  );
}
