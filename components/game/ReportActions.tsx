'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/client/api';
import { useGame } from './GameProvider';
export function GenerateReportButton() {
  const router = useRouter(), game = useGame(); const [busy, setBusy] = React.useState(false);
  return <Button variant="gold" loading={busy} onClick={async () => { setBusy(true); try { await api('/api/reports', { body: {} }); game.toast({ tone: 'sage', title: 'Report updated' }); router.refresh(); } catch (e) { game.toast({ tone: 'ember', title: (e as Error).message }); } finally { setBusy(false); } }}>Generate this week&apos;s report</Button>;
}
