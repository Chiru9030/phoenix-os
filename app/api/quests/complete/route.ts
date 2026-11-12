import { z } from 'zod';
import { api, body } from '@/lib/server/api';
import { completeQuest } from '@/lib/server/quests';
export const POST = api(async ({ req, db, p }) => completeQuest(db, p, (await body(req, z.object({ questId: z.string().uuid() }))).questId));
