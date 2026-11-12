import { z } from 'zod';
import { api, body } from '@/lib/server/api';
import { coachChat } from '@/lib/server/reports';
import { must } from '@/lib/server/util';
export const GET = api(async ({ db, p }) => ({ messages: (await must<{ role: string; content: string; created_at: string }[]>(db.from('coaching_messages').select('role,content,created_at').eq('character_id', p.character.id).order('created_at', { ascending: false }).limit(30))).reverse() }));
export const POST = api(async ({ req, db, p, dm }) => coachChat(db, p, dm, (await body(req, z.object({ message: z.string().trim().min(1).max(600) }))).message));
