import { NextResponse } from 'next/server';
import { adminConfigured, supabaseConfigured } from '@/lib/env';
import { getDungeonMaster } from '@/lib/ai/hybrid';
export const dynamic = 'force-dynamic';
export function GET() {
  const dm = getDungeonMaster();
  return NextResponse.json({ ok: true, supabase: supabaseConfigured(), serviceRole: adminConfigured(), dungeonMaster: dm.name, cron: !!process.env.CRON_SECRET });
}
