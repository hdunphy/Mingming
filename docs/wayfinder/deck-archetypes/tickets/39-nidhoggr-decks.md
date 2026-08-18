# Níðhöggr decks (ticket 39) — Dark completes at 20/32

- Type: wayfinder:task
- Status: closed
- Assignee: implementation session (Opus), 2026-08-09
- Blocked by: none

*Design and costing done with Henry on 2026-08-09. Every number below is verified against HEAD
(`28324ef`) — engine line numbers, powerscale scores and the species frame were all re-read this
session, not carried from an older commit. **Re-baseline before you tune anything**: ticket 38
changed `evaluateState`, so any pre-38 nidhoggr number in your head is stale.*

## 0. Read first

- Branch `card-dev`. Nidhoggr finishes Dark. He is the roster's most broken remaining species:
  **396/400 draws at 60.7 turns**, unchanged since baseline.
- First-pass bands: §2.3 **0.30–0.70**, dead cards **≤0.35 per side**, mirror **≤30 turns**, FTK **0**.
  The strict ±15% `osMaxGap` assertion is Henry's explicit "ignore for now".
- **Almost all of this is data.** The only engine change is a 3-line `minStacks` option on
  `HAS_STATUS` (§2). `TRIGGER_STATUS`, `count`-repeat, `HEAL`+`STATUS_CONSUMED`, action-level
  `HEALTH_THRESHOLD` against the enemy, and `ENERGY`/`DRAW` in hook `do` arrays **all already work**.

## 1. The frame — recompute nothing, this is measured

At `BALANCE_LEVEL = 15`, IV 15, base line `105 / 100 / 80 / 2e`:

| | value | source |
|---|---|---|
| maxHP | **87** | `calculateHealth(105, 15, 15)` |
| attack | **41** | `calculateStandardStat(100, 15, 15)` |
| defense | **35** | `calculateStandardStat(80, 15, 15)` |
| mirror damage | **0.312 × power** | `floor(8·p·41/35)/45 × 1.5` STAB; mono-Dark, no type interaction |
| pool | **278 power** | 87 / 0.312 |
| 1 Poison stack | **0.87 HP/turn = 2.79 power/turn** | `max(1, floor(87·S/100))` |

`POWER_PER_PERCENT_MAXHP = 3` is nearly exact on his frame, so the model's poison price is honest here.

## 2. Engine work — one change, three lines

`ConditionValidator.evaluateCardConstraint`'s `HAS_STATUS` branch ignores stack counts. Add an
optional `minStacks`:

```ts
            case 'HAS_STATUS': {
                const held = subject.statusEffects.find(s => s.type === constraint.value);
                if (!held) return false;
                // Ticket 39: optional stack floor so a payoff card can refuse to be
                // played early. The AI validates through this same path
                // (TacticalAI.ts:285 -> validateProgramConstraints), which is the
                // point: without it the search cashes wither_feast at the first stack
                // it sees and the sim measures a card nobody would ever play that way.
                if (constraint.minStacks !== undefined && held.stacks < constraint.minStacks) return false;
                break;
            }
```

Add `readonly minStacks?: number;` to `ProgramConstraint` in `types.ts:54`. Nothing else — the
action-level conditional path (`battleReducer.ts:368`, `:565`) and the card path
(`validateProgramConstraints`) both funnel through `validateSingleConstraint` into the same function.

Two new entries in `src/engine/data/lib/constraints.json`:

```json
    "self_poisoned": {
        "type": "HAS_STATUS",
        "target": "SELF",
        "value": "Poison"
    },
    "target_poisoned_6": {
        "type": "HAS_STATUS",
        "target": "TARGET",
        "value": "Poison",
        "minStacks": 6
    }
```

## 3. Why ROOT_CORRUPTION changes what a good poison card looks like

**Verified ordering.** Statuses tick and decay at `battleReducer.ts:659–674`; `onTurnEnd` hooks fire
at `:806–815`. The sequence each opponent turn is *tick → decay 1 → ROOT_CORRUPTION re-adds 1*,
gated on `sourceStatus.minStacks: 1`.

