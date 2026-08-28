# Earth decks (ticket 52) — the roster's last element but one

- Type: wayfinder:task
- Status: closed
- Assignee:
- Blocked by: none

*Designed with Henry 2026-08-09. Baselines read at **`218b7a2`, registryHash `1:6b38742e`**. Scores
were hand-computed from the verified pricing rules after the device bridge dropped mid-run —
**re-score every card with the real `calculatePowerscale` and report anything more than 0.3 off the
tables below.** Ice completed in ticket 50; this leaves only Light (valkyrie + audhumbla).*

---

## 1. Baselines — quote these, do not re-derive

| row | value | |
|---|---|---|
| `gauntlet:control-vs-fafnir:fafnir_v1` | **0.000** (100/100, 20.3 turns) | beats the on-curve control outright |
| `gauntlet:control-vs-fafnir:fafnir_v2` | **0.010** | |
| `gauntlet:control-vs-gullinbursti:gullinbursti_v1` | **0.000** (100/100, 16.6 turns) | |
| `gauntlet:control-vs-gullinbursti:gullinbursti_v2` | **0.000** (100/100, 18.8 turns) | |
| `gauntlet:control-overall:slot1 / slot2` | 0.185 / 0.321 | the aggregates |
| `mirror:fafnir` | 18.3 turns, 400/400, dead 0.041/0.038 | **passes everything** |
| `os:fafnir` (§2.3) | **0.480** | in band |
| `mirror:gullinbursti` | **61.0 turns, 0/400 decided** | **TURN_COUNT redline** |
| `os:gullinbursti` (§2.3) | **0.000** (100/100, v2 wins all) | **OUT OF BAND** |
| totals | redlines 42, cardRedlines 35 | `stone_bark` 5.4/3.0 is Earth's only card redline |

**Fafnir already passes every gate.** The work is gullinbursti's unresolvable mirror, the 0.000 §2.3
gap, and the fafnir/gullinbursti identity split the map has flagged as the one **HIGH** overlap risk
since ticket 08 — both decks are the same Sharp package today.

**Neither species is weak.** Like ymir, all four decks beat the control. Do not read this as a power
pass.

---

## 2. The frames — the number the whole element turns on

| | fafnir | gullinbursti | (nidhoggr, for scale) |
|---|---|---|---|
| maxHP | 83 | 81 | 87 |
| attack | **29** | **32** | 41 |
| defense | **39** | **38** | 35 |
| atk/def | **0.74** | **0.84** | 1.17 |
| mirror damage | **0.167 × power** | **0.200 × power** | 0.312 |
| **pool** | **498 power** | **405 power** | 278 |

Fafnir's 498-power pool is the largest in the roster by 44%, and it is the attack-to-defense ratio,
not the HP. **The same card deals 47% less damage on fafnir than on nidhoggr.** Two consequences that
drive the design:

- **On-curve Earth cards are worth roughly half what the curve thinks, in the mirror.** That is why
  gullinbursti's 61-turn stall exists on a deck whose cards all score in band.
- **A point of flat damage from firmware is worth 5–6 power on these frames** (1 / 0.200 and
  1 / 0.167), against 3.2 on nidhoggr. Any OS that adds flat damage is worth nearly double here. §3.1
  is that problem.

---

## 3. Engine work — three changes

### 3.1 `KINETIC_RAM` bonus 1 → 0.5

`hooks.json`, `gullin_v2_ram`: `{"bonus": 1, "scaling": "SHARP_STACKS"}` → **`"bonus": 0.5`**.

`SHARP_STACKS` in `HookFactory.resolveScaling:111` returns **raw stacks with no cap** — the
`STRENGTH_STACKS` case on the very next line carries ticket 26's cap *with a comment describing this
exact failure mode*, and the Sharp side was never done. And because the hook is `onDamageCalculated`,
while `calculateDamage` runs **once per hit**, the bonus lands on **every hit of a multi-hit card**.

