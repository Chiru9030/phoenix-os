import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { requireEnv } from '@/lib/env';

let cached: SupabaseClient | null = null;
/** Service-role client. Bypasses RLS: only ever call it with ids you have verified belong to the signed-in user. */
export function admin(): SupabaseClient {
  if (!cached) cached = createClient(requireEnv('NEXT_PUBLIC_SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false, autoRefreshToken: false } });
  return cached;
}
