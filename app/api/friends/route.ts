import { z } from 'zod';
import { api, body } from '@/lib/server/api';
import { friendOverview, respondFriend, searchPlayers, sendFriendRequest } from '@/lib/server/social';
const Action = z.discriminatedUnion('action', [
  z.object({ action: z.literal('request'), characterId: z.string().uuid() }),
  z.object({ action: z.enum(['accept', 'decline', 'remove']), id: z.string().uuid() }),
]);
export const GET = api(async ({ req, db, p }) => {
  const q = new URL(req.url).searchParams.get('q');
  return q ? { results: await searchPlayers(db, p, q) } : friendOverview(db, p);
});
export const POST = api(async ({ req, db, p }) => {
  const b = await body(req, Action);
  if (b.action === 'request') await sendFriendRequest(db, p, b.characterId); else await respondFriend(db, p, b.id, b.action);
});