On gullinbursti's frame, 1 flat damage = 5 power. With the §5 Sharp re-costs he reaches 14–18 raw
stacks by turn 3 (Sharp's *effect* caps at 12.5, the raw count does not):

| Sharp | card | bonus 1.0 | **bonus 0.5** |
|---|---|---|---|
| 4 | 3 × 10 power | 18.0 HP (22% of pool) | **12.0 HP (15%)** |
| 8 | 3 × 10 power | 30.0 HP (37%) | **18.0 HP (22%)** |
| 12 | 3 × 18 power | 46.8 HP (58%) | **28.8 HP (36%)** |
| 18 | 3 × 18 power | 64.8 HP (**80%**) | 40.8 HP (50%) |

**Henry's instruction is explicit: no cap. Change the rate, not the ceiling.** Fractional is safe —
`HookFactory` does `newDamage += (bonus * scaleFactor)` and floors **once** at the end of the chain,
and `bonus` is `z.number()` in `HookSchema`. The `Math.min(stacks, 8)` cap stays in the drawer as
knob 1b, to be added only if measurement demands it.

### 3.2 `BUFF_NEXT_PROGRAM` needs a power-bonus form

`UNSTOPPABLE_MASS` stops granting a cost reduction and starts granting bonus power. Today
`BUFF_NEXT_PROGRAM` carries only `costReduction` (`nextProgramModifier`, consumed in
`handlePlayProgram`). Add a `powerBonus` alongside it, applied to the next Attack's first ATTACK
action.

**Add the field to `HookSchema.ts` or zod strips it silently** — that is exactly how
`escalatePerPlay` produced three byte-identical sim runs in ticket 36 (HANDOFF 8c2). Log the resolved
value inside `HookFactory` before tuning anything.

**Why the change:** the discount is worth a full Energy point every time it fires, and it fires every
turn (a 1-cost status card primes, then a 2-cost Attack lands at 1) — **~40 power a turn, ~240 a
game** — and it stacks with any other cost reduction, the seam ticket 36 documented. +20 power is the
same decision at half the price and touches nothing in the cost pipeline.

### 3.3 `CORRUPTED_GOLD_OS` rework

Today: `onStatusApplied` → `{"type": "ENERGY", "amount": 1}`. **This mostly does nothing**: debuffs
arrive on the enemy's turn and `processPreTurn` **sets** `currentEnergy = maxEnergy + Energized`
rather than adding, so the point is deleted before Fafnir can spend it. Third occurrence of this trap
(BLOOD_SCENT ticket 39, PERMAFROST_WAKE ticket 48).

It also cannot pay in Energy at all: at 40 power a point, an OS worth ~100 power a game can afford
**2.5 energy points across the whole battle**, so any per-debuff grant is instantly the largest
firmware in the game.

New shape, reading **types** rather than applications so a self-debuff card pays once per turn rather
than once per cast:

> *At the start of Fafnir's turn, he gains 2 Strengthened for each different debuff on him, then each
> of those debuffs loses 1 stack.*

`onTurnStart`, counting distinct types from `NEGATIVE_STATUSES` (`ConditionValidator.ts:10`).

**Henry's note on saturation, and it changes what to measure:** Strengthened cancels Weakened 1-for-1
on application (`DUALITY_MAP`), so against a Weakened deck the grant is *consumed cancelling it* and
never saturates — the OS reads as near-immunity to Weakened. Against everyone else it caps at 12.5
stacks and is worth ~65 power for the whole game. **That asymmetry is deliberate. Report §2.3 and the
gauntlet separately; an averaged figure will hide it.** The second currency (heal / draw / Regen) is
knob 3 and ships **off**.

---

## 4. New cards — `src/engine/data/programs.json`

Ten new Earth cards. `brute_force` is the schema template for multi-action attacks, `thermal_lance`
for the X-cost, `sky_dance` for multi-hit, `soothe` for negative-stack removal.

```json
{
    "id": "iron_will",
    "name": "Iron Will",
    "description": "Gain 4 Strengthened. Gain 2 Dazed.",
    "element": "Earth", "target": "Self", "category": "Skill", "rarity": "Common",
    "baseCost": 0,
    "constraints": ["not_stunned", "not_asleep", "energy_base"],
    "actions": [
        { "type": "STATUS", "status": "Strengthened", "stacks": 4, "target": "SELF" },
        { "type": "STATUS", "status": "Dazed", "stacks": 2, "target": "SELF" }
    ]
}
```
**0.9 / 1.0.** **Fafnir-only.** `Dazed ↔ Sharp` cancel on application, so this card would eat 2 Sharp
off any gullinbursti holding it — it is safe here precisely because fafnir gives Sharp up in the split.

```json
{
    "id": "grit",
    "name": "Grit",
    "description": "Apply 3 Weakened.",
    "element": "Earth", "target": "Single", "category": "Status", "rarity": "Common",
    "baseCost": 0,
    "constraints": ["not_stunned", "not_asleep", "energy_base"],
    "actions": [{ "type": "STATUS", "status": "Weakened", "stacks": 3, "target": "TARGET" }]
}
```
**1.1 / 1.0** — 0.1 over, deliberate. A 0-cost is the only card a hoarding turn can afford (§6).

```json
{
    "id": "slag_shed",
    "name": "Slag Shed",
    "description": "Remove 2 Poison and 2 Burn from yourself. Gain 2 Bark Shield.",
    "element": "Earth", "target": "Self", "category": "Skill", "rarity": "Common",
    "baseCost": 1,
    "constraints": ["not_stunned", "not_asleep", "energy_base"],
    "actions": [
        { "type": "STATUS", "status": "Poison", "stacks": -2, "target": "SELF" },
        { "type": "STATUS", "status": "Burn", "stacks": -2, "target": "SELF" },
        { "type": "STATUS", "status": "BarkShield", "stacks": 2, "target": "SELF" }
    ]
}
```
**2.9 / 3.0.** Negative stacks now flip positive (ticket 47), so removal scores correctly. Note this
is matchup tech and reads ~0 against a non-DoT deck — hand-price it, do not "fix" it upward.

```json
{
    "id": "motherlode",
    "name": "Motherlode",
    "description": "65 power.",
    "element": "Earth", "target": "Single", "category": "Attack", "rarity": "Uncommon",
    "baseCost": 2,
    "constraints": ["not_stunned", "not_asleep", "energy_base"],
    "actions": [{ "type": "ATTACK", "power": 65, "target": "TARGET" }]
}
```
**6.5 / 6.5.** Deliberately vanilla — it is the card `UNSTOPPABLE_MASS` primes.

```json
{
    "id": "hoardbreaker",
    "name": "Hoardbreaker",
    "description": "90 power. Gain 3 Strengthened.",
    "element": "Earth", "target": "Single", "category": "Attack", "rarity": "Rare",
    "baseCost": 3,
    "constraints": ["not_stunned", "not_asleep", "energy_base"],
    "actions": [
        { "type": "ATTACK", "power": 90, "target": "TARGET" },
        { "type": "STATUS", "status": "Strengthened", "stacks": 3, "target": "SELF" }
    ]
}
```
**10.4 / 10.5.**

```json
{
    "id": "deep_vein",
    "name": "Deep Vein",
    "description": "Spend all Energy: 35 power for each Energy spent.",
    "element": "Earth", "target": "Single", "category": "Attack", "rarity": "Rare",
    "baseCost": "X",
    "constraints": ["not_stunned", "not_asleep", "energy_base"],
    "actions": [{ "type": "ATTACK", "power": 35, "scaling": "ENERGY_SPENT", "target": "TARGET" }]
}
```
**3.5 against the 10.5 band — a floor, not a price.** `numericBaseCost('X')` returns
`X_COST_STATIC_BUDGET = 3`, and powerscale's ATTACK branch has no `ENERGY_SPENT` case, so the flat 35
is all it sees. 35/Energy is `thermal_lance`'s shipped number and lands exactly right here:

| X | power | damage on fafnir |
|---|---|---|
| 1 | 35 | 5.8 HP |
| 2 | 70 | 11.7 HP |
| **3** | **105** | **17.5 HP** — a 3-cost's worth |
| 4 | 140 | 23.4 HP |

**Three verified facts.** X is **not** a player choice — `getEffectiveCardCost` returns
`Math.max(1, currentEnergy)`, always all of it. `ENERGY_SPENT` multiplies the computed damage by
`state.lastEnergySpent`, which the reducer sets to this card's own `finalCost` at
`battleReducer.ts:303` *before* its actions resolve. And no engine work is needed — two X cards
already ship (`thermal_lance`, `firestorm_talon`).

```json
{
    "id": "rust_blood",
    "name": "Rust Blood",
    "description": "45 power. Apply 3 Poison to yourself.",
    "element": "Earth", "target": "Single", "category": "Attack", "rarity": "Common",
    "baseCost": 1,
    "constraints": ["not_stunned", "not_asleep", "energy_base"],
    "actions": [
        { "type": "ATTACK", "power": 45, "target": "TARGET" },
        { "type": "STATUS", "status": "Poison", "stacks": 3, "target": "SELF" }
    ]
}
```
**2.9 / 3.0.** **Poison, not Weakened, is deliberate**: Poison has no duality partner, so the OS's
Strengthened accrues on top of it instead of annihilating against it.

```json
{
    "id": "veinburst",
    "name": "Veinburst",
    "description": "100 power. Apply 4 Poison and 2 Dazed to yourself.",
    "element": "Earth", "target": "Single", "category": "Attack", "rarity": "Rare",
    "baseCost": 2,
    "constraints": ["not_stunned", "not_asleep", "energy_base"],
    "actions": [
        { "type": "ATTACK", "power": 100, "target": "TARGET" },
        { "type": "STATUS", "status": "Poison", "stacks": 4, "target": "SELF" },
        { "type": "STATUS", "status": "Dazed", "stacks": 2, "target": "SELF" }
    ]
}
```
**6.4 / 6.5.** Two distinct debuff types in one card, which is 4 Strengthened a turn from the OS.

```json
{
    "id": "stone_flurry",
    "name": "Stone Flurry",
    "description": "10 power, three times.",
    "element": "Earth", "target": "Single", "category": "Attack", "rarity": "Common",
    "baseCost": 1,
    "constraints": ["not_stunned", "not_asleep", "energy_base"],
    "actions": [{ "type": "ATTACK", "power": 10, "count": 3, "target": "TARGET" }]
}
```
**3.0 / 3.0.**

```json
{
    "id": "crag_barrage",
    "name": "Crag Barrage",
    "description": "18 power, three times. Apply 2 Dazed.",
    "element": "Earth", "target": "Single", "category": "Attack", "rarity": "Uncommon",
    "baseCost": 2,
    "constraints": ["not_stunned", "not_asleep", "energy_base"],
    "actions": [
        { "type": "ATTACK", "power": 18, "count": 3, "target": "TARGET" },
        { "type": "STATUS", "status": "Dazed", "stacks": 2, "target": "TARGET" }
    ]
}
```
**6.4 / 6.5.** The Dazed rider is what stops this being a 2-cost `stone_flurry`: Dazed raises the
damage the target *takes*, so this card sets up the **next** multi-hit rather than compounding its
own. A Sharp rider was considered and rejected for exactly that reason — it would feed the uncapped
scaler in §3.1 from inside the card. **Verify how Dazed's percentage and KINETIC_RAM's flat bonus
compose** (both run through `applyDamageModifiers`) and report the interaction.

Multi-hit templates that already exist and are in no deck: `thistle_barrage` (Nature 8×4),
`gale_slash` (Air 11×2), `sky_dance` (Air 8×3). `count` needs no engine work — powerscale already
multiplies an ATTACK's score by `hitCount`.

---

## 5. Re-costs

**Henry's instruction, applied: price these on the curve, not against the OS that exploits them
best.** Three of the four were left under band in the design pass on the reasoning that
`UNSTOPPABLE_MASS` and `KINETIC_RAM` make them strong; that was the wrong instinct and it is corrected
here. The enabler absorbs it (§3.1), the cards do not.

| card | from | to | score |
|---|---|---|---|
| `stone_bark` | 1e, 15 Bark Shield | **1e, 8 Bark Shield** | 5.4 → **2.9 / 3.0** |
| `keen_edge` | 1e, 1 Sharp + draw | **1e, gain 5 Sharp and draw a card** | 1.7 → **2.9 / 3.0** |
| `shield_shards` | 1e, 2 Sharp + 5 Bark | **1e, gain 4 Sharp and 5 Bark Shield** | 2.4 → **3.1 / 3.0** |
| `spiked_carapace` | 2e, 2 Sharp + 10 Bark | **2e, 20 power. Gain 4 Sharp and 8 Bark Shield** | 4.2 → **6.1 / 6.5** |

`stone_bark` gets the same 15 → 8 cut `glacier_wall` took in ticket 48 — same card, and Earth's only
standing card redline. `spiked_carapace` gains a damage floor so the tanky deck is not five cards that
deal nothing.

Rewrite every description to match the new action values.

---

## 6. OS blocks — `src/engine/data/lib/hooks.json`

Edit as **text**; `hooks.json` does not round-trip through `json.dumps`.

`fafnir_v1` **unchanged** — HOARD_PROTOCOL stays 1:1 with the HP tax
(`CustomFirmware.ts:29-67`). 2:1 was modelled and rejected: it compounds (2 → 4 → 8 → 16 energy by
turn four while the tax grows linearly), and **1:1 is the only stable ratio**. What was missing was
never the rate, it was something to cash into — `deep_vein` is that.

`fafnir_v2` description → *"At the start of Fafnir's turn, he gains 2 Strengthened for each different
debuff on him, then each of those debuffs loses 1 stack."* Hook per §3.3.

`gullinbursti_v1` description → *"Playing a non-Attack card that applies a status primes
Gullinbursti: his next Attack deals 20 additional power. Any other card spends the charge."* Change
the `do` action from `costReduction: 1` to `powerBonus: 20`, keeping `appliesTo: "Attack"`.

`gullinbursti_v2` — `bonus` 1 → **0.5** (§3.1). Description unchanged.

---

## 7. Deck lists — `mingmingRegistry.ts`

```ts
        "fafnir_v1": ["iron_will", "iron_will", "water_slap", "grit", "boulder_smash", "boulder_smash", "slag_shed", "motherlode", "hoardbreaker", "deep_vein", "deep_vein"],
        "fafnir_v2": ["iron_will", "iron_will", "water_slap", "rust_blood", "rust_blood", "boulder_smash", "boulder_smash", "squirrel_away", "veinburst", "veinburst"]
```
```ts
        "gullinbursti_v1": ["water_slap", "keen_edge", "keen_edge", "shield_shards", "shield_shards", "stone_bark", "stone_fist", "stone_fist", "motherlode", "spiked_carapace"],
        "gullinbursti_v2": ["water_slap", "water_slap", "keen_edge", "keen_edge", "shield_shards", "shield_shards", "stone_flurry", "stone_flurry", "crag_barrage", "crag_barrage"]
```

Delete the `// Ticket 13: both slots hold the legacy shared deck` comments above both.

| deck | cards | curve | identity |
|---|---|---|---|
| fafnir_v1 | 11 | 0e×4 / 1e×3 / 2e×1 / 3e×1 / X×2 | **E3 Hoard** — bank, then dump into `deep_vein` |
| fafnir_v2 | 10 | 0e×3 / 1e×5 / 2e×2 | **H5 Anti-Debuff Inversion** — self-Poison feeds the OS |
| gullinbursti_v1 | 10 | 0e×1 / 1e×7 / 2e×2 | **A4 Prime-and-Spike** — tanky, one big hit a turn |
| gullinbursti_v2 | 10 | 0e×2 / 1e×6 / 2e×2 | **A3 Multi-Hit Flurry** — Sharp × hits |

**Why fafnir_v1 is 0e×4 — this is the answer to the AI concern, so do not "improve" it by adding
draw.** A draw card costs 1 Energy, which is the exact resource a hoard deck is trying to bank, so it
is self-defeating; that is why `squirrel_away` is not in v1. Four 0-costs mean the AI never has to
choose between acting and banking — it plays its free cards and ends the turn with Energy intact.

The eval **does** see banking: Energized is priced at `2 × 83 × 0.20 × 0.25` = **8.3 points a stack**,
and the search evaluates END_TURN with 1-turn lookahead through `battleReducer`, so `processPostTurn`
runs and the hoard hook fires inside the leaf state. It under-values banking (a real Energy point is
13.3 points on fafnir), so expect **less** hoarding than optimal, not none. The recoil fires
`onTurnStart`, past the horizon — worth about 1 HP, ignore it.

`rock_throw`, `spike_launch` and `tremor` leave all four decks and stay in the registry as drop-only.
`spike_launch`'s card-side Sharp scaler is redundant next to KINETIC_RAM; `tremor`'s 4.0 is entirely
the ×2.2 Side multiplier and in a 1v1 gate it is a 2-energy card worth 18 power. `rock_throw` →
`water_slap` also retires Earth's 0-cost poke twin.

---

## 8. Gates

Scoped first: `set BALANCE_ONLY=fafnir&& npm run balance`, then `gullinbursti`. Full committed run
once both are in band.

| gate | band | baseline at `218b7a2` |
|---|---|---|
| **`mirror:gullinbursti` turns** | **≤ 30** | **61.0 — open redline, must close** |
| **`mirror:gullinbursti` decided** | **≥ 60%** | **0/400** |
| **`os:gullinbursti` §2.3** | **0.30–0.70** | **0.000 — OUT OF BAND** |
| `mirror:fafnir` turns / decided | ≤ 30, ≥ 60% | 18.3, 400/400 ✓ |
| `os:fafnir` §2.3 | 0.30–0.70 | 0.480 ✓ **do not regress it** |
| control vs all four | report; must not fall | 0.000 / 0.010 / 0.000 / 0.000 (aggregates 0.185 / 0.321) |
| dead cards, **per side** | ≤ 0.35 | 0.009–0.055 |
| FTK | **0** | 0 — **§3.1 is an FTK risk, watch this one** |
| card redlines | `stone_bark` closes; `grit` +0.1 deliberate | 35 total |

All four decks already beat the control, so like ymir a 0.000 that stays 0.000 is not a failure — the
mirror and the §2.3 gap are what must move. `npx tsc -b`, `npx vitest run`, `npx vite build` green
before any balance run.

---

## 9. Blast radius

No card touched here appears in any non-Earth deck — Earth's pool is used only by fafnir and
gullinbursti, so the blast radius is exactly these two species. `water_slap` and `squirrel_away` are
shared neutrals but **unchanged**; only Earth's copy counts move. `BUFF_NEXT_PROGRAM`'s new
`powerBonus` field is additive and `gullinbursti_v1` is its only consumer. **No committed card score
outside this ticket's list may move. If one does, STOP.**

---

## 10. Pre-authorised knobs — max two rounds, ONE change per sim

1. `KINETIC_RAM` bonus 0.5 → 0.25 / 0.75 / 1.0. **1b: add `Math.min(stacks, 8)` to `SHARP_STACKS`
   in `resolveScaling`, matching `STRENGTH_STACK_CAP` — only if the rate knob cannot hold it.**
2. `UNSTOPPABLE_MASS` powerBonus 20 → 10 / 30.
3. `CORRUPTED_GOLD` second currency, all **OFF** at launch — heal 2% maxHP per debuff type / draw 1 at
   2+ types / 1 Regen per type. Turn one on only if fafnir_v2 reads dead against non-Weakened decks.
4. `deep_vein` 35 → 25 / 45 power per Energy.
5. Swap `hoardbreaker` for a third `deep_vein`... **not legal (2-copy cap)** — swap it for a second
   `motherlode` or a 1-cost instead, if the 3-cost never gets cast.
6. `iron_will` 4 Str / 2 Dazed → 3/2 or 4/1.
7. `veinburst` 100 power → 85 / 115; `rust_blood` 45 → 35 / 55.
8. Multi-hit 3 → 2 or 4 hits on `stone_flurry` / `crag_barrage`.
9. `HOARD_PROTOCOL` HP tax 1% → 0% / 2% per hoarded point. **Do not change the 1:1 ratio** (§6).

---

## 11. STOP and report

- **FTK count above 0 on gullinbursti_v2.** That is §3.1 and the answer is knob 1, then 1b.
- `powerBonus` or the reworked `CORRUPTED_GOLD` reads as a no-op — **check `HookSchema.ts` first** and
  log the resolved value inside `HookFactory` before touching any number.
- `deep_vein` play rate is 0%, or its average X at cast is 1. The first means the AI is not seeing the
  card; the second means it is not hoarding, and the deck's whole premise is wrong.
- fafnir's hand hits the 9-card cap and starts losing draws — draw 3 while playing 1–2 cards a turn
  will do this. Report end-of-turn hand size.
- `os:fafnir` falls out of the 0.30–0.70 band it currently passes.
- Any committed card score outside §4/§5 moves.

---

## 12. Deliverables

- Commit hash and `registryHash`.
- Every gate in §8 with its baseline beside it.
- **Real `calculatePowerscale` scores for all ten new cards and four re-costs**, flagged where they
  differ from §4/§5 by more than 0.3.
- **`deep_vein`: play rate, average X at cast, damage per play.** The design assumes X ≈ 3.
- **Fafnir's average Energy spent per turn and end-of-turn hand size** (§7).
- **`crag_barrage`: how Dazed's percentage and KINETIC_RAM's flat bonus compose** (§4).
- **Peak raw Sharp stacks on gullinbursti_v2**, and `crag_barrage` damage per play. The design assumes
  14–18 by turn 3.
- **fafnir_v2 §2.3 and gauntlet reported separately** (§3.3) — the OS is asymmetric by design and an
  averaged number hides it.
- Knob rounds used and any deviation.

Docs on close: this file's `## Resolution`, a `map.md` decision line resolving the **HIGH Earth
overlap flag** open since ticket 08, and a **HANDOFF.md refresh** — **Earth completes at 28/32 decks,
14 of 16 species tuned, only Light left.**

CRLF for `docs/wayfinder` and engine `.ts`; LF for tests, `src/debug` and JSON. `programs.json` must
round-trip byte-exact under `json.dumps(d, indent=4, ensure_ascii=False)` with no trailing newline;
`hooks.json` does NOT — edit it surgically as text. A whole-file diff means the endings were converted.

One commit, author `Henry Dunphy <hdunphy15@gmail.com>` via
`git -c user.name=... -c user.email=... commit --author=...`. Never stage `package-lock.json` or
`node_modules`. Git locks that cannot be unlinked go to `_to_delete/git-locks/`.

---

## Resolution

**Shipped.** Commit `<HASH>`, registryHash `1:baf7456d`, redlines **42 → 41**.
**EARTH COMPLETE — 28/32 decks live, 14 of 16 species tuned. Only Light remains.**

### Gates (§8)

| gate | baseline | shipped | verdict |
|---|---|---|---|
| **`mirror:gullinbursti` turns** | **61.0** | **10.09** | ✓ **TURN_COUNT redline closed** |
| **`mirror:gullinbursti` decided** | **0/400** | **400/400** | ✓ 400 draws → **0** |
| **`os:gullinbursti` §2.3** | **0.000** | **0.490** | ✓ **OS_GAP redline closed** |
| `os:fafnir` §2.3 | 0.480 | **0.596** | ✓ improved, not regressed |
| `mirror:fafnir` turns / decided | 18.34, 400/400 | **6.70**, 400/400 | ✓ |
| control vs fafnir_v1 / v2 | 0.000 / 0.010 | 0.000 / 0.060 | ✓ held |
| control vs gullinbursti_v1 / v2 | 0.000 / 0.000 | 0.000 / 0.000 | ✓ held |
| dead cards, per side | 0.009–0.055 | 0.062–0.236 | ✓ under 0.35 |
| FTK | 0 | **0** on all four | ✓ §3.1's risk did not materialise |
| `stone_bark` | 5.4 / 3.0 | **2.9 / 3.0** | ✓ redline closed |

**Pace collapsed across the whole element**: the control matchups went 20.3 / 20.3 / 16.6 / 18.8 turns
to **7.2 / 6.3 / 9.0 / 8.3**. Like ymir, Earth was never weak — it could not finish.

### The field, which is what actually decided the knobs

| deck | before | after |
|---|---|---|
| fafnir_v1 | 0.398 | 0.398 |
| fafnir_v2 | **0.629** | **0.483** |
| gullinbursti_v1 | 0.417 | **0.563** |
| gullinbursti_v2 | **0.802** | **0.406** |

All four now sit in **0.40–0.56**, the tightest cluster of any element. gullinbursti_v2 was the
strongest deck measured in this whole roster pass before the nerf.

### Card scores — 13 of 14 matched the ticket exactly; one did not, and the reason matters

`slag_shed` scores **1.70 against the ticket's 2.90** — the only card off by more than 0.3.

**Ticket 47's removal cap is the entire delta**, and it is not a mistake in either place. Measured
directly: the two removal actions price at **1.00 capped** (2.20 uncapped), the shield at 0.70, total
1.70. The cap says a card's total self-facing removal cannot exceed `CLEANSE_POWER`, on the argument
that a full cleanse dominates a partial one — so **any** shed card is bounded at 1.0 and a 1-energy
shed can never reach its 2.4 band. That is exactly the consequence written up in
[ticket 51 §5](51-cleanse-rework.md), now demonstrated on a real card rather than argued.

Shipped at 1.70 because the ticket's own instruction says so — *"this is matchup tech and reads ~0
against a non-DoT deck — hand-price it, do not 'fix' it upward."*

Everything else landed on the nose: `iron_will` 0.90, `grit` 1.10, `motherlode` 6.50, `hoardbreaker`
10.40, `deep_vein` 3.50 (a floor, not a price), `rust_blood` 2.90, `veinburst` 6.40, `stone_flurry`
3.00, `crag_barrage` 6.40, `stone_bark` 2.90, `keen_edge` 2.90, `shield_shards` 3.10,
`spiked_carapace` 6.10.

### Knob rounds — the ticket's two, then Henry's call for a third

**Round 1 (both species, one change each, independent firmware/cards so each gate saw exactly one
change):** knob 1 `KINETIC_RAM` 1 → 0.5 → **0.25**, and knob 7 `veinburst` 100 → **85**.

- **fafnir: §2.3 0.210 → 0.596.** Fixed, and better than the 0.480 baseline. Done.
- **gullinbursti: §2.3 0.000, unmoved.** Not a single game.

**Round 2:** knob 2, `UNSTOPPABLE_MASS` 20 → 30 power. **Still 0.000.** Halving the winner's firmware
and raising the loser's payoff by 50% moved the gate by **zero games** between them.

That is the STOP condition, and the field said why. **This was a real power gap, not a counter** —
v1 0.417 against v2 0.802 — so the direction was never in doubt; the knobs were simply pointed at
the wrong thing.

**The structural cause: gullinbursti_v1 was built from gullinbursti_v2's parts.** Five of its ten
cards (`keen_edge` ×2, `shield_shards` ×2, `stone_bark`) generate Sharp, and **the scaler that cashes
Sharp lives in v2's firmware**. v1 carried a mean of 9.2 Sharp with no payoff for it beyond Sharp's
own ±25%-capped effect, and dealt ~27 damage a game against v2's ~81. The two decks were sharing one
resource and only one of them could spend it — which is the ticket-08 identity overlap in its purest
form: the split gave fafnir and gullinbursti different *decks* but left them sharing a *currency*.

**Henry's call, and it is two changes not one:**

1. **`UNSTOPPABLE_MASS` scales on Sharp.** `powerBonus` gained a `scaling` path so the prime reads
   Gullinbursti's own Sharp: **+3 power per stack**. Alone, this took §2.3 **0.000 → 0.780** at 5/stack
   — the single largest one-change move in any of these tickets — and it is the fix, not a knob:
   v1's Sharp finally does something for v1.
2. **`KINETIC_RAM` pays a cost.** Henry: *"it gets bonus power every turn... maybe add a debuff."* It
   now takes **1 Dazed at the start of each of its turns**, and the shape is the elegant part —
   **Dazed and Sharp are duality partners, so the ram blunts its own edge**: the drawback is spent
   cancelling the very resource the OS scales on. At 2 stacks it was far too strong (§2.3 0.950); at
   1 it is a real cost that grows with game length.

Landing sequence, all measured: 5/stack → 0.780; 3/stack → 0.190; 4/stack → 0.590; +1 self-Dazed at
4/stack → 0.800; **3/stack + 1 self-Dazed → 0.490.**

### Deliverables (§12)

- **`deep_vein`: 2.32 plays/game, 14.6 damage/play, X at cast median 2 / mean 2.06 / max 4.** The
  design assumed 3. Not the §11 STOP (that is X = 1) but under target: fafnir_v1 starts its turn on
  **2.22 energy**, so it is banking about a quarter of a point a turn. The card is doing its job; the
  hoard is shallower than designed.
- **`hoardbreaker` is played 0.15 times a game.** The 3-cost effectively never lands. Knob 5 exists
  for exactly this and was not spent — flagged instead.
- **Fafnir's hand size is 3.30**, nowhere near the 9-card cap. §11's draw-flood concern did not
  materialise.
- **`crag_barrage`: Dazed and KINETIC_RAM COMPOUND, they do not merely add.** `onDamageCalculated`
  hooks run at step 3 of `applyDamageModifiers` and the status percentages at step 4, so the flat
  Sharp bonus is added first and Dazed's percentage then multiplies the already-boosted total:
  `(base + 0.25 × Sharp) × (1 + Dazed%)`. That is why the card's own Dazed rider is worth more than it
  looks — it multiplies the *next* multi-hit's firmware bonus too. Measured 12.0 damage/play.
- **Peak raw Sharp: gullinbursti_v1 mean 16.9 / peak 48; v2 mean 13.4 / peak 43.** The design assumed
  14–18 by turn 3, so the count is right — but note **v1 now carries more Sharp than v2**, which is
  the split working: v1 hoards it for the prime, v2 spends it into the ram and sheds it to the
  drawback.
- **fafnir_v2 reported separately as §3.3 requires:** §2.3 **0.596** (v1's side), gauntlet **0.060**,
  field **0.483**. Strengthened saturates at a mean of **10.9 against the 12.5 cap** — the OS runs at
  ceiling in a 5.7-turn game. Henry's call was to keep it and record the saturation.

### Blast radius (§9)

Only Earth rows and the gauntlet aggregates moved; every other species is byte-identical. The
aggregates' win rates barely shifted (slot 1 unchanged, pooled 0.2541 → 0.2557) while their turn
counts fell 9.71 → 8.29 — entirely Earth's pace.

`powerBonus` is additive and `gullinbursti_v1` is its only consumer. `SOURCE_DEBUFF_COUNT` is new and
`fafnir_v2` is its only consumer. **No committed card score outside §4/§5 moved.**

### Redline ledger, 42 → 41

**Closed (3):** `TURN_COUNT mirror:gullinbursti` (61.0 turns / 400 draws), `OS_GAP os:gullinbursti`
(0.50 gap), `CARD_OVER_BUDGET stone_bark` (5.4).
**Added (2), both the deliberate +0.1s:** `grit` 1.1 (§4), `shield_shards` 3.1 (§5).

772/772 tests, `tsc --noEmit` and `vite build` clean.

### Left open

- **`deep_vein` casts at X ≈ 2, not 3**, and `hoardbreaker` at 0.15 plays/game. The hoard is shallower
  than the design assumed; knob 5 and knob 9 are both unspent.
- **fafnir_v2's Strengthened saturates** at 10.9 of 12.5 in a 5.7-turn game.
- **`slag_shed` reads 1.70 against a 2.4 floor** — a consequence of ticket 47's removal cap, and the
  clearest real-card evidence for ticket 51 §5's pricing question.
- **All four decks still beat the control outright.** Earth sits at the strong end of the roster, as
  Ice does.
- **Two tests moved to the new contracts** (`OSGapClosures`, `hookWiring`) because this ticket
  deliberately changed what UNSTOPPABLE_MASS and CORRUPTED_GOLD pay. The prime test asserts the
  resolved `powerBonus` rather than damage, because the synthetic 10-attack-vs-10-defense fixture
  floors a 10-power card to 0 damage either way.
