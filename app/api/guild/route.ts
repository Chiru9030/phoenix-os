import { z } from 'zod';
import { api, body } from '@/lib/server/api';
import { GuildSchema, claimGuildQuest, createGuild, guildOverview, joinGuild, leaveGuild } from '@/lib/server/social';
const Action = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create') }).extend(GuildSchema.shape),
  z.object({ action: z.literal('join'), guildId: z.string().uuid() }),
  z.object({ action: z.literal('leave') }),
  z.object({ action: z.literal('claim'), questId: z.string().uuid() }),
]);
export const GET = api(async ({ db, p }) => ({ guild: await guildOverview(db, p) }));
export const POST = api(async ({ req, db, p }) => {
  const b = await body(req, Action);
  if (b.action === 'create') return createGuild(db, p, b);
  if (b.action === 'join') return { awards: await joinGuild(db, p, b.guildId) };
  if (b.action === 'leave') { await leaveGuild(db, p); return { ok: true }; }
  return claimGuildQuest(db, p, b.questId);
});
