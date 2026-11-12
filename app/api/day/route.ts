import { api } from '@/lib/server/api';
import { ensureDailyState } from '@/lib/server/daily';
import { playerView } from '@/lib/server/view';
export const GET = api(async ({ db, p, dm }) => {
  const day = await ensureDailyState(db, p, dm);
  return { player: playerView(p, day.today), ...day };
});
