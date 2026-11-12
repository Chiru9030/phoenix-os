import { z } from 'zod';
import { api, body } from '@/lib/server/api';
export const POST = api(async ({ req, db, p }) => {
  const b = await body(req, z.object({ ids: z.array(z.string().uuid()).max(100).optional() }));
  const q = db.from('notifications').update({ is_read: true }).eq('user_id', p.profile.id).eq('is_read', false);
  await (b.ids?.length ? q.in('id', b.ids) : q);
});
