import Link from 'next/link';
import { Button } from '@/components/ui/button';
export default function NotFound() {
  return (<div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center"><p className="num font-display text-7xl font-semibold text-gold">404</p><h1 className="font-display text-2xl font-semibold">This corridor leads nowhere.</h1><p className="max-w-sm text-sm text-parchment-muted">The page you were looking for is not on the map. The Dungeon Master suggests going back.</p><Button asChild variant="gold"><Link href="/dashboard">Back to the dashboard</Link></Button></div>);
}
