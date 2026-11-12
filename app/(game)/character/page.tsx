import Link from 'next/link';
import { admin } from '@/lib/supabase/admin';
import { getGameState } from '@/lib/server/session';
import { loadInventory } from '@/lib/server/loaders';
import { Badge, Bar, Card, CardBody, CardHeader, CardTitle, PageHeader } from '@/components/ui/primitives';
import { CharacterCrest } from '@/components/game/CharacterCrest';
import { StatRadar } from '@/components/game/StatRadar';
import { GameIcon } from '@/components/game/icons';
import { CLASSES } from '@/lib/game/classes';
import { crestTier } from '@/lib/game/xp';
import { STAT_LABELS, STAT_NAMES } from '@/lib/types';

export const metadata = { title: 'Character' };
const SLOTS = [{ k: 'weapon', n: 'Weapon' }, { k: 'shield', n: 'Shield' }, { k: 'tome', n: 'Tome' }, { k: 'badge', n: 'Badge' }];
const TIER = { 1: 'Bronze crest', 2: 'Runic crest', 3: 'Gilded crest' } as const;
export default async function CharacterPage() {
  const { p, view } = await getGameState();
  const inv = await loadInventory(admin(), p);
  const title = inv.titles.find((t) => t.equipped), cls = CLASSES.find((c) => c.name === p.character.character_class);
  const max = Math.max(10, ...STAT_NAMES.map((s) => p.stats[s]));
  const sorted = [...STAT_NAMES].sort((a, b) => p.stats[b] - p.stats[a]);
  return (
    <>
      <PageHeader title="Character" subtitle="Your crest earns detail as you level: bronze, then runic, then gilded." />
      <div className="grid gap-5 lg:grid-cols-[22rem_1fr]">
        <Card className="flex flex-col items-center p-7 text-center">
          <CharacterCrest level={view.level} progress={(view.currentXp / view.xpToNext) * 100} characterClass={view.characterClass} size={220} />
          <h2 className="mt-4 font-display text-2xl font-semibold">{view.name}</h2>
          {title && <p className="mt-0.5 font-display italic text-gold-bright">{title.name}</p>}
          <p className="label-caps mt-1">Level {view.level} {view.characterClass}</p>
          <div className="mt-5 w-full"><div className="mb-1 flex justify-between text-xs text-parchment-muted"><span>To level {view.level + 1}</span><span className="num">{view.currentXp} / {view.xpToNext} XP</span></div><Bar value={view.currentXp} max={view.xpToNext} label="Experience to next level" /></div>
          <dl className="mt-5 grid w-full grid-cols-2 gap-3 text-left text-sm"><div><dt className="label-caps">Lifetime XP</dt><dd className="num text-lg text-gold-bright">{view.lifetimeXp.toLocaleString()}</dd></div><div><dt className="label-caps">Skill points</dt><dd className="num text-lg text-arcane-bright">{view.skillPoints}</dd></div><div><dt className="label-caps">Campaign</dt><dd className="text-parchment-muted">{view.campaign?.name}</dd></div><div><dt className="label-caps">Crest</dt><dd className="text-parchment-muted">{TIER[crestTier(view.level)]}</dd></div></dl>
          {cls && <p className="mt-4 text-xs italic text-parchment-dim">{cls.blurb}</p>}
        </Card>
        <div className="space-y-5">
          <Card><CardHeader><CardTitle>Attributes</CardTitle><Badge>{STAT_NAMES.length} stats</Badge></CardHeader>
            <CardBody className="grid gap-4 md:grid-cols-2"><StatRadar stats={p.stats} height={300} />
              <ul className="space-y-2.5 self-center">{sorted.map((s) => (<li key={s}><div className="mb-1 flex justify-between text-sm"><span className="text-parchment-muted">{STAT_LABELS[s]}</span><span className="num font-semibold">{Math.floor(p.stats[s])}</span></div><Bar value={p.stats[s]} max={max} tone={p.character.focus_stats.includes(s) ? 'gold' : 'arcane'} label={STAT_LABELS[s]} className="h-1.5" /></li>))}</ul></CardBody></Card>
          <Card><CardHeader><CardTitle>Equipment</CardTitle><Link href="/inventory" className="text-xs font-semibold text-gold hover:text-gold-bright">Manage</Link></CardHeader>
            <CardBody className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{SLOTS.map(({ k, n }) => { const it = inv.items.find((i) => i.equipped && i.slot === k); return (
              <div key={k} className={`rounded-xl border p-3 text-center ${it ? 'border-gold-dim bg-gold/5' : 'border-dashed border-hairline'}`}><p className="label-caps">{n}</p><div className="my-2 flex justify-center"><GameIcon name={it?.icon ?? 'package'} className={`h-7 w-7 ${it ? 'text-gold-bright' : 'text-parchment-dim'}`} /></div><p className="text-sm font-semibold">{it?.name ?? 'Empty'}</p></div>); })}</CardBody></Card>
          <p className="text-xs text-parchment-dim">Gold-bar stats are your focus stats. Change them in <Link href="/settings" className="text-gold hover:text-gold-bright">Settings</Link>.</p>
        </div>
      </div>
    </>
  );
}
