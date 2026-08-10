# Draugr decks (ticket 48) — a Mingming that fights in its sleep

- Type: wayfinder:task
- Status: open
- Assignee:
- Blocked by: none

*Designed with Henry 2026-08-09. Ymir gets its own ticket after this one — do NOT touch ymir's deck
lists here, though two shared card re-costs will move its numbers (§9).*

*Every line number, score and baseline below was read at **`cfa4306`, registryHash `1:4d47138a`**.
Scores come from a Python port of `calculatePowerscale` validated **31/33** against that report's
`cardBudget.redlines` — the two misses are `fertile_ground_daemon` (daemon hook scoring not ported)
and `ash_communion` (a `consume` card; **no card in this ticket uses `consume`**). **Re-score every
new card with the real scorer and report the actual numbers**; flag anything more than 0.3 off the
table in §6.*

---

## 1. The design in one paragraph

Draugr sleeps on purpose. `PERMAFROST_WAKE` gains a flag that lets him act while Asleep, so sleep
stops being a lost turn and becomes a stance he pays a card to enter; his payoff cards read
"+N power if you are Asleep". The enemy takes the stance away by hitting him — Asleep now loses one
stack per incoming attack instead of ending on the first point of damage — and the wake pays him
1 Energized and a card. That produces a two-turn rhythm: a **sleep turn** on 2 energy
(`grave_rest` → `nightmare`, 100 power) and an **awake turn** on 3 energy where StableOS blocks
re-sleeping and the new 3-cost lands. draugr_v2 is unrelated: it feeds `GRAVE_CHILL_OS` (enemies
carrying 2+ *distinct* debuffs deal 20% less to Draugr) with cheap variety and cashes it with a
payoff that scales on distinct debuff count, so the OS and the win condition want the same board.

---

## 2. Baselines at HEAD — quote these, do not re-derive

| row | value | note |
|---|---|---|
| `gauntlet:control-vs-draugr:draugr_v1` | **0.790** (100/100, 12.5 turns) | control wins 79% — **draugr is one of the weakest decks in the roster** |
| `gauntlet:control-vs-draugr:draugr_v2` | **0.770** (100/100, 12.6 turns) | listed in HANDOFF 8-GAUNTLET-b |
| `gauntlet:control-overall:slot1` | 0.234 | the floor |
| `gauntlet:control-overall:slot2` | 0.364 | the floor |
| `os:draugr` (§2.3) | 0.510, 44.2 turns, dead 0.001/0.000 | in band, but see §8 |
| `mirror:draugr` | 42.1 turns, 397/400 decided, dead 0.002/0.000, ftk 0 | **TURN_COUNT redline, open** |
| report totals | redlines 44, cardRedlines 33 | |

**The control number is the real target of this pass**, per HANDOFF 8-CONTROL and ticket 47: §2.3 is
same-species and reports a gap, not a level, and draugr passes it today while losing 79% to a
firmware-free on-curve deck.

---

## 3. Engine work

Eight changes, all small. **Two add new data fields — put them in `HookSchema.ts` or zod silently
strips them** (that is exactly how `escalatePerPlay` cost three sim runs in ticket 36; HANDOFF 8c2).

### 3.1 Asleep decrements per incoming attack

`src/engine/effectHandlers.ts:189-197`. Today:

```ts
    let wakesUp = false;
    if (finalDamage > 0) {
        const sleepIndex = target.statusEffects.findIndex(s => s.type === 'Asleep');
        if (sleepIndex !== -1) {
            wakesUp = true;
        }
    }
```

Replace with a per-attack decrement. Three deliberate changes:

- **One stack per attack, not a full wake.** Asleep is applied at 3 (`ASLEEP_INITIAL_STACKS`), so it
  takes three incoming attacks to break — *plus* the natural 1/turn decay, which stays exactly as it
  is (`StatusBehaviors.ts:282`). Henry's call: both clocks run.
- **Drop the `finalDamage > 0` requirement.** A fully-absorbed hit still counts. This is what stops
  `glacier_wall` from keeping him asleep forever, which was a live anti-synergy.
