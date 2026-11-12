import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
export type Db = SupabaseClient;
export class HttpError extends Error { constructor(public status: number, message: string) { super(message); this.name = 'HttpError'; } }
// supabase-js infers result shapes from select strings; we declare our own row types and cast.
type Res = PromiseLike<{ data: unknown; error: PostgrestError | null }>;
/** Unwraps a PostgREST result, throwing on error. */
export async function must<T>(p: Res, what = 'database'): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data as T;
}
export async function maybe<T>(p: Res, what = 'database'): Promise<T | null> {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return (data ?? null) as T | null;
}
export const num = (v: unknown) => (typeof v === 'number' ? v : Number(v ?? 0));
export async function countOf(q: PromiseLike<{ count: number | null; error: PostgrestError | null }>): Promise<number> {
  const r = await q; if (r.error) throw new Error(r.error.message); return r.count ?? 0;
}
export const HEAD = { count: 'exact' as const, head: true };
