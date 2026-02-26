# Epic 10.5: Dynamic AI Behaviors & Gym Scaling

This document defines the advanced logic for enemy move selection and the "Elite/Boss" difficulty curve for Gym Gauntlets.

---

## 1. Dynamic Move-Sets (The Behavior Tree)

Instead of a flat array, enemy move-sets are now treated as a **Priority Queue** with logic gates.

### 1.1. Move Logic Schema
Every move in the `moves` array can now have an optional `trigger` condition:

```typescript
{
  id: "emergency_reboot",
  name: "EMERGENCY_REBOOT",
  intentType: "Defend",
  priority: 100, // Higher priority moves are checked first
  trigger: {
    type: "HEALTH_LT",
    value: 30
  },
  actions: [ { type: "HEAL", power: 50 }, { type: "STATUS", status: "StableOS", stacks: 1 } ]
}
```

### 1.2. The Decision Loop
At the start of the Enemy Turn, the AI follows these steps:
1.  **Condition Scan:** Checks all moves with a `trigger`. The first move whose trigger is met becomes the `currentIntent`.
2.  **Cooldowns:** (Optional) Moves can have a `cooldown` (e.g., "Cannot use this move twice in a row").
3.  **Default Weight:** If no triggers are met, the AI falls back to its standard weighted-random selection.

---

## 2. Making Gyms Harder (The Boss Experience)

Gyms should feel like a coordinated team challenge rather than three disconnected random units.

### 2.1. Signature "Gym OS" (Commander Passives)
Gym Leaders have a **Leader OS** that grants a passive buff to their **entire team**.
- **The Burn Gym:** "All allied Fire attacks apply +1 Burn stack."
- **The Stall Gym:** "All allies start with 50 Temp HP (Shield)."

### 2.2. Curated Move-Sets (The "Archetype" AI)
Unlike random encounters, Gym units use specialized move-sets designed for synergy:
- **Unit 1 (The Support):** Only has `Heal` and `Energy Grant` moves.
- **Unit 2 (The Tank):** Only has `Taunt` and `Status` moves.
- **Unit 3 (The Finisher):** High-damage `Attack` moves that only trigger if the target has a specific status.

### 2.3. Multi-Phase Bosses
For Battle 3/3 in a Gym Gauntlet, the Leader unit can "Shift Phases" at health thresholds:
- **Phase 1 (70%+ HP):** Standard moves.
- **Phase 2 (<70% HP):** Gains `StableOS` permanent immunity and switches to aggressive AOE moves.

---

## 3. Rewards for High Difficulty

To make these harder Gyms worth it:
- **Relic Tiers:** Bosses drop "Signature Relics" that cannot be found in random encounters.
- **Blueprint Pity:** Gym Leaders have a 100% Blueprint drop rate for their lead unit.
