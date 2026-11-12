import type { CharacterStats, StatName } from '@/lib/types';
export interface ClassDef { name: string; blurb: string; stats: Partial<CharacterStats> }
/** Cosmetic + a tiny starting nudge so builds feel different from minute one. */
export const CLASSES: ClassDef[] = [
  { name: 'Adventurer', blurb: 'Balanced and curious. Learns a little of everything.', stats: { discipline: 1, wisdom: 1, health: 1 } },
  { name: 'Warrior', blurb: 'Iron habits. Trains the body first.', stats: { strength: 3, health: 2 } },
  { name: 'Scholar', blurb: 'Lives in the library. Trains the mind first.', stats: { intelligence: 3, wisdom: 2 } },
  { name: 'Mage', blurb: 'Quiet focus and creative fire.', stats: { wisdom: 3, creativity: 2 } },
  { name: 'Rogue', blurb: 'Quick, social and persuasive.', stats: { charisma: 3, communication: 2 } },
  { name: 'Artificer', blurb: 'Builds things. Code and craft.', stats: { coding_skill: 3, intelligence: 2 } },
];
export const CLASS_NAMES = CLASSES.map((c) => c.name);
export const classStats = (name: string): Partial<Record<StatName, number>> => CLASSES.find((c) => c.name === name)?.stats ?? {};
