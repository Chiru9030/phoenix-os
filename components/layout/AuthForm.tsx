'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/primitives';
import { createClient } from '@/lib/supabase/client';

type Provider = 'google' | 'github' | 'apple';
const ICONS: Record<Provider, React.ReactNode> = {
  google: <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9a6 6 0 1 1 0-12c1.9 0 3.1.8 3.8 1.5l2.6-2.5A9.8 9.8 0 0 0 12 2a10 10 0 1 0 0 20c5.8 0 9.6-4 9.6-9.8 0-.7-.1-1.2-.2-1.8z" /></svg>,
  github: <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden><path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.76 0c2.2-1.49 3.17-1.18 3.17-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.83 1.18 3.09 0 4.42-2.7 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5z" /></svg>,
  apple: <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden><path d="M16.4 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9s-1.8-.8-3-.8c-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7 2-1.1 2.8-2.2c.9-1.3 1.2-2.5 1.3-2.6-.1 0-2.5-1-2.5-3.9zM14.2 5.7c.6-.8 1.1-1.9.9-3-1 0-2.1.7-2.8 1.5-.6.7-1.1 1.8-1 2.9 1.1.1 2.2-.6 2.9-1.4z" /></svg>,
};
const LABEL: Record<Provider, string> = { google: 'Google', github: 'GitHub', apple: 'Apple' };

export function AuthForm({ mode, next, initialError, providers }: { mode: 'login' | 'signup'; next?: string; initialError?: string; providers: Provider[] }) {
  const router = useRouter();
  const [email, setEmail] = React.useState(''), [password, setPassword] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState(initialError === 'auth' ? 'Sign-in did not complete. Please try again.' : '');
  const [notice, setNotice] = React.useState('');
  const dest = next && next.startsWith('/') && !next.startsWith('//') ? next : mode === 'signup' ? '/onboarding' : '/dashboard';

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    const supabase = createClient();
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${location.origin}/auth/callback?next=/onboarding` } });
        if (error) throw error;
        if (data.session) { router.push('/onboarding'); router.refresh(); } else setNotice('Check your email and click the confirmation link to begin.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push(dest); router.refresh();
      }
    } catch (err) { setError((err as Error).message || 'Something went wrong.'); } finally { setBusy(false); }
  }
  async function oauth(provider: Provider) {
    setError('');
    const { error } = await createClient().auth.signInWithOAuth({ provider, options: { redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(dest)}` } });
    if (error) setError(error.message);
  }
  return (
    <div className="card w-full max-w-md p-7">
      <h1 className="font-display text-2xl font-semibold">{mode === 'signup' ? 'Create your character' : 'Welcome back, adventurer'}</h1>
      <p className="mt-1 text-sm text-parchment-muted">{mode === 'signup' ? 'Free forever. Your story begins in a minute.' : 'Your quests are waiting.'}</p>
      {providers.length > 0 && (<><div className="mt-5 grid gap-2">{providers.map((p) => <Button key={p} variant="outline" type="button" onClick={() => oauth(p)}>{ICONS[p]}Continue with {LABEL[p]}</Button>)}</div>
        <div className="my-5 flex items-center gap-3 text-xs text-parchment-dim"><span className="h-px flex-1 bg-hairline" />or with email<span className="h-px flex-1 bg-hairline" /></div></>)}
      <form onSubmit={submit} className={providers.length ? '' : 'mt-5'} noValidate>
        <div className="space-y-3">
          <div><Label htmlFor="email">Email</Label><Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></div>
          <div><Label htmlFor="password">Password</Label><Input id="password" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" /></div>
        </div>
        {error && <p role="alert" className="mt-3 rounded-lg border border-ember/50 bg-ember/10 px-3 py-2 text-sm text-ember-bright">{error}</p>}
        {notice && <p role="status" className="mt-3 rounded-lg border border-sage/40 bg-sage/10 px-3 py-2 text-sm text-sage-bright">{notice}</p>}
        <Button type="submit" variant="gold" size="lg" className="mt-5 w-full" loading={busy}>{mode === 'signup' ? 'Begin Chapter I' : 'Sign in'}</Button>
      </form>
      <p className="mt-5 text-center text-sm text-parchment-muted">{mode === 'signup' ? <>Already have a character? <Link href="/login" className="font-semibold text-gold hover:text-gold-bright">Sign in</Link></> : <>New here? <Link href="/signup" className="font-semibold text-gold hover:text-gold-bright">Create a character</Link></>}</p>
    </div>
  );
}
