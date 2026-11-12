import { Award, BadgeCheck, Book, BookOpen, Briefcase, Brain, Code, Cog, Coins, Compass, Crown, Dumbbell, Eye, FlaskConical, Flame, Gem, GitBranch, GraduationCap, Heart, Landmark, Package, Rocket, Scroll, Shield, Skull, Sparkles, Star, Sword, Swords, TrendingUp, Trophy, Users, type LucideIcon } from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  award: Award, 'badge-check': BadgeCheck, badge: BadgeCheck, book: Book, 'book-open': BookOpen, briefcase: Briefcase, brain: Brain, code: Code, cog: Cog, coins: Coins,
  compass: Compass, crown: Crown, dumbbell: Dumbbell, eye: Eye, 'flask-conical': FlaskConical, flask: FlaskConical, flame: Flame, gem: Gem, 'git-branch': GitBranch,
  'graduation-cap': GraduationCap, heart: Heart, landmark: Landmark, package: Package, rocket: Rocket, scroll: Scroll, shield: Shield, skull: Skull, sparkles: Sparkles,
  star: Star, sword: Sword, swords: Swords, 'trending-up': TrendingUp, trophy: Trophy, users: Users,
};
export function GameIcon({ name, className }: { name?: string | null; className?: string }) {
  const Icon = (name && ICONS[name]) || Star;
  return <Icon className={className} aria-hidden />;
}
export const CLASS_ICON: Record<string, string> = { Adventurer: 'compass', Warrior: 'swords', Scholar: 'book-open', Mage: 'sparkles', Rogue: 'eye', Artificer: 'cog' };
