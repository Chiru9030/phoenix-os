import { admin } from '@/lib/supabase/admin';
import { getGameState } from '@/lib/server/session';
import { loadStory } from '@/lib/server/loaders';
import { Empty, PageHeader } from '@/components/ui/primitives';
import { StoryBook } from '@/components/game/StoryBook';
export const metadata = { title: 'Story Mode' };
export default async function StoryPage() {
  const { p } = await getGameState();
  const s = await loadStory(admin(), p);
  return (
    <>
      <PageHeader title="Story Mode" subtitle="Instead of counting days, you live a story. Chapters open when you earn them." />
      {s.chapters.length === 0 ? <Empty title="No story yet">Choose a campaign to begin.</Empty> : <StoryBook chapters={s.chapters.map((c) => ({ id: c.id, chapter_number: c.chapter_number, title: c.title, narrative: c.narrative, status: c.status, reward_gold: c.reward_gold, reward_item_key: c.reward_item_key, objective: c.objective ? { label: c.objective.label, current: c.objective.current, target: c.objective.target } : null }))} npcs={s.npcs} campaignName={p.campaign?.name ?? ''} initialId={s.current?.id ?? null} />}
    </>
  );
}
