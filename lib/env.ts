export const supabaseAnonKey = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
export const supabaseConfigured = () => !!(process.env.NEXT_PUBLIC_SUPABASE_URL && supabaseAnonKey());
export const adminConfigured = () => !!process.env.SUPABASE_SERVICE_ROLE_KEY;
export function requireEnv(name: string): string {
  const v = name === 'NEXT_PUBLIC_SUPABASE_ANON_KEY' ? supabaseAnonKey() : process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}. Copy .env.example to .env.local and fill it in.`);
  return v;
}
