import Link from 'next/link';
import {
  BookOpen,
  Brain,
  ChevronRight,
  Coins,
  Flame,
  ShieldCheck,
  Snowflake,
  Sparkles,
  Swords,
  Trophy,
  User,
} from 'lucide-react';
import { admin } from '@/lib/supabase/admin';
import { getGameState } from '@/lib/server/session';
import { loadStory, loadWeekXp } from '@/lib/server/loaders';
import { dayOfWeekFor } from '@/lib/game/dates';
import { Badge, Bar, Card, CardBody, CardHeader, CardTitle } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { CharacterCrest } from '@/components/game/CharacterCrest';
import { QuestBoard } from '@/components/game/QuestBoard';
import { QuickQuestBar } from '@/components/game/QuickQuestBar';
import { AIDungeonMasterCard } from '@/components/game/AIDungeonMasterCard';
import { BossCard } from '@/components/game/BossCard';
import { EventBanner } from '@/components/game/EventBanner';
import { StatRadar } from '@/components/game/StatRadar';
import { WeekXpChart } from '@/components/game/WeekXpChart';

export const metadata = { title: 'Dashboard' };

const STREAK_MSG = {
  safe: 'Locked in for today. See you tomorrow.',
  at_risk: 'Complete one quest today to keep your streak alive.',
  broken: 'Your streak ended. Today is day one of the next.',
  none: 'Complete a quest today to start your first streak.',
} as const;

