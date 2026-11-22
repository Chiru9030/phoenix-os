package com.phoenix.combat.service;

import com.phoenix.combat.model.CombatRequest;
import com.phoenix.combat.model.CombatResult;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;

@Service
public class CombatService {

    private final Random rng = new Random();

    public CombatResult simulateStrike(CombatRequest req) {
        List<String> logs = new ArrayList<>();
        logs.add(String.format("%s [Lv %d %s] engages %s (%d/%d HP)",
                req.characterName(), req.level(), req.characterClass(),
                req.bossName(), req.bossCurrentHp(), req.bossMaxHp()));

        // 1. Streak momentum bonus: +3% damage per streak day, up to +45%
        double streakMult = 1.0 + Math.min(0.45, req.currentStreak() * 0.03);
        if (req.currentStreak() > 0) {
            logs.add(String.format("Streak momentum (+%d days): x%.2f damage", req.currentStreak(), streakMult));
        }

        // 2. Class affinity check
        double classMult = 1.0;
        String cls = req.characterClass().toLowerCase();
        if (cls.contains("striker") || cls.contains("warrior")) {
            classMult = 1.20; // Strikers deal +20% boss damage
            logs.add("Striker passive triggered: +20% raw boss damage");
        } else if (cls.contains("artificer")) {
            classMult = 1.10;
        }

        // 3. Quest type weight
        double typeMult = "boss_fight".equalsIgnoreCase(req.questType()) ? 2.5 : 1.0;

        // 4. Critical hit roll (base 10% + discipline/intelligence scaling)
        double critChance = 0.10;
        if (req.characterStats() != null) {
            double discipline = req.characterStats().getOrDefault("discipline", 0.0);
            critChance += Math.min(0.20, discipline * 0.01);
        }
        boolean isCrit = rng.nextDouble() < critChance;
        double critMult = isCrit ? 1.75 : 1.0;
        if (isCrit) {
            logs.add("CRITICAL HIT! Heavy impact dealt x1.75 damage!");
        }

        // Calculate final damage dealt
        int rawDamage = (int) Math.round(req.baseDamage() * typeMult * streakMult * classMult * critMult);
        int finalDamage = Math.max(1, rawDamage);

        int newHp = Math.max(0, req.bossCurrentHp() - finalDamage);
        boolean isDefeated = newHp == 0;

        logs.add(String.format("Dealt %d damage! %s remaining HP: %d/%d",
                finalDamage, req.bossName(), newHp, req.bossMaxHp()));

        int bonusXp = isDefeated ? (int) (req.baseDamage() * 2.5) : 0;
        int bonusGold = isDefeated ? (int) (req.baseDamage() * 1.2) : 0;

        if (isDefeated) {
            logs.add(String.format("VICTORY! %s has been vanquished! Earned +%d XP, +%d Gold",
                    req.bossName(), bonusXp, bonusGold));
        }

        return new CombatResult(
                finalDamage,
                isCrit,
                streakMult,
                classMult,
                newHp,
                isDefeated,
                bonusXp,
                bonusGold,
                logs
        );
    }
}
