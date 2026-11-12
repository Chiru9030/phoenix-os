'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/primitives';
import { CharacterCrest } from '@/components/game/CharacterCrest';
import { GameIcon } from '@/components/game/icons';
import { api } from '@/lib/client/api';
import { CLASSES } from '@/lib/game/classes';
import { STAT_LABELS, STAT_NAMES, type Difficulty, type StatName } from '@/lib/types';
import { cn } from '@/lib/utils';

export interface CampaignOpt { slug: string; name: string; description: string | null; icon: string | null }
const DIFFS: { v: Difficulty; name: string; body: string }[] = [
  { v: 'gentle', name: 'Gentle', body: 'A lighter board (about 4 quests). Ideal if you are busy or rebuilding the habit.' },
  { v: 'normal', name: 'Adventurer', body: 'A balanced board (about 5-6 quests). The recommended starting point.' },
  { v: 'hardcore', name: 'Hardcore', body: 'A big board (up to 8 quests) with +15% XP. For people who want a challenge.' },
];
export function OnboardingWizard({ campaigns }: { campaigns: CampaignOpt[] }) {
  const router = useRouter();
  const [step, setStep] = React.useState(0);
  const [name, setName] = React.useState(''), [cls, setCls] = React.useState('Adventurer'), [campaign, setCampaign] = React.useState('general');
  const [focus, setFocus] = React.useState<StatName[]>([]), [difficulty, setDifficulty] = React.useState<Difficulty>('normal');
  const [busy, setBusy] = React.useState(false), [error, setError] = React.useState('');
  const toggle = (s: StatName) => setFocus((f) => (f.includes(s) ? f.filter((x) => x !== s) : f.length < 3 ? [...f, s] : f));
  const nameOk = name.trim().length >= 2;
  async function start() {
    setBusy(true); setError('');
    try {
      await api('/api/onboarding', { body: { name: name.trim(), characterClass: cls, campaignSlug: campaign, focusStats: focus, difficulty, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } });
      router.push('/dashboard'); router.refresh();
    } catch (e) { setError((e as Error).message); setBusy(false); }
  }
  const steps = ['Hero', 'Campaign', 'Style', 'Begin'];
  return (
    <div className="mx-auto w-full max-w-3xl">
      <ol className="mb-6 flex items-center gap-2" aria-label="Progress">{steps.map((s, i) => (<li key={s} className="flex flex-1 items-center gap-2"><span className={cn('num flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold', i < step ? 'border-gold bg-gold text-ink' : i === step ? 'border-gold text-gold-bright' : 'border-hairline text-parchment-dim')} aria-current={i === step ? 'step' : undefined}>{i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}</span><span className={cn('hidden text-xs font-semibold sm:block', i === step ? 'text-parchment' : 'text-parchment-dim')}>{s}</span>{i < steps.length - 1 && <span className="h-px flex-1 bg-hairline" />}</li>))}</ol>
      <div className="card p-6 md:p-8">
        {step === 0 && (<div>
          <h1 className="font-display text-3xl font-semibold">Who walks into the story?</h1>
          <div className="mt-5 max-w-sm"><Label htmlFor="name">Character name</Label><Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder="e.g. Aria the Relentless" autoFocus /></div>
          <p className="label-caps mt-6">Choose a class</p>
          <div className="mt-2 grid gap-2.5 sm:grid-cols-2" role="radiogroup" aria-label="Class">
            {CLASSES.map((c) => (<button key={c.name} type="button" role="radio" aria-checked={cls === c.name} onClick={() => setCls(c.name)} className={cn('flex items-center gap-3 rounded-xl border p-3 text-left transition-colors', cls === c.name ? 'border-gold bg-gold/10' : 'border-hairline hover:border-gold-dim')}>
              <CharacterCrest level={1} progress={0} characterClass={c.name} size={64} /><div><p className="font-display font-semibold">{c.name}</p><p className="text-xs text-parchment-muted">{c.blurb}</p></div></button>))}
          </div>
        </div>)}
        {step === 1 && (<div>
          <h1 className="font-display text-3xl font-semibold">Pick your first campaign</h1><p className="mt-1 text-sm text-parchment-muted">It shapes your quests, story and NPCs. You can switch any time; progress is kept.</p>
          <div className="mt-5 grid gap-2.5 sm:grid-cols-2" role="radiogroup" aria-label="Campaign">
            {campaigns.map((c) => (<button key={c.slug} type="button" role="radio" aria-checked={campaign === c.slug} onClick={() => setCampaign(c.slug)} className={cn('flex gap-3 rounded-xl border p-4 text-left transition-colors', campaign === c.slug ? 'border-gold bg-gold/10' : 'border-hairline hover:border-gold-dim')}>
              <GameIcon name={c.icon} className="mt-0.5 h-5 w-5 shrink-0 text-gold" /><div><p className="font-display font-semibold">{c.name}</p><p className="mt-0.5 text-xs text-parchment-muted">{c.description}</p></div></button>))}
          </div>
        </div>)}
        {step === 2 && (<div>
          <h1 className="font-display text-3xl font-semibold">How do you want to play?</h1>
          <p className="label-caps mt-5">Focus stats <span className="normal-case tracking-normal text-parchment-dim">(up to 3. The Dungeon Master leans quests toward them)</span></p>
          <div className="mt-2 flex flex-wrap gap-2">{STAT_NAMES.map((s) => (<button key={s} type="button" aria-pressed={focus.includes(s)} onClick={() => toggle(s)} className={cn('rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors', focus.includes(s) ? 'border-gold bg-gold/15 text-gold-bright' : 'border-hairline text-parchment-muted hover:border-gold-dim')}>{STAT_LABELS[s]}</button>))}</div>
          <p className="label-caps mt-6">Difficulty</p>
          <div className="mt-2 grid gap-2.5 sm:grid-cols-3" role="radiogroup" aria-label="Difficulty">{DIFFS.map((d) => (<button key={d.v} type="button" role="radio" aria-checked={difficulty === d.v} onClick={() => setDifficulty(d.v)} className={cn('rounded-xl border p-3.5 text-left transition-colors', difficulty === d.v ? 'border-gold bg-gold/10' : 'border-hairline hover:border-gold-dim')}><p className="font-display font-semibold">{d.name}</p><p className="mt-1 text-xs text-parchment-muted">{d.body}</p></button>))}</div>
        </div>)}
        {step === 3 && (<div className="text-center">
          <CharacterCrest level={1} progress={0} characterClass={cls} size={170} className="mx-auto" />
          <h1 className="mt-4 font-display text-3xl font-semibold">{name.trim()}, the {cls}</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-parchment-muted">{campaigns.find((c) => c.slug === campaign)?.name} · {DIFFS.find((d) => d.v === difficulty)?.name}{focus.length ? ` · Focus: ${focus.map((s) => STAT_LABELS[s]).join(', ')}` : ''}</p>
          <p className="mx-auto mt-4 max-w-md text-sm text-parchment-muted">Your first quests are being written. Next, add your real goals and habits in <span className="text-parchment">Goals &amp; Habits</span> so the Dungeon Master can build your days around them.</p>
          {error && <p role="alert" className="mx-auto mt-4 max-w-md rounded-lg border border-ember/50 bg-ember/10 px-3 py-2 text-sm text-ember-bright">{error}</p>}
        </div>)}
        <div className="mt-8 flex items-center justify-between">
          <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={step === 0 || busy}><ArrowLeft className="h-4 w-4" />Back</Button>
          {step < 3 ? <Button variant="gold" onClick={() => setStep((s) => s + 1)} disabled={step === 0 && !nameOk}>Next<ArrowRight className="h-4 w-4" /></Button> : <Button variant="gold" size="lg" onClick={start} loading={busy}>Begin the adventure</Button>}
        </div>
      </div>
    </div>
  );
}
