import { Brain, Lightbulb, TriangleAlert } from 'lucide-react';
import { admin } from '@/lib/supabase/admin';
import { getGameState } from '@/lib/server/session';
import { dungeonMaster } from '@/lib/server/dm';
import { ensureLastWeekReport, listReports } from '@/lib/server/reports';
import { Badge, Bar, Card, CardBody, CardHeader, CardTitle, Empty, PageHeader } from '@/components/ui/primitives';
import { WeekXpChart } from '@/components/game/WeekXpChart';
import { GenerateReportButton } from '@/components/game/ReportActions';
import { STAT_LABELS, type StatName } from '@/lib/types';

export const metadata = { title: 'Weekly Reports' };
export default async function ReportsPage() {
  const { p } = await getGameState();
  try { await ensureLastWeekReport(admin(), p, dungeonMaster()); } catch (e) { console.error('[reports] last-week report failed:', (e as Error).message); }
  const reports = await listReports(admin(), p.character.id, 8);
  const [latest, ...older] = reports;
  const m = (latest?.metrics ?? {}) as { xpByDay?: number[]; questsCompleted?: number; questsTotal?: number; completionRate?: number; activeDays?: number; bossesDefeated?: number };
  const deltas = latest ? (Object.entries(latest.stat_deltas) as [StatName, number][]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]) : [];
  return (
    <>
      <PageHeader title="Weekly Reports" subtitle="Feedback from a game mentor, not a spreadsheet. Built from what you actually did." actions={<GenerateReportButton />} />
      {!latest ? <Empty icon={<Brain className="h-8 w-8" />} title="No report yet">Your first report is written after your first full week. You can also generate one for the week so far.</Empty> : (
        <div className="space-y-5">
          <Card>
            <CardHeader><div><CardTitle>Week of {latest.week_start} → {latest.week_end}</CardTitle><p className="mt-1 text-xs text-parchment-dim">Written by {latest.generated_by === 'offline' ? 'the offline Dungeon Master' : `the AI Dungeon Master (${latest.generated_by})`}</p></div>{latest.generated_by !== 'offline' && <Badge tone="arcane">AI</Badge>}</CardHeader>
            <CardBody className="space-y-4">
              <p className="text-lg leading-relaxed">{latest.summary}</p>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-ember/40 bg-ember/5 p-4"><p className="label-caps flex items-center gap-1.5 text-ember-bright"><TriangleAlert className="h-3.5 w-3.5" aria-hidden />Weakness</p><p className="mt-1.5 text-sm">{latest.weakness}</p></div>
                <div className="rounded-xl border border-sage/40 bg-sage/5 p-4"><p className="label-caps flex items-center gap-1.5 text-sage-bright"><Lightbulb className="h-3.5 w-3.5" aria-hidden />Recommendation</p><p className="mt-1.5 text-sm">{latest.recommendation}</p></div>
              </div>
            </CardBody>
          </Card>
          <div className="grid gap-5 md:grid-cols-2">
            <Card><CardHeader><CardTitle>XP per day</CardTitle></CardHeader><CardBody>{m.xpByDay ? <WeekXpChart xpByDay={m.xpByDay} /> : null}</CardBody></Card>
            <Card><CardHeader><CardTitle>Growth</CardTitle></CardHeader><CardBody className="space-y-4">
              <dl className="grid grid-cols-3 gap-3 text-center"><div><dt className="label-caps">Quests</dt><dd className="num text-xl text-gold-bright">{m.questsCompleted ?? 0}/{m.questsTotal ?? 0}</dd></div><div><dt className="label-caps">Active days</dt><dd className="num text-xl text-gold-bright">{m.activeDays ?? 0}/7</dd></div><div><dt className="label-caps">Bosses</dt><dd className="num text-xl text-gold-bright">{m.bossesDefeated ?? 0}</dd></div></dl>
              {deltas.length ? <ul className="space-y-2">{deltas.slice(0, 6).map(([s, v]) => (<li key={s}><div className="mb-1 flex justify-between text-sm"><span className="text-parchment-muted">{STAT_LABELS[s]}</span><span className="num text-sage-bright">+{Math.round(v * 10) / 10}</span></div><Bar value={v} max={deltas[0][1]} tone="sage" className="h-1.5" label={STAT_LABELS[s]} /></li>))}</ul> : <p className="text-sm text-parchment-muted">No stat growth recorded this week.</p>}
            </CardBody></Card>
          </div>
          {older.length > 0 && (<section aria-label="Earlier reports"><h2 className="mb-3 font-display text-xl font-semibold">Earlier weeks</h2><div className="space-y-2">{older.map((r) => (<details key={r.id} className="card group px-5 py-3"><summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold">Week of {r.week_start}<span className="text-xs text-parchment-dim group-open:hidden">Show</span></summary><p className="mt-3 text-sm text-parchment-muted">{r.summary}</p><p className="mt-2 text-xs text-parchment-dim"><span className="text-ember-bright">Weakness:</span> {r.weakness} · <span className="text-sage-bright">Next:</span> {r.recommendation}</p></details>))}</div></section>)}
        </div>
      )}
    </>
  );
}
