import { z } from 'zod';
import { api, body, queryId } from '@/lib/server/api';
import { createGoal, deleteGoal, setGoalStatus } from '@/lib/server/actions';
import { GoalSchema, IdSchema } from '@/lib/server/schemas';
export const POST = api(async ({ req, db, p }) => createGoal(db, p, await body(req, GoalSchema)));
export const PATCH = api(async ({ req, db, p }) => { const b = await body(req, IdSchema.extend({ status: z.enum(['active', 'done', 'dropped']) })); return { goal: await setGoalStatus(db, p, b.id, b.status) }; });
export const DELETE = api(async ({ req, db, p }) => { await deleteGoal(db, p, queryId(req)); });