- **Skip the decrement when `sourceId === 'SYSTEM'`.** That is the discriminator for status and hook
  HP mutations (`resolutionEngine.ts:54` dispatches them through `effectHandlers['ATTACK']` with a
  literal `'SYSTEM'` source), and it is how "statuses do not wake him" is enforced. End-of-turn DoT
  ticks already bypass `handleAttack` entirely (`battleReducer.ts:697`), but `TRIGGER_STATUS` and
  Burn-overflow do not — without the guard, a poison detonate would wake him.

Fire `onStatusRemoved` **only when the counter reaches 0**, keeping the existing context shape
(`statusApplied: 'Asleep'`).

### 3.2 The attack-wake grants StableOS

The natural wake already grants 1 turn of CC immunity (`battleReducer.ts:742-747`); the damage path
never did, and `statusGlossary.ts:34` claims it does. Make the attack-wake match, which also fixes the
doc/code drift. **This is load-bearing for the design** — it is what forces an awake turn after every
wake and makes the two-turn rhythm exist.

### 3.3 `actsWhileAsleep` on the OS

There is **no Asleep gate in `handlePlayProgram`** — the incapacitation check at
`battleReducer.ts:464` is in `handleExecuteIntent`, the enemy-intent path. The only thing stopping a
sleeping unit from casting is the `not_asleep` constraint printed on all 171 cards. Waive that one
check for an OS that opts in, in `validateProgramConstraints` (`battleReducer.ts:121`):

```ts
    // Ticket 48: PERMAFROST_WAKE lets Draugr act in its sleep. The constraint stays printed on
    // every card, so Asleep still shuts down everyone else - the OS waives this one check for
    // its owner only. Deliberately NOT done by stripping `not_asleep` from Draugr's cards: that
    // would let any species holding one of them act while slept.
    const waivesAsleep = source.activeOS ? getOSBehavior(source.activeOS)?.actsWhileAsleep : false;
```

then `continue` past any constraint where `type === 'NOT_STATUS' && value === 'Asleep'`.
`battleReducer` already imports `getOSBehavior` (`:217`, for `maxCardsPerTurn`) so there is no new
import and no circular-import risk, and `TacticalAI` validates through the same function (`:285`).

Add `actsWhileAsleep?: boolean` to `OSDefinition` (`firmwareRegistry.ts:14`), to the
`FIRMWARE_REGISTRY` mapping (`:55`), and to `HookSchema.ts:73` next to `maxCardsPerTurn` — the exact
precedent to copy.

**Known asymmetry, record it, do not fix it:** `handleExecuteIntent` still blocks a sleeping unit, so
a Draugr running MOVES/intents will not act in its sleep. The balance suite runs CARDS on both sides
so it will not appear there.

### 3.4 AI eval: Asleep is free to an `actsWhileAsleep` owner

**Without this the deck measures as unplayable and every number in the report is meaningless.**
`TacticalAI.ts:155-157` values Asleep at `-HP_POINTS * maxHp * TURN_DAMAGE_FRACTION * s` — three
stacks is **−60% of a health pool**, so the search will never play a self-sleep card. Same failure
family as ticket 40's Poison horizon, caught before the run this time.

```ts
        case 'Asleep':
            // Ticket 48: Asleep is only a lost turn for a unit that cannot act through it.
            if (getOSBehavior(entity.activeOS ?? '')?.actsWhileAsleep) return 0;
            // Skip `stacks` turns (max 3), same per-turn value as Stunned.
            return -HP_POINTS * entity.maxHp * TURN_DAMAGE_FRACTION * s;
```

### 3.5 powerscale: self-applied Asleep is a different effect

`ASLEEP_POWER = 45` (`powerscale.ts:201`) is the enemy-facing price. Add:

```ts
/**
 * Ticket 48: self-applied Asleep is NOT the enemy-facing effect. The sleeper keeps their turn,
 * their energy and their draw; all they lose is access to cards carrying `not_asleep`. Priced at
 * a tenth of the enemy-facing rate.
 *
 * CAVEAT, and it is the same class as `brute_force`'s OS-guaranteed conditional (HANDOFF item 8):
 * this price assumes the deck can act while asleep. For a deck that cannot, self-sleep really does
 * cost a whole turn (~55 power) and this model under-charges it 5x. Any self-sleep card printed
 * outside a sleep deck must be hand-checked.
 */
const ASLEEP_SELF_POWER = 11;
```

used in the STATUS branch when `action.status === 'Asleep' && actionIsSelfFacing`. Self-sleep then
scores **−1.0**.

