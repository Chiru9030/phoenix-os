'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/client/api';

export interface Notif { id: string; notif_type: string; title: string; body: string | null; is_read: boolean; created_at: string }
export function NotificationsBell({ items }: { items: Notif[] }) {
  const router = useRouter();
  const unread = items.filter((n) => !n.is_read).length;
  const [busy, setBusy] = React.useState(false);
  async function markAll() { setBusy(true); try { await api('/api/notifications/read', { body: {} }); router.refresh(); } finally { setBusy(false); } }
  return (
    <Dialog>
      <DialogTrigger aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} className="relative rounded-lg p-2 text-parchment-muted hover:bg-surface-raised hover:text-parchment">
        <Bell className="h-5 w-5" />
        {unread > 0 && <span className="num absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-ember px-1 text-[10px] font-semibold text-white">{unread}</span>}
      </DialogTrigger>
      <DialogContent title="Notifications" description="Messages from your Dungeon Master and the realm.">
        {items.length === 0 ? <p className="py-6 text-center text-sm text-parchment-muted">Nothing yet. Quests, bosses and achievements will announce themselves here.</p> : (
          <ul className="space-y-2">
            {items.map((n) => (
              <li key={n.id} className={`rounded-lg border px-3 py-2.5 ${n.is_read ? 'border-hairline' : 'border-gold-dim/60 bg-gold/5'}`}>
                <p className="text-sm font-semibold">{n.title}</p>{n.body && <p className="mt-0.5 text-xs text-parchment-muted">{n.body}</p>}
                <p className="mt-1 text-[11px] text-parchment-dim">{new Date(n.created_at).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        )}
        {unread > 0 && <Button className="mt-4 w-full" onClick={markAll} loading={busy}>Mark all as read</Button>}
      </DialogContent>
    </Dialog>
  );
}
