import { admin } from '@/lib/supabase/admin';
import { getGameState } from '@/lib/server/session';
import { loadRewards } from '@/lib/server/loaders';
import { DEFAULT_REWARD_TIERS } from '@/lib/game/economy';
import { PageHeader } from '@/components/ui/primitives';
import { RewardsClient } from '@/components/game/RewardsClient';
export const metadata = { title: 'Rewards Shop' };
export default async function RewardsPage() {
  const { p, view } = await getGameState();
  const r = await loadRewards(admin(), p);
  return (<><PageHeader title="Rewards Shop" subtitle="Gold is not just a number. Spend it on real-life rewards you have earned. Prices are yours to set." /><RewardsClient gold={view.gold} discountPct={r.discountPct} defaults={DEFAULT_REWARD_TIERS} custom={r.custom} history={r.history} /></>);
}
