import type { Criteria, CriteriaContext } from '@/lib/types';
import { STAT_LABELS } from '@/lib/types';

export interface CriteriaProgress { met: boolean; current: number; target: number; label: string }
/** Evaluates achievement / story-unlock criteria and reports progress for UI bars. */
export function criteriaProgress(c: Criteria, x: CriteriaContext): CriteriaProgress {
  switch (c.type) {
    case 'always': return { met: true, current: 1, target: 1, label: 'Always open' };
    case 'quest_completed_count': {
      const cur = c.tag ? x.questsByTag[c.tag] ?? 0 : x.totalQuestsCompleted;
      return { met: cur >= c.value, current: cur, target: c.value, label: `Complete ${c.value} ${c.tag ? c.tag.replace(/_/g, ' ') + ' ' : ''}quests` };
    }
    case 'streak': { const cur = Math.max(x.currentStreak, x.longestStreak); return { met: cur >= c.value, current: cur, target: c.value, label: `Reach a ${c.value}-day streak` }; }
    case 'stat_threshold': { const cur = Math.floor(x.stats[c.stat] ?? 0); return { met: cur >= c.value, current: cur, target: c.value, label: `Raise ${STAT_LABELS[c.stat]} to ${c.value}` }; }
    case 'level': return { met: x.level >= c.value, current: x.level, target: c.value, label: `Reach level ${c.value}` };
    case 'boss_defeated_count': return { met: x.bossesDefeated >= c.value, current: x.bossesDefeated, target: c.value, label: `Defeat ${c.value} boss${c.value > 1 ? 'es' : ''}` };
    case 'skill_unlocked_count': return { met: x.skillsUnlocked >= c.value, current: x.skillsUnlocked, target: c.value, label: `Unlock ${c.value} skill${c.value > 1 ? 's' : ''}` };
    case 'guild_member': return { met: x.inGuild, current: x.inGuild ? 1 : 0, target: 1, label: 'Join a guild' };
    default: return { met: false, current: 0, target: 1, label: 'Unknown' };
  }
}
export const isCriteriaMet = (c: Criteria, x: CriteriaContext) => criteriaProgress(c, x).met;
