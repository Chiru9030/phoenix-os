import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAnonKey } from '@/lib/env';

const PUBLIC_PREFIXES = ['/login', '/signup', '/auth', '/api/cron', '/api/health', '/setup'];
const isPublic = (path: string) => path === '/' || PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(p + '/'));

/** Refreshes the Supabase session cookie on every request and gates private routes. */
export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = supabaseAnonKey();
  if (!url || !key) return NextResponse.next({ request }); // not configured yet: pages show the setup guide
  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const redirect = (to: string, search?: Record<string, string>) => {
    const u = request.nextUrl.clone(); u.pathname = to; u.search = '';
    Object.entries(search ?? {}).forEach(([k, v]) => u.searchParams.set(k, v));
    const r = NextResponse.redirect(u);
    response.cookies.getAll().forEach((c) => r.cookies.set(c)); // keep refreshed auth cookies on redirects
    return r;
  };
  if (!user && !isPublic(path)) {
    if (path.startsWith('/api/')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return redirect('/login', { next: path });
  }
  if (user && (path.startsWith('/login') || path.startsWith('/signup'))) return redirect('/dashboard');
  return response;
}