1. **At 2+ stacks poison is permanent.** Net decay zero, forever.
2. **At exactly 1 stack it fades** — the tick decays it to 0, the instance is removed, and the guard
   fails before the hook can re-add. The OS description is accurate. **A "1 Poison" card is a trap on
   a clean target**, which is why `rot_seed` applies 2.

**The shape inverts.** Normal poison is triangular (`1.5·S(S+1)`, what powerscale charges).
Corrupted poison is linear in turns (`2.79·S·T`). Small applications gain the most:

| stacks applied | printed price | value at 5 turns left | ratio |
|---|---|---|---|
| 2 | 9p | 28p | **3.1×** |
| 3 | 18p | 42p | 2.3× |
| 4 | 30p | 56p | 1.9× |
| 5 | 45p | 70p | 1.6× |
| 6 | 63p | 84p | 1.3× |

So the 0e/1e poison cards are the payoff and a big 2e dump is the worst rate in the deck — which is
why `blight_bloom` spends most of its budget on 35 power rather than on stacks.

## 4. `wither_feast` — the detonate, and what M means

```json
{ "type": "TRIGGER_STATUS", "status": "Poison", "target": "TARGET", "count": 3 },
{ "type": "STATUS", "status": "Poison", "consume": true, "target": "TARGET" }
```

`TriggerStatusExecutor` (`ActionExecutors.ts:442`) calls `PoisonBehavior.endTurn` and applies the
damage, but **never writes back `updatedInstance` — so it does not decrement stacks.** All three
ticks land at full strength. `battleReducer.ts:344` (`hitCount = action.count || 1`) repeats any
action type except DISCARD, so `count: 3` is the whole implementation. The damage routes through the
HP mutation path (`resolutionEngine.ts:23–60`) into `handleAttack`, so it fires threshold crossings
and `onStatusDamageCalculated` exactly like a natural tick. Precedent: `toxic_surge` already ships
`TRIGGER_STATUS`.

> **M is how many turns of poison you are cashing in.** Stacks are permanent under this OS, so
> holding pays one tick per turn forever; cashing M ticks now instead of T ticks later breaks even
> at **M = T**.

Damage at maxHp 87 (`floor(0.87 × S) × M` HP, and the power equivalent at 0.312 HP/power):

| stacks | M=1 | M=2 | **M=3** | M=4 | M=5 |
|---|---|---|---|---|---|
| 4 | 3 HP / 10p | 6 / 19 | **9 / 29** | 12 / 38 | 15 / 48 |
| 6 | 5 / 16 | 10 / 32 | **15 / 48** | 20 / 64 | 25 / 80 |
| 8 | 6 / 19 | 12 / 38 | **18 / 58** | 24 / 77 | 30 / 96 |
| 10 | 8 / 26 | 16 / 51 | **24 / 77** | 32 / 102 | 40 / 128 |
| 12 | 10 / 32 | 20 / 64 | **30 / 96** | 40 / 128 | 50 / 160 |
| 14 | 12 / 38 | 24 / 77 | **36 / 115** | 48 / 154 | 60 / 192 |

**Ship M = 3. Knob 2–5 (Henry).** Three reasons it is 3: break-even at T = 3 puts the decision in the
back half of a 5–6 turn game; the deck applies ~5 stacks/turn, so M = 3 sits on the 65-power band at
S ≈ 10 and runs to 1.5× band at S ≈ 13 — underperform early, overperform late, per Henry's law, and
**do not cap pre-emptively**; and it is the specific asymmetry that should break the draw rate (see §9).

**The card scores 0.00 with `manualReview: ["TRIGGER_STATUS"]` and that is correct** — it is
hand-priced, like `scavenge_data`/`reprogram`/`purify`. Do not "fix" it to budget.

## 5. Cards

### 5.1 New — `src/engine/data/programs.json`

