import {
  BookOpen,
  Backpack,
  Coins,
  LayoutDashboard,
  ListChecks,
  Medal,
  MessageCircle,
  Network,
  Scroll,
  Settings,
  Shield,
  User,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: 'Action',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/quests', label: 'Quest Board', icon: Scroll },
      { href: '/tasks', label: 'Goals & Habits', icon: ListChecks },
      { href: '/coach', label: 'AI Companion', icon: MessageCircle },
    ],
  },
  {
    group: 'Hero',
    items: [
      { href: '/character', label: 'Character Sheet', icon: User },
      { href: '/skills', label: 'Skill Tree', icon: Network },
      { href: '/inventory', label: 'Inventory & Gear', icon: Backpack },
    ],
  },
  {
    group: 'World',
    items: [
      { href: '/story', label: 'Story & Lore', icon: BookOpen },
      { href: '/guild', label: 'Guild & Duels', icon: Shield },
      { href: '/leaderboard', label: 'Leaderboard', icon: Medal },
      { href: '/rewards', label: 'Rewards Shop', icon: Coins },
    ],
  },
  {
    group: 'Account',
    items: [
      { href: '/settings', label: 'Settings & AI Keys', icon: Settings },
    ],
  },
];

export const MOBILE_TABS: NavItem[] = [
  NAV[0].items[0], // Dashboard
  NAV[0].items[1], // Quest Board
  NAV[0].items[3], // AI Companion
  NAV[1].items[0], // Character
];
