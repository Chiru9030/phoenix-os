import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyXpGain, xpToClearLevel, skillPointsForLevelUp, crestTier } from '@/lib/game/xp';
import { todayInTz, isWeekend, weekStartMonday, addDays, dayName, daysBetween } from '@/lib/game/dates';
import { updateStreakOnActivity, streakStatus, regenFreezeToken } from '@/lib/game/streaks';
import { computeBaseRewards, inferTags, normalizeTags } from '@/lib/game/rewards';
import { aggregateEffects, finalizeRewards, emptyEffects } from '@/lib/game/effects';
import { criteriaProgress } from '@/lib/game/criteria';
import { rollDailyEvent } from '@/lib/game/events';
import { maxHpFor, nextBossDifficulty, damageForQuest, bossRewards } from '@/lib/game/bosses';
import { canUnlockSkill } from '@/lib/game/skills';
import { discountedCost } from '@/lib/game/economy';
import { EMPTY_STATS, type CriteriaContext } from '@/lib/types';

test('xp curve and multi-level rollover', () => {
  assert.equal(xpToClearLevel(1), 80);
  const r = applyXpGain(1, 0, 80);
  assert.deepEqual([r.newLevel, r.newCurrentXp, r.levelsGained], [2, 0, 1]);
  const big = applyXpGain(1, 10, 1000); // crosses several thresholds
  assert.ok(big.levelsGained >= 3 && big.newLevel === 1 + big.levelsGained);
  assert.ok(big.newCurrentXp < big.xpToNext);
  assert.equal(applyXpGain(3, 5, -50).newCurrentXp, 5); // negative XP can never subtract
  assert.equal(skillPointsForLevelUp(4, 6), 3); // L5 = 1+1 bonus, L6 = 1
  assert.deepEqual([crestTier(9), crestTier(10), crestTier(25)], [1, 2, 3]);
});

test('level pacing sanity: ~250 XP/day gets level 10 in ~4 weeks, level 25 in ~8 months', () => {
  let need = 0; for (let l = 1; l < 10; l++) need += xpToClearLevel(l);
  const d10 = need / 250; assert.ok(d10 > 14 && d10 < 40, `level 10 in ${d10.toFixed(0)} days`);
  need = 0; for (let l = 1; l < 25; l++) need += xpToClearLevel(l);
  const d25 = need / 250; assert.ok(d25 > 150 && d25 < 330, `level 25 in ${d25.toFixed(0)} days`);
});

test('timezone-aware dates', () => {
  const t = new Date('2026-10-28T20:00:00Z');
  assert.equal(todayInTz('Asia/Kolkata', t), '2026-10-29'); // 01:30 IST next day
  assert.equal(todayInTz('America/Los_Angeles', t), '2026-10-28');
  assert.equal(todayInTz('Not/AZone', t), '2026-10-28'); // falls back to UTC, never throws
  assert.equal(dayName('2026-10-28'), 'Wednesday');
  assert.equal(weekStartMonday('2026-10-28'), '2026-10-26');
  assert.equal(weekStartMonday('2026-11-01'), '2026-10-26'); // Sunday belongs to the Monday-started week
  assert.ok(isWeekend('2026-10-31') && !isWeekend('2026-10-28'));
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(daysBetween('2026-10-01', '2026-10-28'), 27);
});

test('streak logic: continue, idempotent, freeze, break', () => {
  assert.equal(updateStreakOnActivity('2026-10-28', null, 0, 0, 1).currentStreak, 1);
  const cont = updateStreakOnActivity('2026-10-28', '2026-10-27', 4, 4, 1);
  assert.deepEqual([cont.currentStreak, cont.longestStreak, cont.freezeUsed], [5, 5, false]);
  const same = updateStreakOnActivity('2026-10-28', '2026-10-28', 5, 9, 1);
  assert.deepEqual([same.currentStreak, same.freezeTokens], [5, 1]);
  const frozen = updateStreakOnActivity('2026-10-28', '2026-10-26', 5, 5, 1); // missed exactly one day
  assert.deepEqual([frozen.currentStreak, frozen.freezeTokens, frozen.freezeUsed, frozen.broken], [6, 0, true, false]);
  const noFreeze = updateStreakOnActivity('2026-10-28', '2026-10-26', 5, 8, 0);
  assert.deepEqual([noFreeze.currentStreak, noFreeze.longestStreak, noFreeze.broken], [1, 8, true]);
  assert.equal(updateStreakOnActivity('2026-10-28', '2026-10-20', 12, 12, 3).broken, true); // a long gap beats any freeze
  assert.equal(streakStatus('2026-10-28', '2026-10-28', 5, 0).state, 'safe');
  assert.equal(streakStatus('2026-10-28', '2026-10-27', 5, 0).state, 'at_risk');
  assert.deepEqual(streakStatus('2026-10-28', '2026-10-20', 5, 0), { state: 'broken', display: 0 });
  assert.equal(regenFreezeToken(7, 1), 2); assert.equal(regenFreezeToken(7, 3), 3); assert.equal(regenFreezeToken(6, 1), 1);
  assert.equal(regenFreezeToken(4, 1, 2), 2); // Unshakeable: every ~3.5 days
});

