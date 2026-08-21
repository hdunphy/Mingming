# OS rework specs: valkyrie_v2, nidhoggr_v2, draugr_v2

- Type: wayfinder:grilling
- Status: closed
- Assignee: wayfinder (Claude session, 2026-08-05)
- Blocked by: —

## Question

The [OS design review](09-os-design-review.md) sentenced three variants to rework. Design the replacements with Henry — named effect, hook-level mechanics inside the existing vocabulary (or an explicit engine-work ask), rev-3 price sanity, and enough spec that deck design can build each 10-card deck. Constraints: payoff-unique across all 32, solo-live. Also decide EINHERJAR_RALLY's disposition.

## Resolution

Grilled with Henry 2026-08-05. Three specs + the EINHERJAR disposition, implementation graduated as [OS rework implementation](12-os-rework-implementation.md). Names are provisional — Henry renames at will.

### valkyrie_v2 — "CRUSADER_KERNEL" (buff-variety snowball, solo)

**Effect:** Valkyrie's Light attacks deal **+10% damage per distinct buff type** currently on her (Strengthened, Sharp, Regen, StableOS, Energized, BarkShield — count of *types present*, not stacks).
**Numbers:** her current deck reaches 2 distinct types → +20% ≈ 8–18 power/turn; a built deck layering 3–4 types → +30–40%, rivaling ymir_v2's +35% but earned over setup turns. In-band as a snowball payoff.
**Uniqueness:** counts *types* (wants variety) vs gullinbursti_v2's raw Sharp-stack scaling (wants stacking) — different deckbuilding pull. Pairs with valkyrie_v1: v1 buffs *allies* (team), v2 wants buffs *on herself* (solo) — same card family, opposite target lines.
**Implementation:** custom onDamageCalculated hook (own Light ATTACK), multiplier `1 + 0.1 × distinctBuffTypes(owner)`.

### nidhoggr_v2 — "BLOOD_SCENT_OS" (threshold feeding, anti-heal, solo-live)

**Effect (Henry's design):** whenever **any unit — either side, himself included — crosses from ≥50% to <50% HP by any HP loss** (attack, DoT tick, recoil, self-damage), Nidhoggr gains **+2 Strengthened +2 Sharp**. Healing back to ≥50% **re-arms** that unit (one proc per crossing).
**Numbers (the "is that OP?" check):** 50 power per proc; clean 1v1 = 2–4 procs (~14 power/turn, mid-band). The 25% damage-multiplier cap bounds the snowball (~6 procs to offense cap; further stacks matter only to stack-readers). Anti-heal by construction: every heal-above-then-drop cycle re-procs — the stall kits (kraken/hel/audhumbla) feed him, making this the most anti-stall firmware in the game. Self-inflict line (e.g. `dark_pact` to drop himself) is HP-priced and roughly break-even (~40–80 power of cards per 50 power of stats), not degenerate.
**Uniqueness:** distinct from nidhoggr_v1 (poison persistence), hel (drain), skoll_v1 (per-hit retaliation) — this is event-threshold feeding.
**Implementation note:** crossing detection needs prev-vs-post HP at the **HP-loss choke point** (`effectHandlers` damage application), not just onPostDamage — DoT ticks must count. Per the standing repo rule, add it as a *general-purpose* engine event (e.g. `onHpThresholdCrossed`, threshold param) with this OS as first consumer.

### draugr_v2 — "GRAVE_CHILL_OS" (rebuilt: same fantasy, works vs intents)

**Effect:** enemies afflicted with **2+ distinct debuff types deal −20% damage to Draugr** (all damage: cards *and* intents).
**Numbers:** ~3 damage shaved per ~15-damage hit at L15 ≈ 8–12 power/turn of mitigation once his deck sustains 2 debuff types — deliberately the softer number since draugr sits at 63% mirror-stall; the [Ice sleep package](09-os-design-review.md)'s Str payoff is his clock. Hook multipliers sit outside the 25% status cap (ymir_v2 precedent).
**Uniqueness:** conditional incoming-damage reduction (punishes being debuffed) vs ymir_v1 (applies Weakened on hit) — cousin fantasies, different mechanisms.
**Implementation:** incoming onDamageCalculated with `sourceDebuffCount ≥ 2` (condition already exists in the validator); verify defender-side onDamageCalculated hooks are consulted in the damage pipeline for both card and intent damage — if only attacker-side hooks run today, that's the general-purpose gap to fill.

### EINHERJAR_RALLY → team daemon card "einherjar_standard"

Converted from firmware to a **Light Daemon program**: while active, the owner's Light attacks deal +10% per other living ally (same `ALIVE_ALLIES` scaling, now player-earnable in team content instead of species-locked). Daemon-rule pricing: 3v3 steady state ≈ +20% on ~2 Light attacks/turn ≈ 8–16 power/turn × 4 ≈ 32–64 → **2e, exhaust**, graded by `npm run balance` when it lands with the Light card work. The `valkyrie_v2` hook id is retired; the daemon carries the name and the fantasy.

**Watch item for implementation:** BLOOD_SCENT + CRUSADER both push stack/type-reading; confirm neither interacts degenerately with `core_overclock_daemon` (Strength doubling) in sims.