### 3.6 powerscale: a 0.5 discount on Asleep-gated actions

The flat 0.7 conditional discount assumes you get the effect ~70% of the time. With StableOS forcing
an awake turn after every wake, Draugr is asleep at most every other turn. Where an action's **only**
conditional is `HAS_STATUS / target: SELF / value: Asleep`, use **0.5** instead of 0.7. Keep it that
narrow — a second conditional on the same action falls back to 0.7.

### 3.7 `DISTINCT_STATUS` scaler

`STATUS_COUNT` cannot be reused: it reads **total stacks** and adds **+25% per stack, uncapped**
(`ActionExecutors.ts:114-116`) — thirteen stacks is +325%. Add a scaler that counts *distinct*
negative statuses on the target, cloning the `DAZED_STACKS` branch in `getEffectiveAttackPower`
(`ActionExecutors.ts:~56`) — target-side, uncapped, `target` optional so the UI preview can call it
without one. Reuse `NEGATIVE_STATUSES` (`ConditionValidator.ts:10`) as the list so the payoff card and
`GRAVE_CHILL_OS` agree by construction. Add the key to the `scaling` union (`types.ts:253`) and price
it at `ASSUMED_STATUS_COUNT` in powerscale's ATTACK branch next to `DAZED_STACKS`.

### 3.8 Data

New cards (§4), two re-costs (§5), the OS rewrite (§6), both deck lists (§7).

---

## 4. New cards — `src/engine/data/programs.json`

**None of the new v1 cards need `not_asleep` removed** — §3.3 waives it at the OS. Keep the standard
constraint block on every card. `brute_force` is the schema template for multi-action attacks;
`equilibrium` for `HEALTH_THRESHOLD`-shaped conditionals; `purify` for CLEANSE.

```json
{
    "id": "grave_rest",
    "name": "Grave Rest",
    "description": "Sleep yourself. Heal with 30 power.",
    "element": "Ice",
    "target": "Self",
    "category": "Skill",
    "rarity": "Common",
    "baseCost": 0,
    "constraints": ["not_stunned", "not_asleep", "energy_base"],
    "actions": [
        { "type": "STATUS", "status": "Asleep", "stacks": 1, "target": "SELF" },
        { "type": "HEAL", "power": 30, "target": "SELF" }
    ]
}
```
**1.0 / 1.0.** Heals 6.2 HP on his 83 HP frame.

```json
{
    "id": "barrow_rot",
    "name": "Barrow Rot",
    "description": "5 power. +10 power if you are Asleep.",
    "element": "Ice",
    "target": "Single",
    "category": "Attack",
    "rarity": "Common",
    "baseCost": 0,
    "constraints": ["not_stunned", "not_asleep", "energy_base"],
    "actions": [
        { "type": "ATTACK", "power": 5, "target": "TARGET" },
        { "type": "ATTACK", "power": 10, "target": "TARGET", "conditionals": [{ "type": "HAS_STATUS", "target": "SELF", "value": "Asleep" }] }
    ]
}
```
**1.0 / 1.0** at the 0.5 discount.

```json
{
    "id": "deathless_slumber",
    "name": "Deathless Slumber",
    "description": "Cleanse all debuffs from yourself. Sleep yourself. Heal with 45 power.",
    "element": "Ice",
    "target": "Self",
    "category": "Skill",
    "rarity": "Uncommon",
    "baseCost": 1,
    "constraints": ["not_stunned", "not_asleep", "energy_base"],
    "actions": [
        { "type": "CLEANSE", "target": "SELF" },
        { "type": "STATUS", "status": "Asleep", "stacks": 1, "target": "SELF" },
        { "type": "HEAL", "power": 45, "target": "SELF" }
    ]
}
```
**2.9 / 3.0.** Heals 9.3 HP. **Action order is load-bearing: CLEANSE must resolve BEFORE the Asleep
application**, or the card strips the sleep it just applied.