```json
{
    "id": "rot_seed",
    "name": "Rot Seed",
    "description": "Add 2 stacks of Poison.",
    "element": "Dark",
    "target": "Single",
    "category": "Status",
    "rarity": "Common",
    "baseCost": 0,
    "constraints": ["not_stunned", "not_asleep", "energy_base"],
    "actions": [
        { "type": "STATUS", "status": "Poison", "stacks": 2, "target": "TARGET" }
    ]
}
```
**0.9 / 1.0.** Two stacks, not one, so it clears the fade threshold on its own (§3).

```json
{
    "id": "blight_bloom",
    "name": "Blight Bloom",
    "description": "35 power. Add 4 stacks of Poison.",
    "element": "Dark",
    "target": "Single",
    "category": "Attack",
    "rarity": "Uncommon",
    "baseCost": 2,
    "constraints": ["not_stunned", "not_asleep", "energy_base"],
    "actions": [
        { "type": "ATTACK", "power": 35, "target": "TARGET" },
        { "type": "STATUS", "status": "Poison", "stacks": 4, "target": "TARGET" }
    ]
}
```
**6.5 / 6.5.**

```json
{
    "id": "wither_feast",
    "name": "Wither Feast",
    "description": "Trigger the target's Poison three times, then consume it.",
    "element": "Dark",
    "target": "Single",
    "category": "Attack",
    "rarity": "Rare",
    "baseCost": 2,
    "constraints": ["not_stunned", "not_asleep", "energy_base", "target_poisoned_6"],
    "actions": [
        { "type": "TRIGGER_STATUS", "status": "Poison", "target": "TARGET", "count": 3 },
        { "type": "STATUS", "status": "Poison", "consume": true, "target": "TARGET" }
    ]
}
```
**0.00, manual review.** Hand-priced 48–96 power depending on stacks at cast.

```json
{
    "id": "rend_marrow",
    "name": "Rend Marrow",
    "description": "40 power. +35 power if the target is below half HP.",
    "element": "Dark",
    "target": "Single",
    "category": "Attack",
    "rarity": "Rare",
    "baseCost": 2,
    "constraints": ["not_stunned", "not_asleep", "energy_base"],
    "actions": [
        { "type": "ATTACK", "power": 40, "target": "TARGET" },
        { "type": "ATTACK", "power": 35, "target": "TARGET", "conditionals": [{ "type": "HEALTH_THRESHOLD", "target": "TARGET", "value": "LT:50" }] }
    ]
}
```
**6.5 / 6.5.** No engine work: `battleReducer.ts:368–370` resolves an action conditional's subject
from its `target` field, so a non-`SELF` target reads the *enemy's* health bar. Nothing else in the
roster watches it. Note the lone `HEALTH_THRESHOLD` still takes the 0.7 conditional discount and is
banked as a one-member exclusivity group — same score either way, no action needed.

```json
{
    "id": "bloodletting",
    "name": "Bloodletting",
    "description": "18 power. Add 2 stacks of Poison to yourself.",
    "element": "Dark",
    "target": "Single",
    "category": "Attack",
    "rarity": "Common",
    "baseCost": 0,
    "constraints": ["not_stunned", "not_asleep", "energy_base"],
    "actions": [
        { "type": "ATTACK", "power": 18, "target": "TARGET" },
        { "type": "STATUS", "status": "Poison", "stacks": 2, "target": "SELF" }
    ]
}
```
**1.0 / 1.0 exactly.** 5.6 HP of STAB damage at 0e for a 2 HP self-cost, versus `water_slap`'s 2.5 HP
— the Huldra pattern, where a drawback that is nearly free for this species pays for real power.
**Watch this one:** against a **v1** opponent, *their* ROOT_CORRUPTION maintains v2's self-inflicted
Poison permanently (`when.source: "OPPONENT"` reads as "the unit whose turn ended", which in that
matchup is v2). That is the §2.3 gate matchup, and `umbral_feast` is the answer to it. If v2's
self-poison measures as a net loss there, the knob is `stacks` 2 → 1, then swapping Poison for Dazed
(`19 power. Apply 2 Dazed to yourself.` also scores 1.0 and has no such interaction).

