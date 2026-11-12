import { admin } from '@/lib/supabase/admin';
import { getGameState } from '@/lib/server/session';
import { loadInventory } from '@/lib/server/loaders';
import { PageHeader } from '@/components/ui/primitives';
import { InventoryClient } from '@/components/game/InventoryClient';
export const metadata = { title: 'Inventory' };
export default async function InventoryPage() {
  const { p } = await getGameState();
  const inv = await loadInventory(admin(), p);
  return (<><PageHeader title="Inventory" subtitle="Everything you have earned. Gear passively boosts your quests; consumables are one-time boosts." /><InventoryClient items={inv.items} titles={inv.titles} /></>);
}