```json
{
    "id": "dread_tidings",
    "name": "Dread Tidings",
    "description": "Draw a card. If you are Asleep, draw 2 more and gain 3 Strengthened.",
    "element": "Ice",
    "target": "Self",
    "category": "Skill",
    "rarity": "Uncommon",
    "baseCost": 1,
    "constraints": ["not_stunned", "not_asleep", "energy_base"],
    "actions": [
        { "type": "DRAW", "amount": 1, "target": "SELF" },
        { "type": "DRAW", "amount": 2, "target": "SELF", "conditionals": [{ "type": "HAS_STATUS", "target": "SELF", "value": "Asleep" }] },
        { "type": "STATUS", "status": "Strengthened", "stacks": 3, "target": "SELF", "conditionals": [{ "type": "HAS_STATUS", "target": "SELF", "value": "Asleep" }] }
    ]
}
```
**3.2 / 3.0** — 0.2 over, deliberate (Henry): it is the deck's answer to dead draws.

```json
{
    "id": "nightmare",
    "name": "Nightmare",
    "description": "30 power. +70 power if you are Asleep.",
    "element": "Ice",
    "target": "Single",
    "category": "Attack",
    "rarity": "Rare",
    "baseCost": 2,
    "constraints": ["not_stunned", "not_asleep", "energy_base"],
    "actions": [
        { "type": "ATTACK", "power": 30, "target": "TARGET" },
        { "type": "ATTACK", "power": 70, "target": "TARGET", "conditionals": [{ "type": "HAS_STATUS", "target": "SELF", "value": "Asleep" }] }
    ]
}
```
**6.5 / 6.5** at the 0.5 discount. 100 power asleep = 26.7 HP = 32% of a pool.

```json
{
    "id": "barrow_king",
    "name": "Barrow King",
    "description": "95 power. Apply 2 Weakened.",
    "element": "Ice",
    "target": "Single",
    "category": "Attack",
    "rarity": "Rare",
    "baseCost": 3,
    "constraints": ["not_stunned", "not_asleep", "energy_base"],
    "actions": [
        { "type": "ATTACK", "power": 95, "target": "TARGET" },
        { "type": "STATUS", "status": "Weakened", "stacks": 2, "target": "TARGET" }
    ]
}
```
**10.2 / 10.5.** The only 3-cost in Ice. It is castable because `PERMAFROST_WAKE` hands him
1 Energized on every wake, and the awake turn is exactly the turn StableOS stops him sleeping.

```json
{
    "id": "rimefrost",
    "name": "Rimefrost",
    "description": "Apply 1 Weakened and 1 Dazed.",
    "element": "Ice",
    "target": "Single",
    "category": "Status",
    "rarity": "Common",
    "baseCost": 0,
    "constraints": ["not_stunned", "not_asleep", "energy_base"],
    "actions": [
        { "type": "STATUS", "status": "Weakened", "stacks": 1, "target": "TARGET" },
        { "type": "STATUS", "status": "Dazed", "stacks": 1, "target": "TARGET" }
    ]
}
```
**0.9 / 1.0.** Two *distinct* debuff types for zero energy — this one card satisfies
`GRAVE_CHILL_OS` on its own.

```json
{
    "id": "frost_bite",
    "name": "Frost Bite",
    "description": "15 power. Apply 2 Burn.",
    "element": "Ice",
    "target": "Single",
    "category": "Attack",
    "rarity": "Common",
    "baseCost": 1,
    "constraints": ["not_stunned", "not_asleep", "energy_base"],
    "actions": [
        { "type": "ATTACK", "power": 15, "target": "TARGET" },
        { "type": "STATUS", "status": "Burn", "stacks": 2, "target": "TARGET" }
    ]
}
```
**3.0 / 3.0.** Deliberately reuses **Burn**, not a new status — Henry's call. It is the third
distinct debuff type, nothing more.

```json
{
    "id": "numbing_gale",
    "name": "Numbing Gale",
    "description": "20 power. Apply 2 Dazed.",
    "element": "Ice",
    "target": "Single",
    "category": "Attack",
    "rarity": "Common",
    "baseCost": 1,
    "constraints": ["not_stunned", "not_asleep", "energy_base"],
    "actions": [
        { "type": "ATTACK", "power": 20, "target": "TARGET" },
        { "type": "STATUS", "status": "Dazed", "stacks": 2, "target": "TARGET" }
    ]
}
```
**3.0 / 3.0.**

```json
{
    "id": "killing_frost",
    "name": "Killing Frost",
    "description": "13 power. Apply 2 Weakened and 2 Dazed.",
    "element": "Ice",
    "target": "Single",
    "category": "Attack",
    "rarity": "Uncommon",
    "baseCost": 1,
    "constraints": ["not_stunned", "not_asleep", "energy_base"],
    "actions": [
        { "type": "ATTACK", "power": 13, "target": "TARGET" },
        { "type": "STATUS", "status": "Weakened", "stacks": 2, "target": "TARGET" },
        { "type": "STATUS", "status": "Dazed", "stacks": 2, "target": "TARGET" }
    ]
}
```
**3.0 / 3.0.**

