import { z } from 'zod';
import { api, body, queryId } from '@/lib/server/api';
import { createHabit, deleteHabit, setHabitActive } from '@/lib/server/actions';
import { HabitSchema, IdSchema } from '@/lib/server/schemas';
export const POST = api(async ({ req, db, p }) => createHabit(db, p, await body(req, HabitSchema)));
export const PATCH = api(async ({ req, db, p }) => { const b = await body(req, IdSchema.extend({ active: z.boolean() })); return { habit: await setHabitActive(db, p, b.id, b.active) }; });
export const DELETE = api(async ({ req, db, p }) => { await deleteHabit(db, p, queryId(req)); });