test('base rewards follow the spec XP table', () => {
  const gym = computeBaseRewards({ type: 'side', tags: ['gym'], level: 1, difficulty: 'normal' });
  assert.deepEqual([gym.xp, gym.gold, gym.stats.strength, gym.stats.health], [50, 20, 2, 1]);
  assert.equal(computeBaseRewards({ type: 'side', tags: ['deep_work'], level: 1, difficulty: 'normal' }).xp, 80);
  assert.equal(computeBaseRewards({ type: 'side', tags: ['meditation'], level: 1, difficulty: 'normal' }).xp, 15);
  assert.equal(computeBaseRewards({ type: 'side', tags: ['wake_up_early'], level: 1, difficulty: 'normal' }).xp, 20);
  assert.equal(computeBaseRewards({ type: 'main', tags: ['deep_work'], level: 1, difficulty: 'normal' }).xp, 100); // main ×1.25
  assert.equal(computeBaseRewards({ type: 'boss_fight', tags: [], level: 1, difficulty: 'normal' }).xp, 375);
  assert.equal(computeBaseRewards({ type: 'side', tags: ['gym'], level: 11, difficulty: 'normal' }).xp, 60); // +20% at level 11
  assert.equal(computeBaseRewards({ type: 'side', tags: ['gym'], level: 99, difficulty: 'hardcore' }).xp, Math.round(50 * 1.4 * 1.15)); // level bonus capped at +40%
  assert.ok(Object.keys(computeBaseRewards({ type: 'side', tags: [], level: 1, difficulty: 'normal' }).stats).length > 0); // untagged still grows something
});

test('tag inference and normalisation', () => {
  assert.ok(inferTags('Hit the gym and lift').includes('gym'));
  assert.ok(inferTags('Read 20 pages of my book').includes('reading'));
  assert.ok(inferTags('Solve 2 LeetCode problems').includes('coding_practice'));
  assert.ok(inferTags('Drink 4L water').includes('hydration'));
  assert.ok(!inferTags('I am tired').includes('morning')); // the bare word "am" must not trigger "morning"
  assert.deepEqual(normalizeTags(['GYM', 'Deep Work', 'nonsense', 'gym']), ['gym', 'deep_work']);
  assert.deepEqual(normalizeTags('not-an-array'), []);
});

test('skill + gear effects stack correctly and never break the economy', () => {
  const fx = aggregateEffects([
    { effect: { quest_type_xp_bonus_pct: { main: 10 } } }, { effect: { quest_tag_xp_bonus_pct: { reading: 10 } } },
    { effect: { stat_bonus_pct: { wisdom: 10 } } }, { effect: { boss_xp_bonus_pct: 20 } }, { effect: { weekend_gold_multiplier: 2 } },
  ]);
  const base = computeBaseRewards({ type: 'main', tags: ['reading'], level: 1, difficulty: 'normal' }); // 25*1.25 = 31
  const plain = finalizeRewards(base, { type: 'main', tags: ['reading'], doubleXp: false }, fx, { festival: false });
  assert.equal(plain.xp, Math.round(base.xp * 1.2));
  assert.equal(plain.stats.wisdom, Math.round(base.stats.wisdom! * 1.1 * 100) / 100); // fractional stat keeps the 10%
  const dbl = finalizeRewards(base, { type: 'main', tags: ['reading'], doubleXp: true }, fx, { festival: true });
  assert.equal(dbl.xp, Math.round(base.xp * 1.2 * 2));
  assert.equal(dbl.gold, Math.round(base.gold * 2)); // festival 1.5 → doubled bonus (Tycoon) = ×2
  const boss = finalizeRewards({ xp: 100, gold: 40, stats: {} }, { type: 'boss_fight', tags: [], doubleXp: false }, fx, { festival: false });
  assert.equal(boss.xp, 120);
  const none = finalizeRewards(base, { type: 'main', tags: ['reading'], doubleXp: false }, emptyEffects(), { festival: false });
  assert.deepEqual([none.xp, none.gold, none.bonuses.length], [base.xp, base.gold, 0]);
});