```json
{
    "id": "rimebreaker",
    "name": "Rimebreaker",
    "description": "25 power for each different debuff on the target.",
    "element": "Ice",
    "target": "Single",
    "category": "Attack",
    "rarity": "Rare",
    "baseCost": 2,
    "constraints": ["not_stunned", "not_asleep", "energy_base"],
    "actions": [
        { "type": "ATTACK", "power": 25, "target": "TARGET", "scaling": "DISTINCT_STATUS" }
    ]
}
```
**7.5 / 6.5 — deliberately over budget** (Henry): it needs setup, two copies compete for the same
board, and it is the only clock v2 has. Realistic output:

| distinct debuffs | power | HP | % of an 83 HP pool |
|---|---|---|---|
| 2 (Weakened + Dazed) | 50 | 13.4 | 16% |
| **3 (+ Burn) — the realistic case** | **75** | **20.0** | **24%** |
| 4 (+ Stunned) | 100 | 26.7 | 32% |

Four types needs `glacial_slam` and `rimebreaker` in the same turn (4 energy) and Stun only survives
the turn it lands, so treat 4 as an outlier.

---

## 5. Card re-costs — two of Ice's three standing card redlines

| card | from | to | score |
|---|---|---|---|
| `glacier_wall` | 1e, 15 BarkShield | **1e, 8 BarkShield** | 5.4 → **2.9 / 3.0** |
| `glacial_slam` | 2e, 29 power + Stun | **2e, 15 power + Stun** | 8.4 → **7.0 / 6.5** |

Stun is priced at 55 power, so a 1-energy Stun can never fit a 30-power band — that is why Ice's
three over-budget cards are all its "stop the game" cards, and why nothing in the element ever dies.
`glacier_wall` at 15 absorbed 12.4 HP for one energy, more than two `ice_spear` hits.

`glacial_slam` lands at 7.0 against 6.5: **8% over, accepted by Henry**, since Stun's price leaves no
seat on the band for a Stun card that also does anything.

**`flash_freeze` (1e, Apply Stun, 5.5 / 3.0) is NOT re-costed here.** It leaves both draugr decks, but
it is ymir's card and re-costing it is the ymir ticket's job. Expect it to stay in `cardRedlines`.

Rewrite both descriptions to match the new action values — ticket 24 changed 48 power fields and zero
descriptions, and the sweep is still not finished.

---

## 6. `PERMAFROST_WAKE` — `src/engine/data/lib/hooks.json`

Edit as **text**, surgically: `hooks.json` does not round-trip through `json.dumps` (its inline arrays
expand). Replace the whole `draugr_v1` entry:

```json
    "draugr_v1": {
        "id": "draugr_v1",
        "name": "PERMAFROST_WAKE",
        "actsWhileAsleep": true,
        "description": "Draugr can act while Asleep. Whenever it wakes from Asleep or is revived, it gains 1 Energized and draws a card.",
        "hooks": [
            {
                "id": "draugr_v1_wake",
                "trigger": "onStatusRemoved",
                "priority": 40,
                "when": {
                    "target": "SELF",
                    "statusApplied": "Asleep"
                },
                "do": [
                    {
                        "type": "STATUS",
                        "target": "SELF",
                        "status": "Energized",
                        "stacks": 1
                    },
                    {
                        "type": "DRAW",
                        "target": "SELF",
                        "amount": 1
                    },
                    {
                        "type": "LOG",
                        "text": "{owner} stirs from the barrow! +1 Energy next turn, draw 1."
                    }
                ]
            }
        ]
    },
```

**Why `Energized` and not `ENERGY`.** The wake almost always lands on the *enemy's* turn, and
`processPreTurn` **sets** `currentEnergy = maxEnergy + Energized` rather than adding to it
(`battleReducer.ts:843-855`) — a raw `ENERGY` grant on the enemy's turn is wiped before he can spend
it. This is the same trap nidhoggr's BLOOD_SCENT hit in ticket 39. `Energized` banks to the start of
his next turn and both wake paths pay in full.

