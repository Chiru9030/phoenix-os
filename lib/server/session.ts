import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { admin } from '@/lib/supabase/admin';
import { adminConfigured, supabaseConfigured } from '@/lib/env';
import { dungeonMaster } from './dm';
import { ensureProfile, loadPlayer, type Player } from './player';
import { ensureDailyState, type DayState } from './daily';
import { playerView } from './view';

export const currentUser = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
});
export async function requireUserPage() {
  if (!supabaseConfigured() || !adminConfigured()) redirect('/setup');
  const user = await currentUser();
  if (!user) redirect('/login');
  await ensureProfile(admin(), user);
  return user;
}
/** Signed in AND has a character; otherwise sends the visitor to the right place. */
export const requirePlayerPage = cache(async (): Promise<Player> => {
  const user = await requireUserPage();
  const p = await loadPlayer(admin(), user.id);
  if (!p || !p.character.onboarded) redirect('/onboarding');
  return p;
});
/** One load per request, shared by layout + page: rolls the day over if needed, then re-reads the player. */
export const getGameState = cache(async (): Promise<{ p: Player; day: DayState; view: ReturnType<typeof playerView> }> => {
  const p0 = await requirePlayerPage();
  const day = await ensureDailyState(admin(), p0, dungeonMaster());
  const p = (await loadPlayer(admin(), p0.profile.id)) ?? p0; // events (e.g. a treasure chest) may have changed gold
  return { p, day, view: playerView(p, day.today) };
});