### 5.2 Revised — existing cards

Both poison cards were flagged in HANDOFF as **nidhoggr's to fix, not Hel's**. Blast radius on Hel is
one card (`venom_shade` sits in `hel_v2`), and §2.3 is a same-species mirror, so a symmetric card
buff moves pace and dead cards, not win rate.

| card | from | to | score |
|---|---|---|---|
| `venom_shade` | "Add 3 stacks of Poison." (1.8) | **"12 power. Add 3 stacks of Poison."** — prepend `{ "type": "ATTACK", "power": 12, "target": "TARGET" }`, `category` → `"Attack"` | **3.0 / 3.0** |
| `curse_mark` | "Add 2 stacks of Poison + 1 Weakened." (1.3) | **"17 power. Add 2 stacks of Poison + 1 Weakened."** — prepend `{ "type": "ATTACK", "power": 17, "target": "TARGET" }`, `category` → `"Attack"` | **3.0 / 3.0** |
| `leech_strike` | "19 power. Heal 10 HP." (`healOverride`) | **"15 power. Heal 20 power."** — replace the HEAL action with `{ "type": "HEAL", "power": 20, "target": "SELF" }` | **2.9 / 3.0** |
| `umbral_feast` | "Consume Poison to heal 10 HP per stack." (enemy-facing, `healOverride`) | **self-targeting and power-based**, below | **0.3** (scorer blind — hand-priced ~42p) |

```json
{
    "id": "umbral_feast",
    "name": "Umbral Feast",
    "description": "Consume your own Poison. Heal 8 power per stack consumed.",
    "element": "Dark",
    "target": "Self",
    "category": "Heal",
    "rarity": "Uncommon",
    "baseCost": 1,
    "constraints": ["not_stunned", "not_asleep", "energy_base", "self_poisoned"],
    "actions": [
        { "type": "STATUS", "status": "Poison", "consume": true, "target": "SELF" },
        { "type": "HEAL", "power": 8, "scaling": "STATUS_CONSUMED", "target": "SELF" }
    ]
}
```

Works today: `battleReducer.ts:352` forces `target: 'SELF'` actions onto the caster, and
`HealExecutor` (`:255–257`) multiplies the *computed* heal by `lastStatusConsumed`, so this is
power-based and level-proof. Hand-priced:

| stacks consumed | cleanse value | heal | total | vs 1e band 30p |
|---|---|---|---|---|
| 2 | 9p | 3.5 HP = 16p | 25p | under |
| 3 | 18p | 5.2 HP = 24p | **42p** | 1.4× |
| 4 | 30p | 7.0 HP = 32p | 62p | 2.1× |

**"Reduce instead of remove" was considered and rejected as too expensive.** A partial removal is
`stacks: -3`, which takes a different branch and **never sets `lastStatusConsumed`**, so a scaled
heal could not read it. Full consume is free; partial consume needs a new `amount` field on the
consume path. **If it measures too strong, cut the heal rate, not the removal.**

### 5.3 Why the heals are so small — Henry's call, and its price

Henry's decision: **all heals are power-based; flat `healOverride` heals should be removed because
they do not scale with level.** He is right, and the bug behind them is worse than a style
preference: **`powerscale.ts:341` prices `healOverride` as if it were curve power**
(`action.power || action.healOverride || 0`) while `ActionExecutors.ts:252` treats it as literal HP.
That is exactly the `damageOverride` bug ticket 28 fixed on the ATTACK side; the symmetric fix was
never applied to HEAL.

The budget reality on an 87 HP pool: **a 1e card that does nothing but heal restores ~6.6 HP; a 2e
card restores ~14 HP.** So `leech_strike` at 15 power + heal power 20 heals **4.3 HP** — small, and
correct. Do not "fix" it upward.

