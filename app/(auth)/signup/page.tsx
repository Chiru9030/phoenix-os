import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/layout/AuthForm';
import { Logo } from '@/components/layout/AppShell';
import { supabaseConfigured } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Create your character' };
const ALLOWED = ['google', 'github', 'apple'] as const;
export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  if (!supabaseConfigured()) redirect('/setup');
  const sp = await searchParams;
  const providers = (process.env.NEXT_PUBLIC_AUTH_PROVIDERS ?? 'google,github').split(',').map((s) => s.trim()).filter((s): s is (typeof ALLOWED)[number] => (ALLOWED as readonly string[]).includes(s));
  return (<div className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4 py-10"><Logo /><AuthForm mode="signup" next={sp.next} initialError={sp.error} providers={providers} /></div>);
}
