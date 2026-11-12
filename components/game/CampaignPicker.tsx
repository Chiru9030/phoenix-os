'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/primitives';
import { api } from '@/lib/client/api';
import { cn } from '@/lib/utils';
import { GameIcon } from './icons';
import { useGame } from './GameProvider';

export interface CampaignLite { slug: string; name: string; description: string | null; icon: string | null; chapters: number; reached: number }
export function CampaignPicker({ campaigns, active }: { campaigns: CampaignLite[]; active: string | null }) {
  const router = useRouter(), game = useGame();
  const [busy, setBusy] = React.useState<string | null>(null);
  async function pick(slug: string, name: string) {
    setBusy(slug);
    try { await api('/api/campaign', { body: { slug } }); game.toast({ tone: 'sage', title: `Campaign switched: ${name}`, body: 'Tomorrow\'s quests and your story follow the new path. Today\'s board stays as it is.' }); router.refresh(); }
    catch (e) { game.play('error'); game.toast({ tone: 'ember', title: (e as Error).message }); } finally { setBusy(null); }
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {campaigns.map((c) => (
        <div key={c.slug} className={cn('card flex flex-col gap-3 p-5', c.slug === active && 'border-gold')}>
          <div className="flex items-start gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-gold-dim bg-gold/10"><GameIcon name={c.icon} className="h-5 w-5 text-gold-bright" /></div>
            <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-display text-lg font-semibold">{c.name}</h3>{c.slug === active && <Badge tone="gold">Active</Badge>}</div><p className="mt-1 text-sm text-parchment-muted">{c.description}</p></div></div>
          <div className="mt-auto flex items-center justify-between"><span className="num text-xs text-parchment-dim">Story: {c.reached}/{c.chapters} chapters opened</span>
            {c.slug !== active && <Button size="sm" variant="outline" loading={busy === c.slug} onClick={() => pick(c.slug, c.name)}>Switch to this</Button>}</div>
        </div>
      ))}
    </div>
  );
}
