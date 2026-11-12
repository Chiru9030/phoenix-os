import Link from 'next/link';
import { Coins, Flame } from 'lucide-react';
import { CharacterCrest } from '@/components/game/CharacterCrest';
import { Bar } from '@/components/ui/primitives';
import type { PlayerView } from '@/lib/server/view';
import { SideNav, BottomTabs } from './NavLinks';
import { MobileMenu } from './MobileMenu';
import { NotificationsBell, type Notif } from './NotificationsBell';

export function Logo() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5 px-3">
      <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden><polygon points="16,2 28,9 28,23 16,30 4,23 4,9" fill="#1b1826" stroke="#d4a94e" strokeWidth="1.6" /><path d="M16 8c2 3 4 4.5 4 8a4 4 0 0 1-8 0c0-1.6.7-2.7 1.6-3.8.2 1.2.9 1.9 1.6 2.1C15 12.5 15 10 16 8z" fill="#f0c869" /></svg>
      <span className="font-display text-lg font-semibold tracking-tight">Phoenix <span className="text-gold">OS</span></span>
    </Link>
  );
}

export function AppShell({ view, notifications, children }: { view: PlayerView; notifications: Notif[]; children: React.ReactNode }) {
  const s = view.streak;
  const streakTone = s.state === 'safe' ? 'text-gold-bright' : s.state === 'at_risk' ? 'text-ember-bright' : 'text-parchment-dim';
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[17rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 overflow-y-auto border-r border-hairline bg-ink-soft/70 px-3 py-5 md:flex">
        <Logo />
        <SideNav />
        <p className="mt-auto px-3 text-[11px] leading-relaxed text-parchment-dim">Real life is the game. <br />Every finished task is XP.</p>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-hairline bg-ink/85 backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 md:px-8">
            <MobileMenu />
            <Link href="/character" className="flex items-center gap-3" aria-label="Open character sheet">
              <CharacterCrest level={view.level} progress={(view.currentXp / view.xpToNext) * 100} characterClass={view.characterClass} size={52} />
              <div className="hidden min-w-0 sm:block"><p className="truncate font-display text-sm font-semibold leading-tight">{view.name}</p><p className="text-[11px] text-parchment-dim">Lv <span className="num">{view.level}</span> {view.characterClass}</p></div>
            </Link>
            <div className="mx-1 min-w-0 flex-1 md:mx-4">
              <div className="mb-1 flex justify-between text-[11px] text-parchment-dim"><span>XP</span><span className="num hidden sm:inline">{view.currentXp} / {view.xpToNext}</span></div>
              <Bar value={view.currentXp} max={view.xpToNext} label="Experience to next level" />
            </div>
            <div className="flex items-center gap-1.5 sm:gap-3">
              <span className="num flex items-center gap-1 rounded-lg border border-hairline bg-surface px-2.5 py-1.5 text-sm font-semibold text-gold-bright" title="Gold"><Coins className="h-4 w-4" aria-hidden />{view.gold}</span>
              <span className={`num flex items-center gap-1 rounded-lg border border-hairline bg-surface px-2.5 py-1.5 text-sm font-semibold ${streakTone}`} title={s.state === 'at_risk' ? 'Finish one quest today to keep your streak alive' : `Streak: ${s.current} days (best ${s.longest}). Freezes: ${s.freezeTokens}`}>
                <Flame className={`h-4 w-4 ${s.state === 'at_risk' ? 'animate-pulse' : ''}`} aria-hidden />{s.current}
              </span>
              <NotificationsBell items={notifications} />
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 md:px-8 md:pb-12">{children}</main>
      </div>
      <BottomTabs />
    </div>
  );
}
