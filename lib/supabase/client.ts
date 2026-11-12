import { createBrowserClient } from '@supabase/ssr';
import { supabaseAnonKey } from '@/lib/env';
/** Browser client: used ONLY for sign-in/up/out. All game data flows through the server. */
export function createClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, supabaseAnonKey());
}
