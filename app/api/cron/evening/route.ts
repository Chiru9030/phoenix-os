import { NextResponse } from 'next/server';
import { admin } from '@/lib/supabase/admin';
import { cronAuthorized, pageFrom, runEvening } from '@/lib/server/cron';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // keep batches small: add more cron entries with ?offset= to cover more players
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await runEvening(admin(), pageFrom(req)));
}
