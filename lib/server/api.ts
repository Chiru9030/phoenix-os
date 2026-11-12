import 'server-only';
import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import type { z, ZodType } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { admin } from '@/lib/supabase/admin';
import { adminConfigured, supabaseConfigured } from '@/lib/env';
import type { HybridDungeonMaster } from '@/lib/ai/hybrid';
import { dungeonMaster } from './dm';
import { ensureProfile, loadPlayer, type Player } from './player';
import { HttpError, type Db } from './util';

export interface ApiCtx { req: Request; user: { id: string; email?: string | null }; db: Db; p: Player; dm: HybridDungeonMaster }

/** Wraps a route handler: config check → CSRF origin check → auth → player load → error mapping. */
export function api(fn: (c: ApiCtx) => Promise<unknown>, opts: { player?: boolean } = {}) {
  const needsPlayer = opts.player !== false;
  return async (req: Request): Promise<Response> => {
    try {
      if (!supabaseConfigured() || !adminConfigured()) throw new HttpError(503, 'The server is not configured yet. See /setup.');
      const origin = req.headers.get('origin'), host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
      if (req.method !== 'GET' && origin && host && new URL(origin).host !== host) throw new HttpError(403, 'Cross-origin request blocked.');
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new HttpError(401, 'Please sign in.');
      const db = admin();
      await ensureProfile(db, user);
      const p = await loadPlayer(db, user.id);
      if (needsPlayer && (!p || !p.character.onboarded)) throw new HttpError(409, 'Create your character first.');
      const out = await fn({ req, user, db, p: p as Player, dm: dungeonMaster() });
      return NextResponse.json(out ?? { ok: true });
    } catch (e) { return fail(e); }
  };
}
export async function body<S extends ZodType>(req: Request, schema: S): Promise<z.infer<S>> {
  let json: unknown;
  try { json = await req.json(); } catch { throw new HttpError(400, 'Invalid JSON body.'); }
  const r = schema.safeParse(json);
  if (!r.success) throw new HttpError(400, r.error.issues[0]?.message ?? 'Invalid request.');
  return r.data;
}
export function fail(e: unknown): Response {
  if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error('[api]', e);
  Sentry.captureException(e); // no-op unless a DSN is configured
  return NextResponse.json({ error: 'Something went wrong on our side. Please try again.' }, { status: 500 });
}
export function queryId(req: Request): string {
  const id = new URL(req.url).searchParams.get('id') ?? '';
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(400, 'Missing or invalid id.');
  return id;
}
