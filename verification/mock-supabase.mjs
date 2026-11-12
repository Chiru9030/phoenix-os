// TEST HARNESS (see verification/README.md): one port that behaves like a Supabase project.
//   /rest/v1/*  → real PostgREST (127.0.0.1:3001)      /auth/v1/* → minimal GoTrue (password auth, JWT, /user)
import http from 'node:http';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
const PG = { host: process.env.PGHOST || 'localhost', user: process.env.PGUSER || 'testuser', db: process.env.PGDATABASE || 'phoenix_test', pass: process.env.PGPASSWORD || 'test' };
const SECRET = process.env.JWT_SECRET, PORT = Number(process.env.PORT || 54321);
const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
export const sign = (claims) => { const h = b64({ alg: 'HS256', typ: 'JWT' }), p = b64(claims); return `${h}.${p}.${crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url')}`; };
const verify = (t) => { try { const [h, p, s] = t.split('.'); if (crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url') !== s) return null; const c = JSON.parse(Buffer.from(p, 'base64url')); return c.exp > Date.now() / 1000 ? c : null; } catch { return null; } };
const users = new Map(); const refresh = new Map();
const psql = (sql) => execFileSync('psql', ['-h', PG.host, '-U', PG.user, '-d', PG.db, '-tAqc', sql], { env: { ...process.env, PGPASSWORD: PG.pass } }).toString();
const userJson = (u) => ({ id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, email_confirmed_at: u.created, phone: '', confirmed_at: u.created, last_sign_in_at: new Date().toISOString(), app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: u.meta ?? {}, identities: [], created_at: u.created, updated_at: u.created });
function session(u) {
  const now = Math.floor(Date.now() / 1000), exp = now + 3600, rt = crypto.randomUUID(); refresh.set(rt, u.email);
  return { access_token: sign({ sub: u.id, role: 'authenticated', aud: 'authenticated', email: u.email, exp, iat: now }), token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: rt, user: userJson(u) };
}
const send = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(body === undefined ? '' : JSON.stringify(body)); };
const readBody = (req) => new Promise((r) => { const c = []; req.on('data', (d) => c.push(d)); req.on('end', () => r(Buffer.concat(c))); });
http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith('/rest/v1')) {
      const body = await readBody(req); const headers = { ...req.headers }; delete headers.host; delete headers['content-length'];
      const r = await fetch(`http://127.0.0.1:3001${url.pathname.slice('/rest/v1'.length)}${url.search}`, { method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body });
      const out = Buffer.from(await r.arrayBuffer()); const h = {}; r.headers.forEach((v, k) => { if (!['content-encoding', 'transfer-encoding', 'content-length'].includes(k)) h[k] = v; });
      res.writeHead(r.status, h); return res.end(out);
    }
    if (url.pathname === '/auth/v1/signup' || (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'password')) {
      const { email, password, data } = JSON.parse((await readBody(req)).toString() || '{}');
      let u = users.get(email);
      if (url.pathname.endsWith('signup')) { if (u) return send(res, 422, { code: 422, error_code: 'user_already_exists', msg: 'User already registered' }); u = { id: crypto.randomUUID(), email, password, created: new Date().toISOString(), meta: data }; users.set(email, u); psql(`insert into auth.users (id,email,raw_user_meta_data) values ('${u.id}','${email}','${JSON.stringify(data ?? {}).replace(/'/g, "''")}'::jsonb)`); }
      else if (!u || u.password !== password) return send(res, 400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
      return send(res, 200, session(u));
    }
    if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'refresh_token') {
      const { refresh_token } = JSON.parse((await readBody(req)).toString()); const email = refresh.get(refresh_token);
      return email ? send(res, 200, session(users.get(email))) : send(res, 400, { error: 'invalid_grant' });
    }
    if (url.pathname === '/auth/v1/user') {
      const c = verify((req.headers.authorization ?? '').replace('Bearer ', ''));
      const u = c && [...users.values()].find((x) => x.id === c.sub);
      return u ? send(res, 200, userJson(u)) : send(res, 401, { code: 401, msg: 'invalid JWT' });
    }
    if (url.pathname === '/auth/v1/logout') return send(res, 204);
    send(res, 404, { error: 'not found', path: url.pathname });
  } catch (e) { send(res, 500, { error: String(e) }); }
}).listen(PORT, () => console.log('mock supabase on', PORT));
