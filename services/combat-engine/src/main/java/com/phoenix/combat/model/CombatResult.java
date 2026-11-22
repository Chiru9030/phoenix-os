package com.phoenix.combat.model;

import java.util.List;

public record CombatResult(
    int damageDealt,
    boolean isCriticalHit,
    double streakMultiplier,
    double classAffinityMultiplier,
    int bossRemainingHp,
    boolean isDefeated,
    int bonusXpAwarded,
    int bonusGoldAwarded,
    List<String> combatLogEvents
) {}
