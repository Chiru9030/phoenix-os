import { z } from 'zod';
import { api, body } from '@/lib/server/api';
import { unlockSkill } from '@/lib/server/actions';
export const POST = api(async ({ req, db, p }) => unlockSkill(db, p, (await body(req, z.object({ key: z.string().max(60) }))).key));