**Why the draw is immediate and there is no "draw next turn" status.** `drawCards` breaks at
`HAND_SIZE_LIMIT` without destroying anything (`deckLogic.ts:25`), so a card drawn on the enemy's turn
simply waits in hand, and if the hand is already at 9 the draw does not happen and the card stays in
the drawpile. Nothing is lost.

`draugr_v2` / `GRAVE_CHILL_OS` is **unchanged** — ticket 12 already rebuilt it as an
`onDamageCalculated` multiplier that fires against intents, and it needs no new status: `NEGATIVE_STATUSES`
(`ConditionValidator.ts:10`) counts distinct types, so Weakened + Dazed satisfies it.

---

## 7. Deck lists — `src/engine/data/mingmingRegistry.ts:484-487`

```ts
        decks: {
            "draugr_v1": ["grave_rest", "grave_rest", "barrow_rot", "deathless_slumber", "dread_tidings", "dread_tidings", "glacier_wall", "ice_spear", "nightmare", "nightmare", "barrow_king"],
            "draugr_v2": ["rimefrost", "rimefrost", "water_slap", "frost_bite", "numbing_gale", "killing_frost", "ice_spear", "glacial_slam", "rimebreaker", "rimebreaker"]
        },
```

Delete the `// Ticket 13: both slots hold the legacy shared deck` comment above it.

**draugr_v1 — 11 cards, curve 0e×3 / 1e×5 / 2e×2 / 3e×1, deck score 41.0.** Every card is playable
while asleep, because §3.3 waives the constraint at the OS rather than per card. The line: turn 1
`grave_rest` (0e) → `nightmare` (2e) for 100 power; the enemy's attacks wake him for 1 Energized and a
card; turn 2 he has 3 energy and StableOS, so `barrow_king`; turn 3 he sleeps again.

**draugr_v2 — 10 cards, curve 0e×3 / 1e×4 / 2e×3, deck score 36.6.** Three 2-energy instances
exactly, per ticket 31's finding that a fourth locks out the 1e cards on a 2-Energy economy.
`water_slap` is the neutral tier.

`frost_jab` leaves both decks and is used by nobody afterwards. **Leave the card in the registry** —
`shadow_claw` survived the Dark pass the same way, and deleting a card risks save-data references.
The 0e-poke-twin retirement chore is deferred registry-wide, not skipped here specifically.

---

## 8. Gates

Run scoped first: `set BALANCE_ONLY=draugr&& npm run balance` (20-60s, never writes `docs/balance/`).
Full committed run only once in band.

| gate | band | draugr baseline at `cfa4306` |
|---|---|---|
| **`gauntlet:control-vs-draugr:draugr_v1`** | toward the 0.234 slot-1 aggregate; **anything ≥ 0.60 is a fail** | **0.790** |
| **`gauntlet:control-vs-draugr:draugr_v2`** | toward the 0.364 slot-2 aggregate; **anything ≥ 0.60 is a fail** | **0.770** |
| §2.3 `os:draugr` | 0.30–0.70 | 0.510 |
| `mirror:draugr` avg turns | ≤ 30 | **42.1 — open redline, must close** |
| `mirror:draugr` decided | ≥ 60% | 397/400 |
| dead cards, **per side** | ≤ 0.35 | 0.002 / 0.000 |
| FTK | 0 | 0 |
| new card redlines | none unexplained | 33 total; this ticket removes `glacier_wall` and `glacial_slam`, adds `dread_tidings` (+0.2) and `rimebreaker` (+1.0), both deliberate |

**Expected §2.3 skew, do not misdiagnose it.** Asleep is in `NEGATIVE_STATUSES`, and `GRAVE_CHILL_OS`
counts distinct debuffs **on the attacker** — so a sleeping v1 carrying one more debuff deals 20% less
to v2. Henry has accepted this. If v1 reads low in the gate, that interaction is the first thing to
quantify, not a v1 power problem.

`npx tsc -b`, `npx vitest run`, `npx vite build` all green before any balance run.

---

## 9. Blast radius outside draugr

`glacier_wall` and `glacial_slam` are both in **ymir's placeholder decks** (`glacier_wall` ×2,
`glacial_slam` ×1). Their rows **will move** and that is expected, not a regression — ymir is an
untuned placeholder and gets its own ticket next. Report the deltas; do not tune ymir to compensate.

