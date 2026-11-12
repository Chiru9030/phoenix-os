import { Crown } from 'lucide-react';
import { admin } from '@/lib/supabase/admin';
import { getGameState } from '@/lib/server/session';
import { leaderboards } from '@/lib/server/social';
import { Empty, PageHeader } from '@/components/ui/primitives';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Leaderboard' };
const MEDAL = ['text-gold-bright', 'text-parchment', 'text-[#c98b57]'];
function Row({ rank, name, sub, value, unit, me }: { rank: number; name: string; sub?: string; value: number; unit: string; me?: boolean }) {
  return (
    <li className={cn('flex items-center gap-4 rounded-xl border px-4 py-3', me ? 'border-gold-dim bg-gold/10' : 'border-hairline bg-surface')}>
      <span className={cn('num flex w-8 justify-center font-display text-lg font-semibold', MEDAL[rank - 1] ?? 'text-parchment-dim')}>{rank <= 3 ? <Crown className="h-5 w-5" aria-label={`Rank ${rank}`} /> : rank}</span>
      <div className="min-w-0 flex-1"><p className="truncate font-semibold">{name}{me && <span className="ml-2 text-xs text-gold">(you)</span>}</p>{sub && <p className="truncate text-xs text-parchment-dim">{sub}</p>}</div>
      <p className="num text-right text-sm"><span className="font-semibold text-gold-bright">{value.toLocaleString()}</span> <span className="text-parchment-dim">{unit}</span></p>
    </li>
  );
}
export default async function LeaderboardPage() {
  const { p } = await getGameState();
  const lb = await leaderboards(admin());
  const me = p.character.id;
  return (
    <>
      <PageHeader title="Leaderboard" subtitle="Friendly competition. Rankings use XP earned, so consistency beats grinding one big day." />
      <Tabs defaultValue="weekly">
        <TabsList aria-label="Leaderboards"><TabsTrigger value="weekly">This week</TabsTrigger><TabsTrigger value="global">All time</TabsTrigger><TabsTrigger value="guilds">Guilds</TabsTrigger></TabsList>
        <TabsContent value="weekly">{lb.weekly.length === 0 ? <Empty title="No XP earned this week yet">Complete a quest and you will be the first on the board.</Empty> : <ol className="space-y-2">{lb.weekly.map((r) => <Row key={r.character_id} rank={r.rank} name={r.name} sub={`Level ${r.level}${r.guild_name ? ` · ${r.guild_name}` : ''}`} value={r.weekly_xp} unit="XP" me={r.character_id === me} />)}</ol>}</TabsContent>
        <TabsContent value="global">{lb.global.length === 0 ? <Empty title="No adventurers yet" /> : <ol className="space-y-2">{lb.global.map((r) => <Row key={r.character_id} rank={r.rank} name={r.name} sub={`Level ${r.level}${r.guild_name ? ` · ${r.guild_name}` : ''}`} value={r.lifetime_xp} unit="XP" me={r.character_id === me} />)}</ol>}</TabsContent>
        <TabsContent value="guilds">{lb.guilds.length === 0 ? <Empty title="No guilds yet">Found the first one on the Guild page.</Empty> : <ol className="space-y-2">{lb.guilds.map((g) => <Row key={g.guild_id} rank={g.rank} name={g.guild_name} sub={`${g.member_count} member${g.member_count === 1 ? '' : 's'} · combined level ${g.total_level}`} value={g.total_xp} unit="XP" />)}</ol>}</TabsContent>
      </Tabs>
    </>
  );
}
