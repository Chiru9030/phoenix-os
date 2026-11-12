import type { Db } from './util';

export interface NotifyInput { type: string; title: string; body?: string; push?: boolean }
/** In-app notification (always) + optional OneSignal push (only if configured and `push` is set). Never throws. */
export async function notify(db: Db, userId: string, n: NotifyInput): Promise<void> {
  try { await db.from('notifications').insert({ user_id: userId, notif_type: n.type, title: n.title.slice(0, 120), body: n.body?.slice(0, 400) ?? null }); } catch { /* non-critical */ }
  const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID, key = process.env.ONESIGNAL_REST_API_KEY;
  if (!n.push || !appId || !key) return;
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 4000);
  try {
    await fetch('https://api.onesignal.com/notifications', {
      method: 'POST', signal: ctl.signal,
      headers: { 'content-type': 'application/json', authorization: `Key ${key}` },
      body: JSON.stringify({ app_id: appId, target_channel: 'push', include_aliases: { external_id: [userId] }, headings: { en: n.title }, contents: { en: n.body ?? n.title } }),
    });
  } catch { /* push is best-effort */ } finally { clearTimeout(t); }
}
export const prefAllows = (prefs: Record<string, boolean> | undefined, key: string) => (prefs ? prefs[key] !== false : true);
