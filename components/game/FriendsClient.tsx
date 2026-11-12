'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Search, Swords, UserCheck, UserMinus, UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge, Bar, Empty, Input, Label, Select } from '@/components/ui/primitives';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { api } from '@/lib/client/api';
import { useGame } from './GameProvider';

interface Friend { id: string; characterId: string; name: string; level: number }
export interface DuelLite { id: string; status: string; opponentName: string; iAmChallenger: boolean; stake: number; endsAt: string; myXp: number; theirXp: number; winnerIsMe: boolean | null; canAccept: boolean }
export function FriendsClient({ friends, incoming, outgoing, duels, gold }: { friends: Friend[]; incoming: Friend[]; outgoing: Friend[]; duels: DuelLite[]; gold: number }) {
  const router = useRouter(), game = useGame();
  const [q, setQ] = React.useState(''), [results, setResults] = React.useState<{ characterId: string; name: string; level: number; username: string }[]>([]), [searched, setSearched] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null), [duel, setDuel] = React.useState({ days: 7, stake: 0 });
  async function run(id: string, fn: () => Promise<void>, ok?: string) { setBusy(id); try { await fn(); if (ok) game.toast({ tone: 'sage', title: ok }); router.refresh(); } catch (e) { game.play('error'); game.toast({ tone: 'ember', title: (e as Error).message }); } finally { setBusy(null); } }
  React.useEffect(() => {
    if (q.trim().length < 3) { setResults([]); setSearched(false); return; }
    const t = setTimeout(async () => { try { const r = await api<{ results: typeof results }>(`/api/friends?q=${encodeURIComponent(q.trim())}`, { method: 'GET' }); setResults(r.results); setSearched(true); } catch { /* ignore transient search errors */ } }, 350);
    return () => clearTimeout(t);
  }, [q]);
  const stakes = [0, 25, 50, 100, 250].filter((s) => s <= gold);
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="space-y-5">
        <section className="card p-5" aria-label="Find players"><h2 className="font-display text-lg font-semibold">Find a player</h2><p className="text-xs text-parchment-dim">Search by username (3+ letters). Your username is in Settings.</p>
          <div className="relative mt-3"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-parchment-dim" aria-hidden /><label htmlFor="fq" className="sr-only">Search username</label><Input id="fq" value={q} onChange={(e) => setQ(e.target.value)} placeholder="username…" className="pl-9" autoComplete="off" /></div>
          {searched && results.length === 0 && <p className="mt-3 text-sm text-parchment-muted">No players found.</p>}
          <ul className="mt-3 space-y-2">{results.map((r) => (<li key={r.characterId} className="flex items-center gap-3 rounded-lg border border-hairline px-3 py-2"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{r.name}</p><p className="num text-xs text-parchment-dim">@{r.username} · Lv {r.level}</p></div><Button size="sm" variant="gold" loading={busy === r.characterId} onClick={() => run(r.characterId, async () => { await api('/api/friends', { body: { action: 'request', characterId: r.characterId } }); }, 'Friend request sent')}><UserPlus className="h-4 w-4" />Add</Button></li>))}</ul></section>
        {incoming.length > 0 && <section className="card p-5" aria-label="Friend requests"><h2 className="font-display text-lg font-semibold">Requests <Badge tone="gold" className="num ml-1">{incoming.length}</Badge></h2><ul className="mt-3 space-y-2">{incoming.map((f) => (<li key={f.id} className="flex items-center gap-3"><p className="flex-1 text-sm font-semibold">{f.name} <span className="num text-xs font-normal text-parchment-dim">Lv {f.level}</span></p><Button size="sm" variant="gold" loading={busy === f.id} onClick={() => run(f.id, async () => { await api('/api/friends', { body: { action: 'accept', id: f.id } }); }, 'You are now allies')}><UserCheck className="h-4 w-4" />Accept</Button><Button size="icon" variant="ghost" aria-label={`Decline ${f.name}`} onClick={() => run(f.id, async () => { await api('/api/friends', { body: { action: 'decline', id: f.id } }); })}><X className="h-4 w-4" /></Button></li>))}</ul></section>}
        <section className="card p-5" aria-label="Friends"><h2 className="font-display text-lg font-semibold">Friends <span className="num text-sm text-parchment-dim">({friends.length})</span></h2>
          {friends.length === 0 ? <p className="mt-2 text-sm text-parchment-muted">No allies yet. Search above and send a request.</p> : <ul className="mt-3 space-y-2">{friends.map((f) => (
            <li key={f.id} className="flex items-center gap-3 rounded-lg border border-hairline px-3 py-2"><p className="flex-1 text-sm font-semibold">{f.name} <span className="num text-xs font-normal text-parchment-dim">Lv {f.level}</span></p>
              <Dialog><DialogTrigger asChild><Button size="sm" variant="outline"><Swords className="h-4 w-4" />Duel</Button></DialogTrigger>
                <DialogContent title={`Challenge ${f.name}`} description="Whoever earns more XP before the time runs out wins. Stakes are held in escrow when they accept; the winner takes the pot.">
                  <div className="grid grid-cols-2 gap-3"><div><Label htmlFor="dd">Length</Label><Select id="dd" value={duel.days} onChange={(e) => setDuel({ ...duel, days: Number(e.target.value) })}>{[1, 3, 7, 14].map((d) => <option key={d} value={d}>{d} day{d > 1 ? 's' : ''}</option>)}</Select></div><div><Label htmlFor="ds">Stake each</Label><Select id="ds" value={duel.stake} onChange={(e) => setDuel({ ...duel, stake: Number(e.target.value) })}>{stakes.map((s) => <option key={s} value={s}>{s === 0 ? 'No stake' : `${s} Gold`}</option>)}</Select></div></div>
                  <Button variant="gold" className="mt-5 w-full" loading={busy === 'd' + f.id} onClick={() => run('d' + f.id, async () => { await api('/api/challenges', { body: { action: 'create', friendCharacterId: f.characterId, ...duel } }); }, 'Challenge sent')}>Send challenge</Button></DialogContent></Dialog>
              <Button size="icon" variant="ghost" aria-label={`Remove ${f.name}`} onClick={() => run(f.id, async () => { await api('/api/friends', { body: { action: 'remove', id: f.id } }); })}><UserMinus className="h-4 w-4" /></Button></li>))}</ul>}
          {outgoing.length > 0 && <p className="mt-3 text-xs text-parchment-dim">Waiting on: {outgoing.map((o) => o.name).join(', ')}</p>}</section>
      </div>
      <section aria-label="Duels" className="space-y-3"><h2 className="font-display text-xl font-semibold">Duels</h2>
        {duels.length === 0 ? <Empty icon={<Swords className="h-8 w-8" />} title="No duels yet">Challenge a friend to see who earns more XP. Bragging rights, and Gold if you stake it.</Empty> : duels.map((d) => { const total = Math.max(1, d.myXp + d.theirXp); return (
          <div key={d.id} className="card p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-display font-semibold">You vs {d.opponentName}</p><div className="flex gap-1.5">{d.stake > 0 && <Badge tone="gold" className="num">{d.stake} Gold</Badge>}<Badge tone={d.status === 'active' ? 'sage' : d.status === 'finished' ? (d.winnerIsMe ? 'gold' : d.winnerIsMe === false ? 'ember' : 'muted') : 'arcane'}>{d.status === 'finished' ? (d.winnerIsMe ? 'You won' : d.winnerIsMe === false ? 'You lost' : 'Draw') : d.status}</Badge></div></div>
            {d.status !== 'pending' ? (<div className="mt-3"><div className="mb-1 flex justify-between text-xs"><span className="num text-gold-bright">You {d.myXp} XP</span><span className="num text-parchment-muted">{d.opponentName} {d.theirXp} XP</span></div><Bar value={d.myXp} max={total} className="h-3" label="Your share of the XP" />{d.status === 'active' && <p className="mt-2 text-xs text-parchment-dim">Ends {new Date(d.endsAt).toLocaleString()}</p>}</div>) : <p className="mt-2 text-sm text-parchment-muted">{d.canAccept ? 'They dared you. Do you accept?' : 'Waiting for them to accept.'}</p>}
            {d.canAccept && <div className="mt-3 flex gap-2"><Button size="sm" variant="gold" loading={busy === d.id} onClick={() => run(d.id, async () => { await api('/api/challenges', { body: { action: 'accept', id: d.id } }); }, 'Duel accepted. Go earn XP')}>Accept</Button><Button size="sm" variant="ghost" onClick={() => run(d.id, async () => { await api('/api/challenges', { body: { action: 'decline', id: d.id } }); })}>Decline</Button></div>}</div>); })}
      </section>
    </div>
  );
}
