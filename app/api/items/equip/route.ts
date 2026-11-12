import { z } from 'zod';
import { api, body } from '@/lib/server/api';
import { equipItem } from '@/lib/server/actions';
export const POST = api(async ({ req, db, p }) => { const b = await body(req, z.object({ key: z.string().max(60), equip: z.boolean() })); return equipItem(db, p, b.key, b.equip); });