Everything else is Ice-only: no card touched here appears in any non-Ice deck.

The three powerscale changes (§3.5, §3.6, §3.7) are additive — no existing card uses a self-facing
Asleep, an Asleep conditional, or `DISTINCT_STATUS`, so **no committed card score outside this ticket
may move.** If one does, STOP.

---

## 10. Pre-authorised knobs — max two adjustment rounds, ONE change per sim

1. **Asleep conditional discount** 0.5 → 0.6 / 0.4 (powerscale §3.6). Re-derive `nightmare`'s bonus to
   sit on band at the new value: at 0.6 it is +55, at 0.4 it is +85.
2. **`nightmare`** bonus 70 → 50 / 85.
3. **`grave_rest`** heal 30 → 20 / 15 / 10 power.
4. **`deathless_slumber`** heal 45 → 30 / 20 power.
5. **`rimebreaker`** 25 → 20 / 30 per distinct debuff (15 = 4.5, 20 = 6.0, 30 = 9.0, 35 = 10.5).
6. **`dread_tidings`** conditional draw 2 → 1, Strengthened 3 → 2.
7. **`glacial_slam`** 15 → 10 power (7.0 → 6.5, exactly on band).
8. **v2 neutral tier**: `water_slap` ↔ `hoarfrost` (trades 12 neutral power for 6 power plus a free
   Weakened that feeds `GRAVE_CHILL_OS`).

**Ships OFF, available as a knob:** `deathless_slumber` also removing StableOS
(`{"type": "STATUS", "status": "StableOS", "stacks": -1, "target": "SELF"}`) so he can re-sleep the
turn he wakes. If it goes in it must be **hand-priced**: StableOS is in neither `BUFFS` nor `DEBUFFS`,
so it falls to the `stacks * 2.0` default and — after ticket 47's negative-stacks flip — pays him
**+1.8** for removing his own buff. Report it rather than shipping it silently.

---

## 11. STOP and report

- **`grave_rest` measures a 0% play rate.** That means §3.4 did not take and the AI is still valuing
  Asleep at −60% of a pool. Do not "fix" it with knobs.
- `actsWhileAsleep` or `DISTINCT_STATUS` reads as a no-op — **check the zod schema first**
  (`HookSchema.ts`), and log the value inside the code path before tuning anything (HANDOFF 8c2).
- Any committed card score outside this ticket's cards moves (§9).
- The Asleep decrement wakes him off a poison or Burn tick — the `sourceId === 'SYSTEM'` guard is wrong.
- Draugr sleeps and never wakes because nothing attacks him, or conversely never stays asleep past his
  own turn — report the measured turns-asleep-per-game either way.
- `barrow_king` reads as a dead card above 0.35 on its own: the Energized is not arriving, or StableOS
  is not forcing the awake turn.
- Anything that would require touching ymir's deck lists.

---

## 12. Deliverables

- Commit hash and `registryHash`.
- Every gate in §8 with its baseline next to it.
- **Real `calculatePowerscale` scores for all 11 new cards**, flagged where they differ from §4/§5 by
  more than 0.3.
- **Turns spent asleep per game, and PERMAFROST_WAKE procs per game** — the design assumes ~50% and
  ~3. If either is far off, the 0.5 discount in §3.6 is wrong and that is knob 1.
- `nightmare` play rate and damage per play, split by asleep/awake.
- `rimebreaker` damage per play and the **distinct-debuff count at cast** (the design assumes 3).
- ymir's moved rows (§9), reported not tuned.
- Knob rounds used and any deviation.

Docs on close: this ticket file's `## Resolution`, a `map.md` decision line, and a **HANDOFF.md
refresh** (species tuned count, the Ice half-done line, and anything from §11 that turned into a
finding). CRLF for `docs/wayfinder` and engine `.ts`; LF for tests, `src/debug` and JSON;
`programs.json` must round-trip byte-exact under `json.dumps(d, indent=4, ensure_ascii=False)` with no
trailing newline. Surgical edits only — a whole-file diff means the line endings were converted.

One commit, author `Henry Dunphy <hdunphy15@gmail.com>` via
`git -c user.name=... -c user.email=... commit --author=...`. Never stage `package-lock.json` or
`node_modules`. Git locks that cannot be unlinked go to `_to_delete/git-locks/`.
