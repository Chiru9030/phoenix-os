'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/primitives';
import { Switch } from '@/components/ui/switch';
import { api } from '@/lib/client/api';
import { STAT_LABELS, STAT_NAMES, type Difficulty, type StatName } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useGame } from './GameProvider';

export interface SettingsData { characterName: string; username: string; timezone: string; difficulty: Difficulty; focusStats: StatName[]; soundEnabled: boolean; prefs: { morning_quests: boolean; boss_reminders: boolean; streak_protection: boolean; daily_summary: boolean }; dm: string }
const PREF_LABELS = { morning_quests: 'Morning quest board is ready', boss_reminders: 'Boss about to flee', streak_protection: 'Streak at risk (evening)', daily_summary: 'Daily summary' } as const;
export function SettingsClient({ initial }: { initial: SettingsData }) {
  const router = useRouter(), game = useGame();
  const [s, setS] = React.useState(initial), [busy, setBusy] = React.useState(false);
  const [zones, setZones] = React.useState<string[]>([initial.timezone]);
  React.useEffect(() => { const z = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone'); if (z?.length) setZones(z.includes(initial.timezone) ? z : [initial.timezone, ...z]); }, [initial.timezone]);
  const toggleFocus = (st: StatName) => setS((x) => ({ ...x, focusStats: x.focusStats.includes(st) ? x.focusStats.filter((y) => y !== st) : x.focusStats.length < 3 ? [...x.focusStats, st] : x.focusStats }));
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try { await api('/api/settings', { body: { characterName: s.characterName, username: s.username, timezone: s.timezone, soundEnabled: s.soundEnabled, difficulty: s.difficulty, focusStats: s.focusStats, notificationPrefs: s.prefs } }); game.toast({ tone: 'sage', title: 'Settings saved' }); router.refresh(); }
    catch (err) { game.play('error'); game.toast({ tone: 'ember', title: (err as Error).message }); } finally { setBusy(false); }
  }
  return (
    <form onSubmit={save} className="space-y-5">
      <section className="card space-y-4 p-5"><h2 className="font-display text-lg font-semibold">Profile</h2>
        <div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="cn">Character name</Label><Input id="cn" value={s.characterName} minLength={2} maxLength={24} onChange={(e) => setS({ ...s, characterName: e.target.value })} /></div>
          <div><Label htmlFor="un">Username (for friends)</Label><Input id="un" value={s.username} pattern="[a-z0-9_]{3,20}" title="3-20 lowercase letters, numbers or underscores" onChange={(e) => setS({ ...s, username: e.target.value.toLowerCase() })} /></div>
          <div className="sm:col-span-2"><Label htmlFor="tz">Timezone</Label><Select id="tz" value={s.timezone} onChange={(e) => setS({ ...s, timezone: e.target.value })}>{zones.map((z) => <option key={z} value={z}>{z}</option>)}</Select><p className="mt-1 text-xs text-parchment-dim">Your days (and streaks) roll over at midnight in this timezone.</p></div></div></section>
      <section className="card space-y-4 p-5"><h2 className="font-display text-lg font-semibold">Gameplay</h2>
        <div><Label htmlFor="df">Difficulty</Label><Select id="df" value={s.difficulty} onChange={(e) => setS({ ...s, difficulty: e.target.value as Difficulty })}><option value="gentle">Gentle: about 4 quests a day</option><option value="normal">Adventurer: about 5-6 quests a day</option><option value="hardcore">Hardcore: up to 8 quests, +15% XP</option></Select></div>
        <fieldset><legend className="mb-1.5 text-xs font-semibold text-parchment-muted">Focus stats (up to 3): the Dungeon Master leans quests toward these</legend><div className="flex flex-wrap gap-2">{STAT_NAMES.map((st) => <button key={st} type="button" aria-pressed={s.focusStats.includes(st)} onClick={() => toggleFocus(st)} className={cn('rounded-full border px-3 py-1.5 text-sm font-semibold', s.focusStats.includes(st) ? 'border-gold bg-gold/15 text-gold-bright' : 'border-hairline text-parchment-muted hover:border-gold-dim')}>{STAT_LABELS[st]}</button>)}</div></fieldset>
        <div className="flex items-center justify-between"><Label htmlFor="snd" className="mb-0 text-sm text-parchment">Sound effects</Label><Switch id="snd" checked={s.soundEnabled} onCheckedChange={(v) => setS({ ...s, soundEnabled: v })} /></div></section>
      <section className="card space-y-3 p-5"><h2 className="font-display text-lg font-semibold">Notifications</h2><p className="text-xs text-parchment-dim">In-app always. Push alerts also need the browser permission and a configured OneSignal app.</p>
        {(Object.keys(PREF_LABELS) as (keyof typeof PREF_LABELS)[]).map((k) => <div key={k} className="flex items-center justify-between"><Label htmlFor={k} className="mb-0 text-sm text-parchment">{PREF_LABELS[k]}</Label><Switch id={k} checked={s.prefs[k]} onCheckedChange={(v) => setS({ ...s, prefs: { ...s.prefs, [k]: v } })} /></div>)}</section>
      <section className="card p-5"><h2 className="font-display text-lg font-semibold">AI Dungeon Master</h2><p className="mt-1 text-sm text-parchment-muted">Currently running: <span className="num text-gold-bright">{s.dm}</span>. {s.dm === 'offline' ? 'The built-in engine is active. Add an Anthropic or OpenAI key on the server to upgrade it.' : 'If the AI service is ever unavailable, the offline engine takes over automatically.'}</p></section>
      <div className="flex flex-wrap items-center gap-3"><Button type="submit" variant="gold" size="lg" loading={busy}>Save changes</Button>
        <Button type="button" variant="outline" size="lg" onClick={() => { const f = document.createElement('form'); f.method = 'post'; f.action = '/auth/signout'; document.body.appendChild(f); f.submit(); }}><LogOut className="h-4 w-4" />Sign out</Button></div>
    </form>
  );
}
