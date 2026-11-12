import { BookOpen, Backpack, ChartColumn, Coins, LayoutDashboard, ListChecks, Map as MapIcon, Medal, MessageCircle, Network, Scroll, Settings, Shield, Trophy, User, Users, type LucideIcon } from 'lucide-react';
export interface NavItem { href: string; label: string; icon: LucideIcon }
export const NAV: { group: string; items: NavItem[] }[] = [
  { group: 'Play', items: [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }, { href: '/quests', label: 'Quest Board', icon: Scroll }, { href: '/tasks', label: 'Goals & Habits', icon: ListChecks }] },
  { group: 'Hero', items: [{ href: '/character', label: 'Character', icon: User }, { href: '/skills', label: 'Skill Tree', icon: Network }, { href: '/inventory', label: 'Inventory', icon: Backpack }, { href: '/achievements', label: 'Achievements', icon: Trophy }] },
  { group: 'World', items: [{ href: '/story', label: 'Story Mode', icon: BookOpen }, { href: '/campaigns', label: 'Campaigns', icon: MapIcon }, { href: '/rewards', label: 'Rewards Shop', icon: Coins }] },
  { group: 'Insight', items: [{ href: '/reports', label: 'Weekly Reports', icon: ChartColumn }, { href: '/coach', label: 'AI Coach', icon: MessageCircle }] },
  { group: 'Social', items: [{ href: '/guild', label: 'Guild', icon: Shield }, { href: '/friends', label: 'Friends & Duels', icon: Users }, { href: '/leaderboard', label: 'Leaderboard', icon: Medal }] },
  { group: 'Account', items: [{ href: '/settings', label: 'Settings', icon: Settings }] },
];
export const MOBILE_TABS: NavItem[] = [NAV[0].items[0], NAV[0].items[1], NAV[1].items[0], NAV[2].items[0]];
