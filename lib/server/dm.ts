import { getDungeonMaster, type HybridDungeonMaster } from '@/lib/ai/hybrid';
let instance: HybridDungeonMaster | null = null;
/** One Dungeon Master per server process, configured from env (see .env.example). */
export const dungeonMaster = (): HybridDungeonMaster => (instance ??= getDungeonMaster());
