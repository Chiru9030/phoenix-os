package com.phoenix.combat.model;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.Map;

public record CombatRequest(
    @NotBlank String characterName,
    @NotBlank String characterClass,
    @Min(1) int level,
    @Min(0) int currentStreak,
    @NotBlank String questType,
    @Min(1) int baseDamage,
    List<String> tags,
    Map<String, Double> characterStats,
    @NotBlank String bossName,
    @Min(1) int bossCurrentHp,
    @Min(1) int bossMaxHp,
    @NotNull String bossDifficulty
) {}
