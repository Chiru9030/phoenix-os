package com.phoenix.combat.controller;

import com.phoenix.combat.model.CombatRequest;
import com.phoenix.combat.model.CombatResult;
import com.phoenix.combat.service.CombatService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/combat")
@CrossOrigin(origins = "*")
public class CombatController {

    private final CombatService combatService;

    public CombatController(CombatService combatService) {
        this.combatService = combatService;
    }

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> status() {
        return ResponseEntity.ok(Map.of(
                "service", "Phoenix Combat Simulation Engine",
                "version", "1.0.0",
                "runtime", "Java 21 / Spring Boot 3.3.0",
                "status", "HEALTHY"
        ));
    }

    @PostMapping("/simulate")
    public ResponseEntity<CombatResult> simulateCombat(@Valid @RequestBody CombatRequest request) {
        CombatResult result = combatService.simulateStrike(request);
        return ResponseEntity.ok(result);
    }
}
