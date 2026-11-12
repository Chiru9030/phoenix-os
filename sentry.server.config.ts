import * as Sentry from '@sentry/nextjs';
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
// sendDefaultPii:false → no IPs/cookies/user details. Task text and chat messages are never attached by us.
Sentry.init({ dsn, enabled: !!dsn, tracesSampleRate: 0.1, sendDefaultPii: false });