**Do NOT convert the other seven `healOverride` cards in this ticket.** They span Water / Light /
Nature / Dark and re-gate four tuned species; that is its own ticket with a full run. Recorded in §10.

## 6. OS change — BLOOD_SCENT pays in tempo

Replace the `nidhoggr_v2` entry's hooks and description in `src/engine/data/lib/hooks.json`
(edit as text — that file does not round-trip through `json.dumps`):

```json
    "nidhoggr_v2": {
        "id": "nidhoggr_v2",
        "name": "BLOOD_SCENT_OS",
        "description": "Whenever any Mingming drops below half of its maximum HP, Níðhöggr smells blood: gain 1 Energy and draw a card. Healing above half re-arms the scent.",
        "hooks": [
            {
                "id": "nidhoggr_v2_bloodscent",
                "trigger": "onHpThresholdCrossed",
                "priority": 40,
                "do": [
                    {
                        "type": "ENERGY",
                        "target": "SELF",
                        "amount": 1
                    },
                    {
                        "type": "DRAW",
                        "target": "SELF",
                        "amount": 1
                    },
                    {
                        "type": "LOG",
                        "text": "{owner}'s BLOOD_SCENT_OS smells blood! +1 Energy, draw 1."
                    }
                ]
            }
        ]
    },
```

**Why.** The shipped +2 Strengthened / +2 Sharp pays `2 crossings × (2×5 + 2×3.5) = 34 power per
game` — one 1-energy card's worth across an entire match, arriving *after* the kill window opens.
Energy + draw is 55 per proc. It also reads as the archetype: the window opens and you get an extra
action to use it.

No engine work — `ENERGY` and `DRAW` already appear in four existing hooks' `do` arrays and both
`amount` fields are in `HookSchema` (which matters: **zod strips unknown keys**, handoff 8c2).

**Known timing asymmetry, deliberately accepted.** `processPreTurn` sets
`currentEnergy = maxEnergy + Energized` at the start of each of his turns, so **Energy granted during
the opponent's turn is wiped.** The enemy crossing below half happens on *his* turn → both halves
pay; him crossing below half happens on the *enemy's* turn → only the draw survives. Effective payout
~70 power/game, not 110. Henry asked whether it could branch on whose turn it is; the answer is that
`HookConditionSchema` has no active-side predicate, adding one is a hidden branch in a data hook
(the exact failure mode of 8c2), and the card text becomes unreadable. **Ship immediate `ENERGY`.**
If §8's per-side proc counts say the self-crossing half is worth recovering, swapping `ENERGY` for
`{ "type": "STATUS", "status": "Energized", "stacks": 1, "target": "SELF" }` is timing-proof, one
turn late, and a pure data change.

**Also verified:** the hook fires on the *enemy* crossing. `fireHpThresholdCrossed`
(`resolutionEngine.ts:337`) is called from all three HP-loss sites for any unit, and
`executeResolutionStackInner` collects hooks from both parties. Re-arming is automatic —
`crossedDownHalf` only asks "was ≥50%, now <50%", there is no latch.

## 7. The decks — `src/engine/data/mingmingRegistry.ts:668–671`

```ts
            "nidhoggr_v1": ["rot_seed", "rot_seed", "shadow_claw", "water_slap", "venom_shade", "venom_shade", "curse_mark", "blight_bloom", "blight_bloom", "wither_feast"],
            "nidhoggr_v2": ["shadow_claw", "shadow_claw", "bloodletting", "bloodletting", "leech_strike", "leech_strike", "umbral_feast", "night_terror", "rend_marrow", "rend_marrow"]
```

Both 10 cards, ≤2 copies, curve **0e×4 / 1e×3 / 2e×3** — exactly three 2-energy instances, per ticket
31's finding that on a 2-Energy economy a fourth locks out the 1e cards.

### nidhoggr_v1 — ROOT_CORRUPTION · poison battery

