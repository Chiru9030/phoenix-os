import { redirect } from 'next/navigation';
import { admin } from '@/lib/supabase/admin';
import { loadPlayer } from '@/lib/server/player';
import { requireUserPage } from '@/lib/server/session';
import { must } from '@/lib/server/util';
import { Logo } from '@/components/layout/AppShell';
import { OnboardingWizard, type CampaignOpt } from '@/components/layout/OnboardingWizard';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Create your character' };
export default async function Onboarding() {
  const user = await requireUserPage();
  const p = await loadPlayer(admin(), user.id);
  if (p?.character.onboarded) redirect('/dashboard');
  const campaigns = await must<CampaignOpt[]>(admin().from('campaigns').select('slug,name,description,icon').order('name'));
  const order = ['general', 'fitness', 'placement', 'startup', 'upsc', 'exam'];
  campaigns.sort((a, b) => order.indexOf(a.slug) - order.indexOf(b.slug));
  return (<div className="flex min-h-dvh flex-col items-center gap-8 px-4 py-8"><Logo /><OnboardingWizard campaigns={campaigns} /></div>);
}
