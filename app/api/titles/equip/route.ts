import { z } from 'zod';
import { api, body } from '@/lib/server/api';
import { equipTitle } from '@/lib/server/actions';
export const POST = api(async ({ req, db, p }) => ({ title: await equipTitle(db, p, (await body(req, z.object({ key: z.string().max(60).nullable() }))).key) }));
