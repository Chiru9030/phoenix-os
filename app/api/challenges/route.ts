import { z } from 'zod';
import { api, body } from '@/lib/server/api';
import { ChallengeSchema, challengeOverview, createChallenge, respondChallenge } from '@/lib/server/social';
const Action = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create') }).extend(ChallengeSchema.shape),
  z.object({ action: z.enum(['accept', 'decline']), id: z.string().uuid() }),
]);
export const GET = api(async ({ db, p }) => ({ challenges: await challengeOverview(db, p) }));
export const POST = api(async ({ req, db, p }) => {
  const b = await body(req, Action);
  if (b.action === 'create') await createChallenge(db, p, b); else await respondChallenge(db, p, b.id, b.action === 'accept');
});
