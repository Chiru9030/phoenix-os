import type { RandomEventType } from '@/lib/types';

type Row = { type: RandomEventType | null; w: number };
const WEEKDAY: Row[] = [{ type: null, w: 80 }, { type: 'double_xp', w: 6 }, { type: 'secret_quest', w: 5 }, { type: 'treasure_chest', w: 5 }, { type: 'lucky_spin', w: 3 }, { type: 'hidden_boss', w: 1 }];
const WEEKEND: Row[] = [{ type: null, w: 65 }, { type: 'weekend_festival', w: 15 }, { type: 'double_xp', w: 6 }, { type: 'secret_quest', w: 5 }, { type: 'treasure_chest', w: 5 }, { type: 'lucky_spin', w: 3 }, { type: 'hidden_boss', w: 1 }];

/** Daily roll. `bonusPct` (Visionary skill) moves points of probability out of "nothing happens". */
export function rollDailyEvent(weekend: boolean, bonusPct = 0, rng: () => number = Math.random): RandomEventType | null {
  const base = weekend ? WEEKEND : WEEKDAY;
  const none = base[0].w, shifted = Math.max(0, none - bonusPct), reclaimed = none - shifted;
  const events = base.slice(1), total = events.reduce((s, r) => s + r.w, 0);
  const table: Row[] = [{ type: null, w: shifted }, ...events.map((r) => ({ type: r.type, w: r.w + (reclaimed * r.w) / total }))];
  let roll = rng() * table.reduce((s, r) => s + r.w, 0);
  for (const r of table) { if (roll < r.w) return r.type; roll -= r.w; }
  return null;
}
export const EVENT_TITLES: Record<RandomEventType, string> = {
  double_xp: 'Double XP Day', secret_quest: 'Secret Quest', treasure_chest: 'Treasure Chest', lucky_spin: 'Lucky Spin', hidden_boss: 'Hidden Boss', weekend_festival: 'Weekend Festival',
};
export function describeEvent(t: RandomEventType): { description: string; effect: Record<string, unknown> } {
  switch (t) {
    case 'double_xp': return { description: 'Double XP Day! Every quest you complete today grants twice the experience.', effect: { xp_multiplier: 2 } };
    case 'secret_quest': return { description: 'A Secret Quest has appeared on your board. Finish it before midnight for a rich reward.', effect: { bonus_quest: true } };
    case 'treasure_chest': return { description: 'You stumbled on a Treasure Chest. It creaks open on its own. 75 Gold spills out.', effect: { bonus_gold: 75 } };
    case 'lucky_spin': return { description: 'The Wheel of Fortune has appeared. Spin it once, free of charge.', effect: { spin: true } };
    case 'hidden_boss': return { description: 'A Hidden Boss has emerged from the fog. Defeat it today, or it vanishes at midnight.', effect: { bonus_boss: true } };
    case 'weekend_festival': return { description: 'The Weekend Festival has begun. Gold earned today is worth 50% more.', effect: { gold_multiplier: 1.5 } };
  }
}
export interface SpinPrize { kind: 'gold' | 'xp' | 'item'; amount?: number; itemKey?: string; label: string }
export const SPIN_WHEEL: SpinPrize[] = [
  { kind: 'gold', amount: 25, label: '25 Gold' }, { kind: 'xp', amount: 40, label: '40 XP' }, { kind: 'gold', amount: 60, label: '60 Gold' },
  { kind: 'xp', amount: 90, label: '90 XP' }, { kind: 'item', itemKey: 'gold_pouch', label: 'Gold Pouch' }, { kind: 'item', itemKey: 'knowledge_scroll', label: 'Knowledge Scroll' },
  { kind: 'gold', amount: 150, label: '150 Gold' }, { kind: 'item', itemKey: 'streak_charm', label: 'Streak Charm' },
];
