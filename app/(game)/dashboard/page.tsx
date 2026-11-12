import Link from 'next/link';
import { BookOpen, Brain, Flame, ShieldCheck, Snowflake } from 'lucide-react';
import { admin } from '@/lib/supabase/admin';
import { getGameState } from '@/lib/server/session';
import { loadStory, loadWeekXp } from '@/lib/server/loaders';
import { dayOfWeekFor } from '@/lib/game/dates';
import { Badge, Bar, Card, CardBody, CardHeader, CardTitle } from '@/components/ui/primitives';
import { QuestBoard } from '@/components/game/QuestBoard';
import { BossCard } from '@/components/game/BossCard';
import { EventBanner } from '@/components/game/EventBanner';
import { StatRadar } from '@/components/game/StatRadar';
import { WeekXpChart } from '@/components/game/WeekXpChart';

export const metadata = { title: 'Dashboard' };
const STREAK_MSG = { safe: 'Locked in for today. See you tomorrow.', at_risk: 'Finish one quest today to keep your streak alive.', broken: 'Your streak ended. Today is day one of the next.', none: 'Complete a quest to start your first streak.' } as const;
function greeting(tz: string) {
  const h = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: tz }).format(new Date())) % 24;
  return h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}
export default async function Dashboard() {
  const { p, day, view } = await getGameState();
  const [week, story] = await Promise.all([loadWeekXp(admin(), p, day.today), loadStory(admin(), p)]);
  const pending = day.quests.filter((q) => q.status === 'pending').length;
  return (
    <div className="space-y-5">
      <div><h1 className="font-display text-3xl font-semibold tracking-tight">{greeting(p.profile.timezone)}, {view.name}.</h1>
        <p className="mt-1 text-sm text-parchment-muted">{pending > 0 ? `${pending} quest${pending > 1 ? 's' : ''} await${pending > 1 ? '' : 's'} today.` : day.quests.length ? 'Your board is clear. Well played.' : 'Your quest board is being prepared.'}</p></div>
      {day.event && <EventBanner event={day.event} />}
      {day.briefing && (<section className="card flex gap-3 p-5" aria-label="Dungeon Master briefing"><Brain className="mt-0.5 h-5 w-5 shrink-0 text-gold" aria-hidden /><div><p className="label-caps">The Dungeon Master&apos;s briefing{day.briefing.generated_by !== 'offline' && <Badge tone="arcane" className="ml-2 normal-case tracking-normal">AI-written</Badge>}</p><p className="mt-1.5 leading-relaxed text-parchment-muted">{day.briefing.narrative}</p></div></section>)}
      <div className="grid gap-5 lg:grid-cols-[1fr_21rem]">
        <section aria-label="Today's quests" className="space-y-3">
          <div className="flex items-end justify-between"><h2 className="font-display text-xl font-semibold">Today&apos;s quests</h2><Link href="/quests" className="text-sm font-semibold text-gold hover:text-gold-bright">Quest Board →</Link></div>
          <QuestBoard quests={day.quests} limit={4} />
        </section>
        <aside className="space-y-5">
          {day.hiddenBoss && <BossCard boss={day.hiddenBoss} compact />}
          {day.boss && <BossCard boss={day.boss} compact />}
          <Card>
            <CardHeader><CardTitle>Streak</CardTitle><Flame className={`h-5 w-5 ${view.streak.state === 'safe' ? 'text-gold-bright' : view.streak.state === 'at_risk' ? 'animate-pulse text-ember-bright' : 'text-parchment-dim'}`} aria-hidden /></CardHeader>
            <CardBody><p className="num font-display text-4xl font-semibold">{view.streak.current}<span className="ml-1 text-base text-parchment-dim">days</span></p><p className="mt-1 text-sm text-parchment-muted">{STREAK_MSG[view.streak.state]}</p>
              <div className="mt-3 flex gap-2 text-xs text-parchment-muted"><Badge className="gap-1"><ShieldCheck className="h-3 w-3" aria-hidden />Best {view.streak.longest}</Badge><Badge className="gap-1" title="A Streak Freeze covers one missed day"><Snowflake className="h-3 w-3" aria-hidden />{view.streak.freezeTokens} freeze{view.streak.freezeTokens === 1 ? '' : 's'}</Badge></div></CardBody>
          </Card>
          <Card><CardHeader><CardTitle>Your build</CardTitle><Link href="/character" className="text-xs font-semibold text-gold hover:text-gold-bright">Details</Link></CardHeader><CardBody><StatRadar stats={p.stats} height={240} /></CardBody></Card>
        </aside>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <Card><CardHeader><CardTitle>XP this week</CardTitle><span className="num text-sm text-gold-bright">{week.xpByDay.reduce((a, b) => a + b, 0)} XP</span></CardHeader><CardBody><WeekXpChart xpByDay={week.xpByDay} todayIndex={(dayOfWeekFor(day.today) + 6) % 7} /></CardBody></Card>
        <Card>
          <CardHeader><CardTitle>Story</CardTitle><BookOpen className="h-5 w-5 text-gold" aria-hidden /></CardHeader>
          <CardBody>
            {story.current ? (<><p className="label-caps">{p.campaign?.name}</p><p className="mt-1 font-display text-xl font-semibold">{story.current.title}</p><p className="mt-2 line-clamp-3 text-sm text-parchment-muted">{story.current.narrative}</p>
              {story.next?.objective && (<div className="mt-4"><div className="mb-1 flex justify-between text-xs"><span className="text-parchment-muted">Next: {story.next.objective.label}</span><span className="num text-gold-bright">{story.next.objective.current}/{story.next.objective.target}</span></div><Bar value={story.next.objective.current} max={story.next.objective.target} tone="arcane" label="Progress to the next chapter" /></div>)}
              <Link href="/story" className="mt-4 inline-block text-sm font-semibold text-gold hover:text-gold-bright">Continue reading →</Link></>) : <p className="text-sm text-parchment-muted">Pick a campaign to begin your story.</p>}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
