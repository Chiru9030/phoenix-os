'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, Check, Repeat, Target, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge, Empty, Input, Label, Select, Textarea } from '@/components/ui/primitives';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/client/api';
import { cn } from '@/lib/utils';
import { useGame } from './GameProvider';

export interface GoalLite { id: string; title: string; notes: string | null; quest_type: 'main' | 'side' | 'boss_fight'; due_date: string | null; status: 'active' | 'done' | 'dropped' }
export interface HabitLite { id: string; title: string; quest_type: 'main' | 'side' | 'daily_challenge'; days_of_week: number[]; active: boolean }
const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'], DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const GOAL_TYPES = { main: 'Main Quest', side: 'Side Quest', boss_fight: 'Boss Fight' } as const;
const HABIT_TYPES = { side: 'Side Quest', daily_challenge: 'Daily Challenge', main: 'Main Quest' } as const;

export function TaskManager({ goals, habits, today }: { goals: GoalLite[]; habits: HabitLite[]; today: string }) {
  const router = useRouter(), game = useGame();
  const [busy, setBusy] = React.useState(false);
  const [g, setG] = React.useState({ title: '', notes: '', questType: 'main' as GoalLite['quest_type'], dueDate: '' });
  const [h, setH] = React.useState({ title: '', questType: 'side' as HabitLite['quest_type'], days: [0, 1, 2, 3, 4, 5, 6] });
  async function run(fn: () => Promise<unknown>, ok?: string) {
    setBusy(true);
    try { await fn(); if (ok) game.toast({ tone: 'sage', title: ok }); router.refresh(); } catch (e) { game.play('error'); game.toast({ tone: 'ember', title: (e as Error).message }); } finally { setBusy(false); }
  }
  const addGoal = (e: React.FormEvent) => { e.preventDefault(); void run(async () => {
    const r = await api<{ onBoard: boolean }>('/api/goals', { body: { title: g.title, notes: g.notes || undefined, questType: g.questType, dueDate: g.dueDate || null } });
    setG({ title: '', notes: '', questType: 'main', dueDate: '' }); game.toast({ tone: 'sage', title: r.onBoard ? 'Added to today\'s Quest Board' : 'Goal added', body: r.onBoard ? undefined : 'It will appear on your next quest board.' });
  }); };
  const addHabit = (e: React.FormEvent) => { e.preventDefault(); void run(async () => {
    const r = await api<{ onBoard: boolean }>('/api/habits', { body: { title: h.title, questType: h.questType, daysOfWeek: h.days } });
    setH({ title: '', questType: 'side', days: [0, 1, 2, 3, 4, 5, 6] }); game.toast({ tone: 'sage', title: r.onBoard ? 'Habit added. It is on today\'s board' : 'Habit added', body: r.onBoard ? undefined : 'It appears on the days you picked.' });
  }); };
  const active = goals.filter((x) => x.status === 'active'), done = goals.filter((x) => x.status === 'done').slice(0, 8);
  const overdue = (d: string | null) => !!d && d < today;
  return (
    <Tabs defaultValue="goals">
      <TabsList aria-label="Task types"><TabsTrigger value="goals"><Target className="mr-1.5 inline h-4 w-4" aria-hidden />Goals ({active.length})</TabsTrigger><TabsTrigger value="habits"><Repeat className="mr-1.5 inline h-4 w-4" aria-hidden />Habits ({habits.filter((x) => x.active).length})</TabsTrigger></TabsList>
      <TabsContent value="goals" className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-3 order-2 lg:order-1">
          {active.length === 0 ? <Empty icon={<Target className="h-8 w-8" />} title="No active goals">Add an assignment, a deadline or a project step. It becomes a quest until you finish it.</Empty> : active.map((x) => (
            <div key={x.id} className="card flex items-start gap-3 p-4">
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><Badge tone={x.quest_type === 'boss_fight' ? 'ember' : x.quest_type === 'main' ? 'gold' : 'arcane'}>{GOAL_TYPES[x.quest_type]}</Badge>{x.due_date && <Badge tone={overdue(x.due_date) ? 'ember' : 'muted'} className="gap-1"><CalendarDays className="h-3 w-3" aria-hidden />{overdue(x.due_date) ? 'Overdue ' : 'Due '}{x.due_date}</Badge>}</div>
                <p className="mt-1.5 font-semibold">{x.title}</p>{x.notes && <p className="mt-0.5 text-sm text-parchment-muted">{x.notes}</p>}</div>
              <div className="flex shrink-0 gap-1"><Button size="icon" variant="ghost" aria-label={`Mark "${x.title}" done`} title="Mark done" disabled={busy} onClick={() => run(() => api('/api/goals', { method: 'PATCH', body: { id: x.id, status: 'done' } }), 'Goal marked done')}><Check className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" aria-label={`Drop "${x.title}"`} title="Drop goal" disabled={busy} onClick={() => run(() => api('/api/goals', { method: 'PATCH', body: { id: x.id, status: 'dropped' } }), 'Goal dropped')}><X className="h-4 w-4" /></Button></div>
            </div>))}
          {done.length > 0 && (<div className="pt-3"><p className="label-caps mb-2">Recently finished</p><ul className="space-y-1.5">{done.map((x) => <li key={x.id} className="flex items-center gap-2 text-sm text-parchment-muted"><Check className="h-4 w-4 text-sage-bright" aria-hidden /><span className="line-through decoration-parchment-dim">{x.title}</span></li>)}</ul></div>)}
        </div>
        <form onSubmit={addGoal} className="card order-1 h-fit space-y-3 p-5 lg:order-2 lg:sticky lg:top-24">
          <h2 className="font-display text-lg font-semibold">New goal</h2>
          <div><Label htmlFor="gt">What needs doing?</Label><Input id="gt" required maxLength={160} value={g.title} onChange={(e) => setG({ ...g, title: e.target.value })} placeholder="e.g. Complete Database Assignment" /></div>
          <div className="grid grid-cols-2 gap-3"><div><Label htmlFor="gk">Quest type</Label><Select id="gk" value={g.questType} onChange={(e) => setG({ ...g, questType: e.target.value as GoalLite['quest_type'] })}>{Object.entries(GOAL_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></div>
            <div><Label htmlFor="gd">Due (optional)</Label><Input id="gd" type="date" value={g.dueDate} onChange={(e) => setG({ ...g, dueDate: e.target.value })} /></div></div>
          <div><Label htmlFor="gn">Notes (optional)</Label><Textarea id="gn" maxLength={400} value={g.notes} onChange={(e) => setG({ ...g, notes: e.target.value })} className="min-h-[64px]" /></div>
          <Button type="submit" variant="gold" className="w-full" loading={busy}>Add goal</Button>
          <p className="text-xs text-parchment-dim"><span className="text-parchment-muted">Boss Fight</span> is for the big, deadline-driven task. It earns 2.5× XP. The Dungeon Master picks tags (gym, study, coding…) from your wording.</p>
        </form>
      </TabsContent>
      <TabsContent value="habits" className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-3 order-2 lg:order-1">
          {habits.length === 0 ? <Empty icon={<Repeat className="h-8 w-8" />} title="No habits yet">Habits repeat on the days you choose: the gym, 20 pages, 4L of water.</Empty> : habits.map((x) => (
            <div key={x.id} className={cn('card flex items-center gap-3 p-4', !x.active && 'opacity-60')}>
              <div className="min-w-0 flex-1"><p className="font-semibold">{x.title}</p><div className="mt-1.5 flex flex-wrap items-center gap-1.5"><Badge>{HABIT_TYPES[x.quest_type]}</Badge><span className="flex gap-0.5" aria-label={'Repeats on ' + x.days_of_week.map((d) => DAY_NAMES[d]).join(', ')}>{DAYS.map((d, i) => <span key={i} className={cn('num flex h-5 w-5 items-center justify-center rounded text-[10px] font-semibold', x.days_of_week.includes(i) ? 'bg-gold/20 text-gold-bright' : 'text-parchment-dim')}>{d}</span>)}</span></div></div>
              <Switch checked={x.active} aria-label={`${x.active ? 'Pause' : 'Resume'} ${x.title}`} disabled={busy} onCheckedChange={(v) => run(() => api('/api/habits', { method: 'PATCH', body: { id: x.id, active: v } }))} />
              <Button size="icon" variant="ghost" aria-label={`Delete ${x.title}`} disabled={busy} onClick={() => run(() => api(`/api/habits?id=${x.id}`, { method: 'DELETE' }), 'Habit deleted')}><Trash2 className="h-4 w-4" /></Button>
            </div>))}
        </div>
        <form onSubmit={addHabit} className="card order-1 h-fit space-y-3 p-5 lg:order-2 lg:sticky lg:top-24">
          <h2 className="font-display text-lg font-semibold">New habit</h2>
          <div><Label htmlFor="ht">Habit</Label><Input id="ht" required maxLength={120} value={h.title} onChange={(e) => setH({ ...h, title: e.target.value })} placeholder="e.g. Read 20 pages" /></div>
          <div><Label htmlFor="hk">Shows up as</Label><Select id="hk" value={h.questType} onChange={(e) => setH({ ...h, questType: e.target.value as HabitLite['quest_type'] })}>{Object.entries(HABIT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></div>
          <fieldset><legend className="mb-1.5 text-xs font-semibold text-parchment-muted">Repeats on</legend><div className="flex gap-1">{DAYS.map((d, i) => { const on = h.days.includes(i); return <button key={i} type="button" aria-pressed={on} aria-label={DAY_NAMES[i]} onClick={() => setH({ ...h, days: on ? h.days.filter((x) => x !== i) : [...h.days, i] })} className={cn('num h-9 flex-1 rounded-lg border text-xs font-semibold', on ? 'border-gold bg-gold/15 text-gold-bright' : 'border-hairline text-parchment-dim hover:border-gold-dim')}>{d}</button>; })}</div></fieldset>
          <Button type="submit" variant="gold" className="w-full" loading={busy} disabled={h.days.length === 0}>Add habit</Button>
        </form>
      </TabsContent>
    </Tabs>
  );
}