function greeting(tz: string) {
  const h = Number(
    new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: tz }).format(new Date())
  ) % 24;
  return h < 5 ? 'Burning the midnight oil' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default async function Dashboard() {
  const { p, day, view } = await getGameState();
  const [week, story] = await Promise.all([loadWeekXp(admin(), p, day.today), loadStory(admin(), p)]);

  const completedCount = day.quests.filter((q) => q.status === 'completed').length;
  const pendingCount = day.quests.filter((q) => q.status === 'pending').length;
  const xpPct = Math.round((view.currentXp / view.xpToNext) * 100);

  return (
    <div className="space-y-6">
      {/* ── 1. Hero Command Center ───────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl border border-gold/30 bg-gradient-to-r from-ink-soft via-surface to-ink-soft p-6 shadow-lg backdrop-blur-md">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-5">
            <div className="relative shrink-0">
              <CharacterCrest
                level={view.level}
                progress={xpPct}
                characterClass={view.characterClass}
                size={84}
              />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-display text-2xl font-bold tracking-tight text-parchment">
                  {greeting(p.profile.timezone)}, {view.name}
                </span>
                <Badge tone="gold" className="text-xs">
                  Lv {view.level} {view.characterClass}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-parchment-muted">
                Campaign: <span className="text-gold-bright font-medium">{p.campaign?.name ?? 'The Adventurer\'s Path'}</span>
              </p>

              {/* XP Progress Bar */}
              <div className="mt-3 w-64 max-w-full">
                <div className="mb-1 flex justify-between text-[11px] text-parchment-dim">
                  <span>Level {view.level}</span>
                  <span className="num font-semibold text-gold-bright">
                    {view.currentXp} / {view.xpToNext} XP ({xpPct}%)
                  </span>
                </div>
                <Bar value={view.currentXp} max={view.xpToNext} label="XP to next level" />
              </div>
            </div>
          </div>

          {/* Quick Stat Badges */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-2xl border border-hairline bg-surface/90 px-4 py-2.5 shadow-sm">
              <Flame
                className={`h-5 w-5 ${
                  view.streak.state === 'safe'
                    ? 'text-gold-bright'
                    : view.streak.state === 'at_risk'
                    ? 'animate-pulse text-ember-bright'
                    : 'text-parchment-dim'
                }`}
              />
              <div>
                <p className="num text-base font-bold text-parchment">{view.streak.current} Days</p>
                <p className="text-[10px] text-parchment-dim">Active Streak</p>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-2xl border border-hairline bg-surface/90 px-4 py-2.5 shadow-sm">
              <Coins className="h-5 w-5 text-gold-bright" />
              <div>
                <p className="num text-base font-bold text-gold-bright">{view.gold}</p>
                <p className="text-[10px] text-parchment-dim">Gold Balance</p>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-2xl border border-hairline bg-surface/90 px-4 py-2.5 shadow-sm">
              <Sparkles className="h-5 w-5 text-arcane-bright" />
              <div>
                <p className="num text-base font-bold text-parchment">
                  {completedCount}/{day.quests.length}
                </p>
                <p className="text-[10px] text-parchment-dim">Quests Done</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. Random Event Banner (if active) ────────────────────────── */}
      {day.event && <EventBanner event={day.event} />}

      {/* ── 3. Interactive AI Dungeon Master Card ──────────────────────── */}
      <AIDungeonMasterCard
        narrative={day.briefing?.narrative}
        generatedBy={day.briefing?.generated_by}
      />

      {/* ── 4. Main Two-Column Layout ──────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-[1fr_21rem]">
        {/* Left Column: Today's Quests & Quick Add */}
        <section aria-label="Today's quests" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl font-bold tracking-tight text-parchment">
                Today&apos;s Quest Board
              </h2>
              <p className="text-xs text-parchment-muted">
                {pendingCount > 0
                  ? `${pendingCount} quest${pendingCount > 1 ? 's' : ''} left for today.`
                  : day.quests.length > 0
                  ? 'All quests completed! Great job.'
                  : 'Your board is empty. Add a task or generate with AI.'}
              </p>
            </div>
            <Link
              href="/quests"
              className="flex items-center gap-1 text-xs font-semibold text-gold hover:text-gold-bright transition-colors"
            >
              Full Board <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Quick Quest Creator & AI Generator */}
          <QuickQuestBar />

          {/* Quest Board Cards */}
          <QuestBoard quests={day.quests} limit={6} />
        </section>

        {/* Right Column: Bosses, Streak, Radar */}
        <aside className="space-y-5">
          {/* Active Bosses */}
          {day.hiddenBoss && <BossCard boss={day.hiddenBoss} compact />}
          {day.boss && <BossCard boss={day.boss} compact />}

          {/* Streak Status */}
          <Card className="rounded-2xl border-gold/20">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Flame className="h-4 w-4 text-gold-bright" />
                Streak Guardian
              </CardTitle>
            </CardHeader>
            <CardBody>
              <p className="num font-display text-3xl font-bold text-parchment">
                {view.streak.current}
                <span className="ml-1 text-sm font-normal text-parchment-dim">days</span>
              </p>
              <p className="mt-1 text-xs text-parchment-muted">{STREAK_MSG[view.streak.state]}</p>
              <div className="mt-3 flex gap-2 text-[11px] text-parchment-muted">
                <Badge className="gap-1 text-[11px]">
                  <ShieldCheck className="h-3 w-3" />
                  Best: {view.streak.longest}d
                </Badge>
                <Badge className="gap-1 text-[11px]" title="Streak freeze covers missed days">
                  <Snowflake className="h-3 w-3" />
                  {view.streak.freezeTokens} Freeze{view.streak.freezeTokens === 1 ? '' : 's'}
                </Badge>
              </div>
            </CardBody>
          </Card>

          {/* Character Build / Stat Radar */}
          <Card className="rounded-2xl border-hairline">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4 text-gold" />
                Your Build
              </CardTitle>
              <Link href="/character" className="text-xs font-semibold text-gold hover:text-gold-bright">
                Sheet →
              </Link>
            </CardHeader>
            <CardBody>
              <StatRadar stats={p.stats} height={200} />
            </CardBody>
          </Card>
        </aside>
      </div>

      {/* ── 5. Secondary Row: Weekly Momentum & Story Lore ─────────────── */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Weekly XP Chart */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-4 w-4 text-gold-bright" />
              Weekly Momentum
            </CardTitle>
            <span className="num text-xs font-semibold text-gold-bright">
              {week.xpByDay.reduce((a, b) => a + b, 0)} Total XP
            </span>
          </CardHeader>
          <CardBody>
            <WeekXpChart xpByDay={week.xpByDay} todayIndex={(dayOfWeekFor(day.today) + 6) % 7} />
          </CardBody>
        </Card>

        {/* Story Chapter */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-arcane-bright" />
              Story Campaign
            </CardTitle>
            <Link href="/story" className="text-xs font-semibold text-gold hover:text-gold-bright">
              Read →
            </Link>
          </CardHeader>
          <CardBody>
            {story.current ? (
              <div className="space-y-2">
                <p className="label-caps text-[10px] text-parchment-dim">{p.campaign?.name}</p>
                <h4 className="font-display text-base font-semibold text-parchment">{story.current.title}</h4>
                <p className="line-clamp-2 text-xs leading-relaxed text-parchment-muted">
                  {story.current.narrative}
                </p>
                {story.next?.objective && (
                  <div className="pt-2">
                    <div className="mb-1 flex justify-between text-[11px] text-parchment-dim">
                      <span>Next Chapter: {story.next.objective.label}</span>
                      <span className="num font-semibold text-gold-bright">
                        {story.next.objective.current}/{story.next.objective.target}
                      </span>
                    </div>
                    <Bar
                      value={story.next.objective.current}
                      max={story.next.objective.target}
                      tone="arcane"
                      label="Progress to next chapter"
                    />
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-parchment-muted">Pick a campaign in Story mode to begin.</p>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
