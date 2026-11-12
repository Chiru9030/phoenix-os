/** Product analytics (PostHog) is strictly optional: a silent no-op unless NEXT_PUBLIC_POSTHOG_KEY is set. Never sends task text. */
export function track(event: string, props?: Record<string, string | number | boolean>) {
  try { (window as unknown as { __ph?: { capture: (e: string, p?: unknown) => void } }).__ph?.capture(event, props); } catch { /* ignore */ }
}
