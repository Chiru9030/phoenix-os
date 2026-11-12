'use client';
import * as React from 'react';
import * as Sentry from '@sentry/nextjs';
import { Button } from '@/components/ui/button';
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  React.useEffect(() => { console.error(error); Sentry.captureException(error); }, [error]);
  return (<div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 px-4 text-center"><h1 className="font-display text-2xl font-semibold">A wild bug appeared.</h1><p className="max-w-sm text-sm text-parchment-muted">Something went wrong on our side. Your progress is safe. Try again, and if it keeps happening, come back in a minute.</p>{error.digest && <p className="num text-xs text-parchment-dim">Reference: {error.digest}</p>}<Button variant="gold" onClick={reset}>Try again</Button></div>);
}
