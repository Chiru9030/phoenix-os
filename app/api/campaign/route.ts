import { z } from 'zod';
import { api, body } from '@/lib/server/api';
import { CAMPAIGN_SLUGS, switchCampaign } from '@/lib/server/player';
import { runAwards } from '@/lib/server/progress';
export const POST = api(async ({ req, db, p }) => {
  const c = await switchCampaign(db, p, (await body(req, z.object({ slug: z.enum(CAMPAIGN_SLUGS) }))).slug);
  await runAwards(db, { characterId: p.character.id, userId: p.profile.id, campaignId: c.id }); // unlock chapters already earned
  return { campaign: c };
});
