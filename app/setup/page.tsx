import Link from 'next/link';
import { Check, X } from 'lucide-react';
import { adminConfigured, supabaseConfigured } from '@/lib/env';
import { getDungeonMaster } from '@/lib/ai/hybrid';
import { Logo } from '@/components/layout/AppShell';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Setup' };
const Row = ({ ok, name, hint, optional }: { ok: boolean; name: string; hint: string; optional?: boolean }) => (
  <li className="flex items-start gap-3 rounded-lg border border-hairline px-4 py-3">
    <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${ok ? 'bg-sage/20 text-sage-bright' : optional ? 'bg-surface-raised text-parchment-dim' : 'bg-ember/20 text-ember-bright'}`} aria-label={ok ? 'Configured' : optional ? 'Optional, not set' : 'Missing'}>{ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}</span>
    <div><p className="num text-sm font-semibold">{name}{optional && <span className="ml-2 text-xs font-normal text-parchment-dim">optional</span>}</p><p className="mt-0.5 text-xs text-parchment-muted">{hint}</p></div>
  </li>
);
export default function Setup() {
  const dm = getDungeonMaster();
  const ready = supabaseConfigured() && adminConfigured();
  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-4 py-10">
      <Logo />
      <h1 className="mt-8 font-display text-3xl font-semibold">{ready ? 'Everything is connected' : 'Finish setting up Phoenix OS'}</h1>
      <p className="mt-2 text-sm text-parchment-muted">{ready ? 'Your Supabase project is wired up. You can sign up and play.' : 'The app needs a free Supabase project. This takes about five minutes; the README has the full walkthrough.'}</p>
      <ul className="mt-6 space-y-2.5">
        <Row ok={supabaseConfigured()} name="NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY" hint="Supabase → Project Settings → API. Copy the Project URL and the anon / publishable key into .env.local." />
        <Row ok={adminConfigured()} name="SUPABASE_SERVICE_ROLE_KEY" hint="Same page. Server-only: it lets the API pay out XP and Gold. Never expose it in the browser." />
        <Row ok={dm.usesLlm} optional name="ANTHROPIC_API_KEY or OPENAI_API_KEY" hint={dm.usesLlm ? `AI Dungeon Master active: ${dm.name}` : 'Not set: the built-in offline Dungeon Master is running. Add a key to upgrade it to LLM-written quests.'} />
        <Row ok={!!process.env.CRON_SECRET} optional name="CRON_SECRET" hint="Enables the scheduled morning / evening jobs (pre-generated quests, streak reminders)." />
      </ul>
      <p className="mt-6 rounded-lg border border-hairline bg-surface px-4 py-3 text-xs leading-relaxed text-parchment-muted">Then run the two SQL files in <span className="num text-parchment">supabase/migrations/</span> (0001_schema.sql, then 0002_seed.sql) in the Supabase SQL Editor, restart the dev server, and reload this page.</p>
      {ready && <Link href="/signup" className="mt-6 inline-block font-semibold text-gold hover:text-gold-bright">Create your character →</Link>}
    </div>
  );
}
