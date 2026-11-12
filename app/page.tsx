import Link from 'next/link';
import { Brain, Coins, Flame, Network, ScrollText, Shield, Skull, Sparkles, Swords, Users } from 'lucide-react';
import { CharacterCrest } from '@/components/game/CharacterCrest';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/layout/AppShell';
import { supabaseConfigured } from '@/lib/env';
import { currentUser } from '@/lib/server/session';

export const dynamic = 'force-dynamic';
const FEATURES = [
  { icon: Brain, title: 'An AI Dungeon Master', body: 'It reads your goals, habits and stats, then writes a fresh quest board every morning. No two days are the same.' },
  { icon: ScrollText, title: 'Quests, not checklists', body: '"Study 2 hours" becomes a Main Quest. "Finish the DB assignment" becomes a Boss Fight. Your real tasks, with a story around them.' },
  { icon: Swords, title: 'Bosses & random events', body: 'A new boss arrives every week. Double XP days, treasure chests and lucky spins keep tomorrow worth opening.' },
  { icon: Network, title: 'Skill tree & gear', body: 'Spend skill points on seven branches. Earn gear that gives real bonuses. Build the character you want to become.' },
  { icon: Coins, title: 'Gold you can spend', body: 'Turn Gold into real rewards: a movie, a game, new shoes, a weekend trip. You set the prices.' },
  { icon: Users, title: 'Guilds & duels', body: 'Team up on guild quests, climb the leaderboard, or dare a friend to a 7-day XP duel.' },
];
export default async function Landing() {
  const user = supabaseConfigured() ? await currentUser() : null;
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 md:px-8">
        <Logo />
        <nav className="flex items-center gap-2">
          {user ? <Button asChild variant="gold"><Link href="/dashboard">Open your quest board</Link></Button> : (<><Button asChild variant="ghost"><Link href="/login">Sign in</Link></Button><Button asChild variant="gold"><Link href="/signup">Start your adventure</Link></Button></>)}
        </nav>
      </header>
      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-20 pt-10 md:grid-cols-[1.2fr_1fr] md:px-8 md:pt-16">
          <div>
            <p className="label-caps text-gold">An AI-powered life RPG</p>
            <h1 className="mt-4 font-display text-5xl font-semibold leading-[1.05] tracking-tight md:text-6xl">Your life is the game.<br /><span className="text-gold">Your AI is the Dungeon Master.</span></h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-parchment-muted">Most productivity apps track you until you quit. Phoenix turns the real things you need to do into quests, bosses and chapters, so opening the app each morning feels like opening a game.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild variant="gold" size="lg"><Link href={user ? '/dashboard' : '/signup'}>{user ? 'Continue your story' : 'Create your character'}</Link></Button>
              <Button asChild variant="outline" size="lg"><a href="#how">How it works</a></Button>
            </div>
            <p className="mt-4 text-xs text-parchment-dim">Free to play. Works with no AI key; plug one in and the Dungeon Master gets even more creative.</p>
          </div>
          <div className="flex justify-center"><div className="card relative flex flex-col items-center gap-3 px-10 py-9">
            <CharacterCrest level={26} progress={62} characterClass="Artificer" size={220} />
            <p className="font-display text-xl font-semibold">Aria the Relentless</p><p className="label-caps">Level 26 · Phoenix Ascendant</p>
            <div className="mt-1 flex items-center gap-4 text-sm"><span className="num flex items-center gap-1 text-gold-bright"><Flame className="h-4 w-4" aria-hidden />41</span><span className="num flex items-center gap-1 text-gold-bright"><Coins className="h-4 w-4" aria-hidden />2,480</span><span className="num flex items-center gap-1 text-arcane-bright"><Shield className="h-4 w-4" aria-hidden />Guild</span></div>
          </div></div>
        </section>
        <section id="how" className="border-y border-hairline bg-ink-soft/60">
          <div className="mx-auto max-w-6xl px-4 py-16 md:px-8">
            <h2 className="font-display text-3xl font-semibold">Every morning, a new adventure</h2>
            <ol className="mt-8 grid gap-4 md:grid-cols-4">
              {['Tell the Dungeon Master what matters: your goals, habits and campaign.', 'It writes today\'s quests: a main quest, side quests, a daily challenge, and a boss when one is due.', 'Finish real tasks. Earn XP, Gold and stat growth. Your crest levels up.', 'Unlock chapters, skills and gear. Cash Gold in for rewards in the real world.'].map((t, i) => (
                <li key={i} className="card p-5"><span className="num font-display text-3xl font-semibold text-gold">{i + 1}</span><p className="mt-2 text-sm leading-relaxed text-parchment-muted">{t}</p></li>
              ))}
            </ol>
          </div>
        </section>
        <section className="mx-auto max-w-6xl px-4 py-16 md:px-8">
          <h2 className="font-display text-3xl font-semibold">Built to be opened, not just ticked</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }) => (<div key={title} className="card p-5"><Icon className="h-6 w-6 text-gold" aria-hidden /><h3 className="mt-3 font-display text-lg font-semibold">{title}</h3><p className="mt-1 text-sm leading-relaxed text-parchment-muted">{body}</p></div>))}
          </div>
          <div className="mt-12 card flex flex-wrap items-center justify-between gap-4 p-6">
            <div className="flex items-center gap-3"><Sparkles className="h-6 w-6 text-gold" aria-hidden /><p className="font-display text-xl">Ready to become the main character?</p></div>
            <Button asChild variant="gold" size="lg"><Link href={user ? '/dashboard' : '/signup'}>{user ? 'Open dashboard' : 'Begin Chapter I'}</Link></Button>
          </div>
        </section>
      </main>
      <footer className="border-t border-hairline px-4 py-8 text-center text-xs text-parchment-dim">Phoenix OS · Real life is the game. <Skull className="inline h-3 w-3" aria-hidden /> Fear no boss.</footer>
    </div>
  );
}