const ctx = (o: Partial<CriteriaContext> = {}): CriteriaContext => ({ level: 1, stats: { ...EMPTY_STATS }, currentStreak: 0, longestStreak: 0, totalQuestsCompleted: 0, questsByTag: {}, bossesDefeated: 0, skillsUnlocked: 0, inGuild: false, ...o });
test('achievement / story criteria', () => {
  assert.equal(criteriaProgress({ type: 'always' }, ctx()).met, true);
  assert.deepEqual(criteriaProgress({ type: 'quest_completed_count', value: 100, tag: 'gym' }, ctx({ questsByTag: { gym: 42 } })), { met: false, current: 42, target: 100, label: 'Complete 100 gym quests' });
  assert.equal(criteriaProgress({ type: 'quest_completed_count', value: 1 }, ctx({ totalQuestsCompleted: 1 })).met, true);
  assert.equal(criteriaProgress({ type: 'streak', value: 30 }, ctx({ currentStreak: 3, longestStreak: 31 })).met, true); // longest streak counts
  assert.equal(criteriaProgress({ type: 'stat_threshold', stat: 'coding_skill', value: 60 }, ctx({ stats: { ...EMPTY_STATS, coding_skill: 59.99 } })).met, false);
  assert.equal(criteriaProgress({ type: 'level', value: 25 }, ctx({ level: 25 })).met, true);
  assert.equal(criteriaProgress({ type: 'guild_member', value: 1 }, ctx({ inGuild: true })).met, true);
});

test('random events: weights, determinism and the Visionary bonus', () => {
  assert.equal(rollDailyEvent(false, 0, () => 0), null);
  assert.equal(rollDailyEvent(false, 0, () => 0.81), 'double_xp');
  assert.equal(rollDailyEvent(false, 0, () => 0.999), 'hidden_boss');
  assert.equal(rollDailyEvent(true, 0, () => 0.7), 'weekend_festival');
  assert.notEqual(rollDailyEvent(false, 0, () => 0.7), 'weekend_festival'); // festivals are weekend-only
  let seed = 12345; const rng = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const rate = (bonus: number) => { let n = 0; for (let i = 0; i < 40000; i++) if (rollDailyEvent(false, bonus, rng)) n++; return n / 40000; };
  const base = rate(0), boosted = rate(10);
  assert.ok(Math.abs(base - 0.2) < 0.015, `base event rate ${base}`);
  assert.ok(Math.abs(boosted - 0.3) < 0.015, `boosted event rate ${boosted}`);
});

test('boss maths', () => {
  assert.equal(maxHpFor(1, 'normal'), 960);
  assert.equal(maxHpFor(10, 'legendary'), Math.round(1500 * 2.6));
  assert.deepEqual([nextBossDifficulty(1, 0), nextBossDifficulty(4, 1), nextBossDifficulty(8, 2), nextBossDifficulty(1, 7)], ['normal', 'hard', 'very_hard', 'legendary']);
  assert.equal(damageForQuest(100, 'boss_fight'), 200); assert.equal(damageForQuest(100, 'side'), 100);
  assert.deepEqual(bossRewards(1000, 'legendary'), { xp: 250, gold: 120, itemKey: 'golden_badge' });
  assert.equal(bossRewards(1000, 'normal').itemKey, null);
});

test('skill unlock rules + economy', () => {
  const n1 = { id: 'a', cost: 1, prerequisite_node_id: null }, n2 = { id: 'b', cost: 2, prerequisite_node_id: 'a' };
  assert.equal(canUnlockSkill(n1, new Set(), 1).ok, true);
  assert.equal(canUnlockSkill(n1, new Set(), 0).ok, false);
  assert.equal(canUnlockSkill(n2, new Set(), 5).reason, 'Unlock the previous tier first');
  assert.equal(canUnlockSkill(n2, new Set(['a']), 1).ok, false);
  assert.equal(canUnlockSkill(n2, new Set(['a']), 2).ok, true);
  assert.equal(canUnlockSkill(n1, new Set(['a']), 9).reason, 'Already unlocked');
  assert.equal(discountedCost(1000, 10), 900); assert.equal(discountedCost(1000, 999), 500); assert.equal(discountedCost(1000, -5), 1000);
});