| card | cost | text | score / band |
|---|---|---|---|
| `rot_seed` ×2 | 0e | Add 2 stacks of Poison. | 0.9 / 1.0 |
| `shadow_claw` ×1 | 0e | 5 power. Apply 1 Weakened. | 0.9 / 1.0 |
| `water_slap` ×1 | 0e | 12 power. *(neutral tier)* | 1.2 / 1.0 |
| `venom_shade` ×2 | 1e | 12 power. Add 3 stacks of Poison. | 3.0 / 3.0 |
| `curse_mark` ×1 | 1e | 17 power. Add 2 Poison + 1 Weakened. | 3.0 / 3.0 |
| `blight_bloom` ×2 | 2e | 35 power. Add 4 stacks of Poison. | 6.5 / 6.5 |
| `wither_feast` ×1 | 2e | Trigger the target's Poison three times, then consume it. | 0.00 *(manual)* |

The identity: poison stops being a decaying burst and becomes a permanent *rate*, and the deck's
question every turn is hold or cash. Distinct from jormungandr_v2, which is poison as pure attrition
with no way to convert.

### nidhoggr_v2 — BLOOD_SCENT · executioner

| card | cost | text | score / band |
|---|---|---|---|
| `shadow_claw` ×2 | 0e | 5 power. Apply 1 Weakened. | 0.9 / 1.0 |
| `bloodletting` ×2 | 0e | 18 power. Add 2 stacks of Poison to yourself. | 1.0 / 1.0 |
| `leech_strike` ×2 | 1e | 15 power. Heal 20 power. | 2.9 / 3.0 |
| `umbral_feast` ×1 | 1e | Consume your own Poison. Heal 8 power per stack. | 0.3 *(hand ~42p)* |
| `night_terror` ×1 | 2e | 54 power. Apply 2 Weakened. | 6.1 / 6.5 |
| `rend_marrow` ×2 | 2e | 40 power. +35 power if the target is below half HP. | 6.5 / 6.5 |

The loop: `night_terror` and `leech_strike` push the enemy under half → BLOOD_SCENT pays Energy and a
card → `rend_marrow` swings at +87.5% with the energy to follow up. Nothing else in the roster reads
the *enemy's* health bar, which is what makes him an executioner rather than a berserker.

**Deliberate deviation:** v2 has no None-element card, so it breaks the rulebook's neutral tier.
`hamstring` (1e, 20 power + 2 Weakened, 2.7/3.0) is the swap if it needs one, at the cost of the
third 2e slot.

## 8. Knobs, in the order to try them

1. **`wither_feast` `count`: 3 → 2..5.** The primary dial. Ship at 3.
2. **`target_poisoned_6` `minStacks`: 6 → 4..10.** How long the AI is forced to hold. Raising it
   makes the sim measure something closer to real play; watch the dead-card metric, since the card is
   unplayable below the floor.
3. **`bloodletting` self-Poison 2 → 1**, then Poison → Dazed (19 power, 2 Dazed), if the v1
   ROOT_CORRUPTION interaction (§5.1) makes it a net loss in the gate matchup.
4. **`umbral_feast` HEAL power 8 → 5..12.**
5. **`blight_bloom` 35 power / 4 Poison**, trading one against the other at ~7.5 power per stack.
6. **BLOOD_SCENT `ENERGY` → `Energized`** (§6) if the per-side proc counts justify it.
7. **`leech_strike` to 2e** (40 power + heal power 30, 6.0/6.5, heals 6.5 HP) if v2 wants sustain as
   an identity rather than a garnish. This costs the third 2e slot; take `night_terror` out.

## 9. What the numbers should do, and the one prediction worth checking

**v1's 396/400 draws at 60.7 turns are structural, not tuning.** Both sides run permanent,
unremovable poison and both clocks tick at the same rate, so neither side can convert. Direct damage
alone shortens the game but preserves the symmetry — **the detonate is the asymmetry**, because
whoever cashes first wins. If the draw rate survives the deck pass, look at `count` before anything
else.

