import { api } from '@/lib/server/api';
import { spinWheel } from '@/lib/server/actions';
export const POST = api(({ db, p }) => spinWheel(db, p));
