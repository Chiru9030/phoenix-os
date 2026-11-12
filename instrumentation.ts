import * as Sentry from '@sentry/nextjs';

// Error monitoring is OPTIONAL: with no NEXT_PUBLIC_SENTRY_DSN the SDK initialises disabled and sends nothing.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') await import('./sentry.server.config');
}
export const onRequestError = Sentry.captureRequestError;