Report on close:
- §2.3, mirror turns, decided count, dead cards **per side**, FTK — both OSes.
- **`wither_feast`: play rate, `dmg/play`, and peak Poison-at-cast.** The AI cannot hold for lethal,
  so the measured value is a **floor**, not a price (same caveat ticket 32 carries for `slander`).
  Do not tune `count` down on a low `dmg/play` alone — report the stack count it actually cashed at.
- **BLOOD_SCENT procs per game, split by which unit crossed.** That is the number that decides §6's
  `ENERGY`-vs-`Energized` question.
- Peak Poison on the enemy in v1, per turn, to confirm the permanence math in §3.
- Whether `hel_v2` moved at all on the `venom_shade` buff (expect pace, not §2.3).

## 10. Findings recorded here, NOT to be fixed in this ticket

1. **`healOverride` is priced as curve power** (`powerscale.ts:341`) but is literal HP
   (`ActionExecutors.ts:252`) — the `damageOverride` bug ticket 28 fixed for ATTACK, never applied to
   HEAL. Re-priced against `ASSUMED_MAX_HP = 75` at heal's 4-power-per-1% rate, **all nine cards using
   it are over band**: `healing_light` 1.4 → 6.8, `natures_touch` 2.5 → 5.1, `drain_life` 3.2 → 7.3,
   `leech_strike` 2.6 → 5.3, `rejuvenation`/`dawns_respite` 2.0 → 4.8, `ash_reclamation` 1.1 → 3.9,
   `umbral_feast` 1.0 → 3.7, `healing_mist` 0.3 → 1.7. Reproducing today's HP output in `power` costs
   51 for 10 HP and 101 for 20. **Own ticket, full run.** It compounds with hel_v2's
   `onHealCalculated ×1.5`, which multiplies flat heals too.
2. **powerscale never applies `STATUS_CONSUMED` to HEAL** — ticket 33 added the multiplier to the
   STATUS branch and left the original consumer reading literal stacks. `umbral_feast` and
   `ash_reclamation` are scored as one stack consumed.
3. **A `consume: true` STATUS action is scored as if it APPLIED the status.** `stacks` defaults to 1,
   so a Poison consume *adds* 0.3 to a card's score instead of subtracting. Same sign-error family as
   ticket 29's `soothe` finding (HANDOFF item 14).

## 11. STOP and report

- The `minStacks` addition breaks an existing constraint test, or `HAS_STATUS` turns out to be
  evaluated somewhere that does not route through `evaluateCardConstraint`.
