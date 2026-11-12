'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { NAV, MOBILE_TABS } from './nav';

export function SideNav({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="space-y-5">
      {NAV.map((g) => (
        <div key={g.group}>
          <p className="label-caps mb-1.5 px-3">{g.group}</p>
          <ul className="space-y-0.5">
            {g.items.map(({ href, label, icon: Icon }) => {
              const active = path === href || path.startsWith(href + '/');
              return (
                <li key={href}>
                  <Link href={href} onClick={onNavigate} aria-current={active ? 'page' : undefined}
                    className={cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors', active ? 'bg-surface-raised text-gold-bright shadow-[inset_2px_0_0_0_#d4a94e]' : 'text-parchment-muted hover:bg-surface hover:text-parchment')}>
                    <Icon className="h-4 w-4" aria-hidden />{label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
export function BottomTabs() {
  const path = usePathname();
  return (
    <nav aria-label="Quick" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-hairline bg-ink-soft/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      {MOBILE_TABS.map(({ href, label, icon: Icon }) => {
        const active = path === href || path.startsWith(href + '/');
        return (
          <Link key={href} href={href} aria-current={active ? 'page' : undefined} className={cn('flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold', active ? 'text-gold-bright' : 'text-parchment-dim')}>
            <Icon className="h-5 w-5" aria-hidden />{label.split(' ')[0]}
          </Link>
        );
      })}
    </nav>
  );
}
