'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Crown, Gift, LogOut, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge, Bar, Empty, Input, Label, Select, Textarea } from '@/components/ui/primitives';
import { api } from '@/lib/client/api';
import { GameIcon } from './icons';
import { useGame } from './GameProvider';

const ICONS = ['shield', 'flame', 'swords', 'crown', 'compass', 'sparkles'];
export interface GuildData {
  guild: { id: string; name: string; description: string | null; icon: string | null }; role: string;
  members: { characterId: string; name: string; level: number; lifetimeXp: number; role: string; isMe: boolean }[];
  quest: { title: string; description: string | null; current_value: number; target_value: number; xp_reward: number; gold_reward: number; ends_at: string } | null;
  lastCompleted: { id: string; title: string; xp_reward: number; gold_reward: number } | null; canClaim: boolean;
}
export function GuildClient({ guild, browse }: { guild: GuildData | null; browse: { id: string; name: string; description: string | null; icon: string | null; members: number }[] }) {
  const router = useRouter(), game = useGame();
  const [busy, setBusy] = React.useState<string | null>(null), [confirmLeave, setConfirmLeave] = React.useState(false);
  const [f, setF] = React.useState({ name: '', description: '', icon: 'shield' });
  async function run(id: string, fn: () => Promise<void>) { setBusy(id); try { await fn(); router.refresh(); } catch (e) { game.play('error'); game.toast({ tone: 'ember', title: (e as Error).message }); } finally { setBusy(null); setConfirmLeave(false); } }

  if (!guild) return (
    <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
      <section aria-label="Guilds to join" className="space-y-3 order-2 lg:order-1">
        <h2 className="font-display text-xl font-semibold">Join a guild</h2>
        {browse.length === 0 ? <Empty icon={<Users className="h-8 w-8" />} title="No guilds yet">Be the first. Create one and invite your friends.</Empty> : browse.map((g) => (
          <div key={g.id} className="card flex items-center gap-4 p-4"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-gold-dim bg-gold/10"><GameIcon name={g.icon} className="h-5 w-5 text-gold-bright" /></div>
            <div className="min-w-0 flex-1"><p className="font-display font-semibold">{g.name}</p><p className="truncate text-sm text-parchment-muted">{g.description || 'No description yet.'}</p></div><Badge className="num">{g.members} / 30</Badge>
            <Button size="sm" variant="gold" loading={busy === g.id} disabled={g.members >= 30} onClick={() => run(g.id, async () => { await api('/api/guild', { body: { action: 'join', guildId: g.id } }); game.toast({ tone: 'sage', title: `Welcome to ${g.name}` }); })}>Join</Button></div>))}
      </section>
      <form className="card order-1 h-fit space-y-3 p-5 lg:order-2" onSubmit={(e) => { e.preventDefault(); void run('create', async () => { await api('/api/guild', { body: { action: 'create', ...f, description: f.description || undefined } }); game.toast({ tone: 'sage', title: 'Guild founded' }); }); }}>
        <h2 className="font-display text-lg font-semibold">Found a guild</h2>
        <div><Label htmlFor="gn">Name</Label><Input id="gn" required minLength={3} maxLength={32} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. The Midnight Coders" /></div>
        <div><Label htmlFor="gi">Emblem</Label><Select id="gi" value={f.icon} onChange={(e) => setF({ ...f, icon: e.target.value })}>{ICONS.map((i) => <option key={i} value={i}>{i[0].toUpperCase() + i.slice(1)}</option>)}</Select></div>
        <div><Label htmlFor="gd">Description</Label><Textarea id="gd" maxLength={200} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} className="min-h-[64px]" /></div>
        <Button type="submit" variant="gold" className="w-full" loading={busy === 'create'}>Found guild</Button>
        <p className="text-xs text-parchment-dim">Guilds share a weekly quest: everyone&apos;s finished quests add to a shared XP pool.</p>
      </form>
    </div>
  );
  const q = guild.quest, left = q ? Math.max(0, Math.ceil((new Date(q.ends_at).getTime() - Date.now()) / 86_400_000)) : 0;
  return (
    <div className="space-y-5">
      <div className="card flex flex-wrap items-center gap-4 p-5"><div className="flex h-14 w-14 items-center justify-center rounded-xl border-2 border-gold bg-gold/10"><GameIcon name={guild.guild.icon} className="h-7 w-7 text-gold-bright" /></div>
        <div className="min-w-0 flex-1"><h2 className="font-display text-2xl font-semibold">{guild.guild.name}</h2><p className="text-sm text-parchment-muted">{guild.guild.description || 'A band of adventurers.'}</p></div>
        <Badge tone="gold">{guild.role}</Badge>
        <Button variant={confirmLeave ? 'danger' : 'outline'} size="sm" loading={busy === 'leave'} onClick={() => { if (!confirmLeave) { setConfirmLeave(true); setTimeout(() => setConfirmLeave(false), 4000); return; } void run('leave', async () => { await api('/api/guild', { body: { action: 'leave' } }); }); }}><LogOut className="h-4 w-4" />{confirmLeave ? 'Really leave?' : 'Leave'}</Button></div>
      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-5">
          {q && (<section className="card p-5" aria-label="Guild quest"><div className="flex flex-wrap items-center justify-between gap-2"><p className="label-caps text-gold">Guild quest · {left} day{left === 1 ? '' : 's'} left</p><Badge className="num">Reward: {q.xp_reward} XP · {q.gold_reward} Gold each</Badge></div><h3 className="mt-1 font-display text-xl font-semibold">{q.title}</h3><p className="mt-1 text-sm text-parchment-muted">{q.description}</p>
            <div className="mt-4"><div className="mb-1 flex justify-between text-xs"><span className="text-parchment-dim">Guild XP pooled</span><span className="num text-gold-bright">{q.current_value.toLocaleString()} / {q.target_value.toLocaleString()}</span></div><Bar value={q.current_value} max={q.target_value} className="h-3" label="Guild quest progress" /></div></section>)}
          {guild.canClaim && guild.lastCompleted && (<section className="card flex flex-wrap items-center justify-between gap-3 border-gold p-5"><div className="flex items-center gap-3"><Gift className="h-6 w-6 text-gold-bright" aria-hidden /><div><p className="font-display text-lg font-semibold">&quot;{guild.lastCompleted.title}&quot; was completed!</p><p className="text-sm text-parchment-muted">Claim your share: {guild.lastCompleted.xp_reward} XP and {guild.lastCompleted.gold_reward} Gold.</p></div></div><Button variant="gold" loading={busy === 'claim'} onClick={() => run('claim', async () => { const r = await api<{ xp: number; gold: number; progress: { leveledUp: boolean; levelAfter: number; skillPointsGained: number } }>('/api/guild', { body: { action: 'claim', questId: guild.lastCompleted!.id } }); game.reward({ label: 'Guild reward claimed', xp: r.xp, gold: r.gold, level: r.progress.leveledUp ? r.progress.levelAfter : undefined, points: r.progress.skillPointsGained }); })}>Claim reward</Button></section>)}
        </div>
        <section className="card p-5" aria-label="Members"><h3 className="font-display text-lg font-semibold">Members <span className="num text-sm text-parchment-dim">({guild.members.length}/30)</span></h3>
          <ol className="mt-3 space-y-2">{guild.members.map((m, i) => (<li key={m.characterId} className={`flex items-center gap-3 rounded-lg px-3 py-2 ${m.isMe ? 'bg-gold/10' : ''}`}><span className="num w-5 text-xs text-parchment-dim">{i + 1}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{m.name}{m.isMe && <span className="ml-1 text-xs text-gold">(you)</span>}</p><p className="num text-xs text-parchment-dim">Lv {m.level} · {m.lifetimeXp.toLocaleString()} XP</p></div>{m.role === 'leader' && <Crown className="h-4 w-4 text-gold-bright" aria-label="Leader" />}</li>))}</ol></section>
      </div>
    </div>
  );
}
