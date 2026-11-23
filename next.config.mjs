import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  reactStrictMode: true,
  experimental: {
    agentUpgrade: 'security',
  },
  images: { remotePatterns: [{ protocol: 'https', hostname: '**.supabase.co' }] },
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    ] }];
  },
};
// Source-map upload only when you provide a Sentry auth token at build time; runtime error reporting needs only the DSN.
export default process.env.SENTRY_AUTH_TOKEN
  ? withSentryConfig(nextConfig, { org: process.env.SENTRY_ORG, project: process.env.SENTRY_PROJECT, silent: !process.env.CI, widenClientFileUpload: true })
  : nextConfig;
