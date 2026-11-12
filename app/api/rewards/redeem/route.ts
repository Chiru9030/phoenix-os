import { api, body } from '@/lib/server/api';
import { RedeemSchema, redeem } from '@/lib/server/actions';
export const POST = api(async ({ req, db, p }) => redeem(db, p, await body(req, RedeemSchema)));
