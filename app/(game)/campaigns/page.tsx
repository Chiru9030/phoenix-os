import { admin } from '@/lib/supabase/admin';
import { getGameState } from '@/lib/server/session';
import { must } from '@/lib/server/util';
import { PageHeader } from '@/components/ui/primitives';
import { CampaignPicker, type CampaignLite } from '@/components/game/CampaignPicker';
export const metadata = { title: 'Campaigns' };
export default async function CampaignsPage() {
  const { p } = await getGameState();
  const db = admin();
  const [campaigns, chapters, progress] = await Promise.all([
    must<{ id: string; slug: string; name: string; description: string | null; icon: string | null }[]>(db.from('campaigns').select('id,slug,name,description,icon')),
    must<{ id: string; campaign_id: string }[]>(db.from('story_chapters').select('id,campaign_id')),
    must<{ chapter_id: string; status: string }[]>(db.from('character_story_progress').select('chapter_id,status').eq('character_id', p.character.id).neq('status', 'locked')),
  ]);
  const opened = new Set(progress.map((x) => x.chapter_id));
  const order = ['general', 'fitness', 'placement', 'startup', 'upsc', 'exam'];
  const list: CampaignLite[] = campaigns.sort((a, b) => order.indexOf(a.slug) - order.indexOf(b.slug)).map((c) => { const ch = chapters.filter((x) => x.campaign_id === c.id); return { slug: c.slug, name: c.name, description: c.description, icon: c.icon, chapters: ch.length, reached: ch.filter((x) => opened.has(x.id)).length }; });
  return (<><PageHeader title="Campaigns" subtitle="A campaign is a long-term path with its own quests, story, NPCs and bosses. Switching never loses progress." /><CampaignPicker campaigns={list} active={p.campaign?.slug ?? null} /></>);
}
