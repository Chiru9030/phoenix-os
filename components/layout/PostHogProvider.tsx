'use client';
import * as React from 'react';
import { usePathname } from 'next/navigation';

/** Optional product analytics. Does nothing unless NEXT_PUBLIC_POSTHOG_KEY is set; honours Do-Not-Track; never captures task text. */
export function PostHogProvider() {
  const path = usePathname();
  const ready = React.useRef<{ capture: (e: string, p?: Record<string, unknown> | null) => unknown } | null>(null);
  React.useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key || ready.current) return;
    void import('posthog-js').then(({ default: posthog }) => {
      posthog.init(key, { api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com', capture_pageview: false, person_profiles: 'identified_only', respect_dnt: true, disable_session_recording: true });
      ready.current = posthog; (window as unknown as { __ph?: unknown }).__ph = posthog;
      posthog.capture('$pageview');
    });
  }, []);
  React.useEffect(() => { ready.current?.capture('$pageview'); }, [path]);
  return null;
}
