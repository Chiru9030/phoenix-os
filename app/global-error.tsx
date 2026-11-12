'use client';
import * as React from 'react';
import * as Sentry from '@sentry/nextjs';
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  React.useEffect(() => { Sentry.captureException(error); }, [error]);
  return (<html lang="en"><body style={{ background: '#100f17', color: '#ede9f6', fontFamily: 'system-ui, sans-serif', display: 'flex', minHeight: '100dvh', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24 }}><div><h1 style={{ fontSize: 28, margin: 0 }}>Phoenix OS hit an unexpected error.</h1><p style={{ color: '#a39ebd', maxWidth: 360, margin: '12px auto 20px' }}>Your progress is safe. Please reload the page.</p><button onClick={reset} style={{ background: '#d4a94e', color: '#100f17', border: 0, borderRadius: 8, padding: '10px 18px', fontWeight: 700, cursor: 'pointer' }}>Reload</button></div></body></html>);
}
