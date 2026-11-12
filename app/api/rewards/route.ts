import { api, body, queryId } from '@/lib/server/api';
import { createReward, deleteReward } from '@/lib/server/actions';
import { RewardSchema } from '@/lib/server/schemas';
export const POST = api(async ({ req, db, p }) => ({ reward: await createReward(db, p, await body(req, RewardSchema)) }));
export const DELETE = api(async ({ req, db, p }) => { await deleteReward(db, p, queryId(req)); });
