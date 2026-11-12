import { Check } from 'lucide-react';
import { admin } from '@/lib/supabase/admin';
import { getGameState } from '@/lib/server/session';
import { loadAchievements } from '@/lib/server/loaders';
import { Badge, Bar, PageHeader } from '@/components/ui/primitives';
import { GameIcon } from '@/components/game/icons';
import { cn } from '@/lib/utils';
export const metadata = { title: 'Achievements' };
export default async function AchievementsPage() {
  const { p } = await getGameState();
  const list = await loadAchievements(admin(), p);
  const got = list.filter((a) => a.unlockedAt).length;
  return (
    <>
      <PageHeader title="Achievements" subtitle="Long-term goals with badges, titles and loot." actions={<Badge tone="gold" className="num text-sm">{got} / {list.length} unlocked</Badge>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((a) => (
          <article key={a.id} className={cn('card flex flex-col gap-3 p-5', !a.unlockedAt && 'opacity-80')}>
            <div className="flex items-start gap-3"><div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2', a.unlockedAt ? 'border-gold bg-gold/15 text-gold-bright' : 'border-hairline text-parchment-dim')}>{a.unlockedAt ? <GameIcon name={a.icon} className="h-5 w-5" /> : <GameIcon name={a.icon} className="h-5 w-5 grayscale" />}</div>
              <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h3 className="font-display font-semibold leading-tight">{a.name}</h3>{a.unlockedAt && <Check className="h-4 w-4 text-sage-bright" aria-label="Unlocked" />}</div><p className="mt-0.5 text-sm text-parchment-muted">{a.description}</p></div></div>
            {a.unlockedAt ? <p className="text-xs text-parchment-dim">Unlocked {new Date(a.unlockedAt).toLocaleDateString()}</p> : (<div><div className="mb-1 flex justify-between text-xs"><span className="text-parchment-dim">{a.progress.label}</span><span className="num text-parchment-muted">{Math.min(a.progress.current, a.progress.target)}/{a.progress.target}</span></div><Bar value={a.progress.current} max={a.progress.target} tone="arcane" label={a.name} className="h-1.5" /></div>)}
            {(a.reward_xp > 0 || a.reward_gold > 0 || a.reward_item_key || a.reward_title_key) && <p className="num mt-auto text-xs text-gold-bright/90">Reward: {[a.reward_xp ? `${a.reward_xp} XP` : '', a.reward_gold ? `${a.reward_gold} Gold` : '', a.reward_item_key ? 'item' : '', a.reward_title_key ? 'title' : ''].filter(Boolean).join(' · ')}</p>}
          </article>
        ))}
      </div>
    </>
  );
}