- `count` on `TRIGGER_STATUS` does not repeat (i.e. the reducer's `hitCount` path is bypassed for it),
  or `TriggerStatusExecutor` turns out to decrement stacks at HEAD.
- `wither_feast` reads 0% play rate — that means the `target_poisoned_6` gate is never satisfied, or
  the AI is not seeing the constraint; do not "fix" it by removing the gate without saying so.
- Changing `venom_shade`/`curse_mark` from `category: "Status"` to `"Attack"` changes any hook's
  `programCategoryIn`/`programCategoryNot` match. (Checked at HEAD: only `gullinbursti_v1` and
  `audhumbla_v1` use those, both `source: "SELF"`, so this should be inert — report if not.)
- v2's self-poison from `bloodletting` kills him in the v1 matchup, or the mirror stalls on mutual
  self-poison.
- Any change here moves a **tuned** species other than Hel by more than the ±4 §2.3 noise band.

---

## Resolution (implementation session, 2026-08-09)

**Dark is complete at 20/32.** Everything in §2, §4, §5, §6 and §7 shipped as written. Registry
`1:a045b578`, 766/766 tests, `tsc -b` and `vite build` clean.

### Gate

| metric | before | after | band |
|---|---|---|---|
| §2.3 | **0.000** | **0.310** | 0.30–0.70 ✓ |
| mirror turns | **60.65** | **4.58** | ≤30 ✓ |
| mirror decided | 4/400 | **400/400** | ≥60% ✓ |
| dead cards, os / mirror | | 0.127 / 0.189 | ≤0.35 ✓ |
| ftk | 0 | 0 | 0 ✓ |

**Redlines 45 → 45.** `TURN_COUNT mirror:nidhoggr` **cleared** — the stall this ticket existed to
kill. `OS_GAP os:nidhoggr` gained, which is the strict ±15% assertion the first pass ignores.
**Every other tuned matchup is byte-identical except hel**, which moved 0.508 → 0.545 on the
`venom_shade` buff — §9 asked for that check and predicted pace rather than §2.3; it moved both, but
inside hel's documented ±8 and still in band.

### It took four knobs, and one of them had to go backwards

1. **`wither_feast` count 3 → 5** (top of range). At 3 the detonate fired **7 times in 100 games**:
   cashing beat holding by only `3S − 2.5S`, so the AI preferred `blight_bloom`. This is the
   knock-on from ticket 40's horizon cap — the two numbers are coupled.
2. **`minStacks` is inert.** 4 / 6 / 8 all measured 26–27%; the AI holds to ~18 stacks regardless of
   the floor, so the gate never binds. Left at 6.
3. **`bloodletting` self-Poison → self-Dazed made it WORSE** (0.290 → 0.170) and was reverted. §5.1's
   warning runs in both directions: v1's ROOT_CORRUPTION makes v2's **own** self-inflicted Poison
   permanent, so that drawback was working for v1 all along.
4. **`umbral_feast` heal 8 → 5**, the authorised floor. Heal **3** reached 0.390 but is outside the
   5–12 range and was not taken. **This is the strongest remaining lever if more margin is wanted.**
5. **`blight_bloom` 35 power / 4 Poison → 50 / 2**, trading Poison *away* — see below.
7. **`leech_strike` to 2e**, `night_terror` out. This is what crossed the line, 0.290 → 0.310.
   §7 does not say what replaces it: `water_slap` shipped, and `hamstring` (which §7 names, and which
   would have fixed the missing neutral tier) was measured at **0.250** and rejected.

### The finding: v1 was feeding its win condition to v2

`umbral_feast` consumes **its own** Poison — and in the gate matchup that Poison is overwhelmingly
what v1 put there. v1 builds ~19 stacks and v2 eats them for **~33 HP a cast, 2.2 casts a game**. The
deck was converting its own clock into the opponent's sustain.

That is why trading Poison away for raw power on `blight_bloom` helped: **direct damage is the one
thing `umbral_feast` cannot convert.** It is the mirror image of §3's lesson — under ROOT_CORRUPTION
small poison applications have the best rate, but only if the enemy cannot cash them.

### Reported per §9 and §12

- `wither_feast`: **38.0 damage a play at 18.4 stacks** at count 3, cast 0.07/game — a floor, not a
  price, exactly as §4 and §9 warned. Raising count to 5 is what made the AI reach for it.
- **BLOOD_SCENT procs: 0.87/game enemy-crossed, 0.64/game self-crossed.** §6's `ENERGY`-vs-`Energized`
  question is answered: the self-crossing half is small, the Energy-wipe asymmetry costs little,
  **keep `ENERGY`.**
- Peak Poison on the enemy: **19.1 average** — §3's permanence math confirmed.
- Card scores all in band: `rot_seed` 0.90, `bloodletting` 1.00, `venom_shade` 3.00, `curse_mark`
  3.00, `blight_bloom` 5.90, `leech_strike` 6.00, `rend_marrow` 6.50. `wither_feast` 0.30 (manual
  review) and `umbral_feast` 0.10 (scorer-blind) are the two §4/§10 predicted.
- `category` Status → Attack on `venom_shade`/`curse_mark` was inert as §11 predicted.
- No X-cost card reaches him, so the `numericBaseCost()` hazard stays latent.
