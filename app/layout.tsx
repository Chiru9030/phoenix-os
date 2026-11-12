import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/fraunces';
import '@fontsource-variable/manrope';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
import './globals.css';
import { PostHogProvider } from '@/components/layout/PostHogProvider';

export const metadata: Metadata = {
  title: { default: 'Phoenix OS · Your life as an RPG', template: '%s · Phoenix OS' },
  description: 'An AI Dungeon Master turns your real goals into quests. Finish tasks, earn XP and Gold, level up your character.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  icons: { icon: '/icon.svg' },
};
export const viewport: Viewport = { themeColor: '#100f17', width: 'device-width', initialScale: 1 };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en" data-scroll-behavior="smooth"><body>{children}<PostHogProvider /></body></html>);
}
