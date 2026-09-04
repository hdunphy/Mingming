# Ticket 136 — implementation prompt (paste into a fresh agent session)

You are implementing a **ruled balance package** on branch `legion/ai-perf` in
`C:\Users\hdunp\Documents\GameDev\Unity\GitHub\Mingming-Balancing` (React 19 / TypeScript / Vite;
headless engine in `src/engine`, balance instruments in `src/debug/balance` and `scratch/`).
Every change below was designed with Henry and **measured** (ticket 136,
`docs/wayfinder/deck-archetypes/tickets/136-per-deck-rebalance.md`). Your job is to land it exactly
as written, one commit per numbered ticket, and report the gate numbers. **You do not tune.** If a
gate fails outside the pre-authorized knobs, STOP and report.

Read `docs/wayfinder/deck-archetypes/HANDOFF-back-in-band.md` §7 (how Henry works) and §8
(environment traps) first. Two that will bite: `npx tsc --noEmit` checks nothing — use `npx tsc -b`;
and `programs.json` / `hooks.json` / `mingmingRegistry.ts` have mixed line endings — make surgical
edits, never rewrite a file (a 4-line change that shows as a 14,000-line diff means endings were
converted; revert and redo).

---

## The package — what ships and the measured target

| # | change | measured target (full grid, 1v1 beamless) |
|---|---|---|
| 136a | ×10 bug fix: `TOXIN_FANG_OS` and `KINETIC_RAM_OS` flat `bonus` | jormungandr_v2 → ~62, gullinbursti_v2 → ~40 |
| 136b | Regen 3% → 2% per turn, and the glossary text corrected | — |
| 136c | hexbloom: 1 Poison per Weakened, then consumes the Weakened | huldra_v1 91.8 → ~69 |
| 136d | species stats: ratatoskr Energy 3→2; fafnir Energy 2→3; draugr Energy 2→3 and cardDraw 4→3 | ratatoskr ~60/54, fafnir ~54/34, draugr ~52/65 |
| 136e | sleipnir_v1 MOMENTUM_DRIVE: ramp clause removed | sleipnir_v1 → ~58 |
| 136f | kraken_v1: OS 2 Dazed per draw; whirlpool 2 Dazed; `crushing_depths` replaces `surge_protection` | kraken_v1 → ~54 |
| 136g | kraken_v2: capacitor 3 Energized (no Sharp); `boiling_surge` replaces `surge_protection`; `scald` ×2 replaces `water_slap` ×2 | kraken_v2 → ~65 |

Full package grid: mean 49.9, sd 14.9, 26/32 in band (35–80). Was 49.9 / 19.4 / 22.


## Full-grid targets (package build, 1v1 beamless, seed base grid, 30 iterations)

| deck | target | deck | target |
|---|---|---|---|
| nidhoggr_v1 | 76.8 | jormungandr_v1 | 75.0 |
| huldra_v1 | 68.7 | audhumbla_v1 | 66.4 |
| fenrir_v2 | 65.9 | draugr_v2 | 65.0 |
| kraken_v2 | 64.9 | jormungandr_v2 | 62.1 |
| hraesvelgr_v1 | 61.0 | ratatoskr_v1 | 60.2 |
| huldra_v2 | 60.0 | sleipnir_v1 | 58.1 |
| gullinbursti_v1 | 54.6 | fafnir_v1 | 54.1 |
| ratatoskr_v2 | 53.7 | kraken_v1 | 53.6 |
| valkyrie_v1 | 52.9 | draugr_v1 | 52.5 |
| skoll_v2 | 49.6 | ymir_v1 | 47.0 |
| gullinbursti_v2 | 40.4 | hel_v1 | 38.5 |
| ymir_v2 | 38.1 | audhumbla_v2 | 36.6 |
| skoll_v1 | 36.5 | valkyrie_v2 | 36.1 |
| fafnir_v2 | 34.4 | sleipnir_v2 | 30.6 |
| nidhoggr_v2 | 28.6 | hraesvelgr_v2 | 26.1 |
| fenrir_v1 | 24.7 | hel_v2 | 24.5 |

---

## 136a — the ×10 that missed two firmwares

`src/engine/core/HookFactory.ts` `onDamageCalculated` adds a hook's flat `bonus` AFTER
`calculateDamage`, which ticket 131c multiplied by 10. Two hooks carry a flat bonus and were left
behind. In `src/engine/data/lib/hooks.json`:

- `jorm_v2_toxin_fang`: `"bonus": 1` → `"bonus": 10`
- `gullin_v2_ram`: `"bonus": 0.25` → `"bonus": 2.5`

Descriptions: TOXIN_FANG_OS says "+1 damage per Poison stack" → "+10 damage per Poison stack".
KINETIC_RAM_OS's text carries no number; leave it. Grep tests for `bonus: 1` / `0.25` on these
hooks and update the pinned numbers (`hookWiring.test.ts`, `OSReworks.test.ts` are the likely
ones).

## 136b — Regen 2%

`src/engine/StatusBehaviors.ts`: `const REGEN_PERCENT_PER_TURN = 0.03;` → `0.02`.
`src/engine/data/statusGlossary.ts` Regen description is WRONG today ("restores 5 HP per stack") —
replace with: `'At the start of your turn, restores 2% of max HP, then loses 1 stack (stacks are turns).'`
Update `statusGlossary.test.ts` / `statusPreview.test.ts` if they pin the old text or 3%.

## 136c — hexbloom

`src/engine/data/programs.json`, `hexbloom`: the Poison action's `"stacks": 2` → `1`, and append a
second action after it (schema template: `wither_feast`'s consume action):

```json
{ "type": "STATUS", "status": "Weakened", "consume": true, "target": "TARGET" }
```
Description → `"Apply 1 Poison per stack of Weakened on the target, then remove the Weakened."`
`anyStatusConsume.test.ts` references hexbloom as the "reads without consuming" precedent — read it;
if it asserts hexbloom leaves Weakened behind, update the assertion, and update the comment block
in `ActionExecutors.ts` (~line 302, "StatusExecutor's hexbloom precedent") which is now stale.

## 136d — species stats (`src/engine/data/mingmingRegistry.ts`)

- `ratatoskr.baseStats.energy: 3` → `2`. Update the species comment ("offset by 3 Energy").
- `fafnir.baseStats.energy: 2` → `3`.
- `draugr.baseStats.energy: 2` → `3`; `draugr.cardDraw: 4` → `3`.

`drawFormula.test.ts`, `createRun.test.ts`, `runSlice.loadout.test.ts` may pin species energy or
draw — update pinned VALUES only.

## 136e — sleipnir_v1

`hooks.json` `sleipnir_v1`: delete the second hook object, `sleipnir_v1_ramp`, entirely. Description →
`"Whenever you play a card that costs 0 Energy, Sleipnir gains 1 stack of Strengthened."`

## 136f — kraken_v1 ABYSSAL_INK

1. `hooks.json` `kraken_v1_hook`: the Dazed action `"stacks": 1` → `2`. Description →
   `"Whenever Kraken's side draws a card outside the draw phase, apply 2 Dazed to every enemy."`
2. `programs.json` `whirlpool_v2`: Dazed action `"stacks": 1` → `2`; description →
   `"8 power. Draw a card. Apply 2 Dazed."`
3. New card (schema template: `sun_devourer` — consume then STATUS_CONSUMED attack):
```json
"crushing_depths": {
    "id": "crushing_depths",
    "name": "Crushing Depths",
    "description": "Consume all Dazed on the target: deal 15 power per stack consumed.",
    "element": "Water",
    "target": "Single",
    "category": "Attack",
    "rarity": "Rare",
    "baseCost": 2,
    "constraints": ["not_stunned", "not_asleep", "energy_base"],
    "actions": [
        { "type": "STATUS", "status": "Dazed", "consume": true, "target": "TARGET" },
        { "type": "ATTACK", "power": 15, "scaling": "STATUS_CONSUMED", "target": "TARGET" }
    ]
}
```
4. `mingmingRegistry.ts` kraken `decks.kraken_v1`: replace `"surge_protection"` with
   `"crushing_depths"`. The `startKits.kraken_v1` list does not contain surge_protection — leave it.

## 136g — kraken_v2 TIDAL_CRUSH

1. `programs.json` `capacitor`: Energized `"stacks": 2` → `3`; DELETE the Sharp action;
   description → `"Gain 3 Energy next turn."` (capacitor is only in kraken_v2's deck — verify with grep.)
2. New cards:
```json
"boiling_surge": {
    "id": "boiling_surge",
    "name": "Boiling Surge",
    "description": "40 power. Apply 2 Burn.",
    "element": "Water", "target": "Single", "category": "Attack", "rarity": "Uncommon", "baseCost": 2,
    "constraints": ["not_stunned", "not_asleep", "energy_base"],
    "actions": [
        { "type": "ATTACK", "power": 40, "target": "TARGET" },
        { "type": "STATUS", "status": "Burn", "stacks": 2, "target": "TARGET" }
    ]
},
"scald": {
    "id": "scald",
    "name": "Scald",
    "description": "Apply 1 Burn. You gain 1 Dazed.",
    "element": "Water", "target": "Single", "category": "Attack", "rarity": "Common", "baseCost": 0,
    "constraints": ["not_stunned", "not_asleep", "energy_base"],
    "actions": [
        { "type": "STATUS", "status": "Burn", "stacks": 1, "target": "TARGET" },
        { "type": "STATUS", "status": "Dazed", "stacks": 1, "target": "SELF" }
    ]
}
```
3. `mingmingRegistry.ts` kraken `decks.kraken_v2` →
   `["maelstrom", "hydro_blast", "capacitor", "capacitor", "boiling_surge", "boiling_surge", "scald", "scald"]`
   and `startKits.kraken_v2` → `["hydro_blast", "capacitor", "capacitor", "boiling_surge", "boiling_surge"]`
   (a start kit must be a sub-multiset of the deck — `startKits.test.ts` enforces it).
4. `maelstrom`'s description says "heavy Water damage" — it is 90 power. Change to
   `"90 power. Apply 1 Dazed."` (text only; no number moves).
5. `surge_protection` stays in the registry (jormungandr_v1 runs it).

---

## Gates, per commit

`npx tsc -b` clean; `npx vitest run` green; `npx eslint .` clean. Then, after the LAST commit, the
full grid on Henry's machine (his npm works now):

```
node scratch/rebaseline.mjs --iter 30 --outdir results/rebaseline-136
node scratch/promotegrid.mjs --dry-run      # compare against the targets above; do NOT promote
```

Accept: every deck within ±5 of the target column above (seed noise), and 35–80 band count ≥ 26/32.

## Pre-authorized knobs — NONE for numbers

This package is ruled. If a test asserts an OLD value that a change above deliberately moved,
update the assertion and say so in the commit. If a test fails for any OTHER reason, or a grid
row lands more than 5 points off target, **STOP and report** with the row and the diff. Do not
touch card power, cost, or any number not listed above.

## Commits

One per ticket letter (136a … 136g), in order, authored as Henry:
```
git -c user.name="Henry Dunphy" -c user.email="hdunphy15@gmail.com" \
    commit --author="Henry Dunphy <hdunphy15@gmail.com>" -F <msgfile>
```
Never `package-lock.json`. Check `git status` BEFORE each commit. Check for stale `.git/*.lock`
(move them to `_to_delete/locks/`, do not delete). Each message: what changed, the measured
before/after from the table, and "ticket 136".

## Docs (last commit)

- Append a "SHIPPED" section to `tickets/136-per-deck-rebalance.md` with your grid numbers.
- Add a decision line to `map.md` for kraken v1/v2 (ABYSSAL_INK = Dazed feed + Crushing Depths
  payoff; TIDAL_CRUSH = Burn setup + boosted hammers).
- Refresh `HANDOFF.md`'s open-threads: fenrir_v1 deck rework (Henry wants a Scald-like Ignite
  treatment), hraesvelgr_v2 deck rework, nidhoggr_v2 deck look, flat-number DoT/heal/shield ticket
  (after this pass), unspent-energy playtest list (below), 3v3 measurement still pending.

## Deliverable

Commit hashes; per-commit gate results; the grid table vs targets; every test assertion you
changed, quoted; every deviation.

---
---

# ROUND TWO — tickets 136h … 136n (ruled 2026-09-02, later the same day)

Six decks were still out after 136a–g. Henry redesigned each in session; every change below was
measured as a single row and then as the full grid. **Round-two full grid, measured on top of HEAD `3baa1dc` (post-136, post-138): mean 49.9,
sd 12.0, 26/32 in band** (promoted post-138 grid: 49.8 / 15.0 / 26). All six reworked decks are in band; the six now out
are the next tier down (the levy) and are the NEXT session's list, not this prompt's.

## Full-grid targets, round two (supersede the round-one table above)

| deck | target (round two on HEAD) | promoted post-138 | | deck | target | promoted |
|---|---|---|---|---|---|---|
| jormungandr_v1  | 72.8 | 75.0 | | nidhoggr_v1  | 71.4 | 76.3 |
| sleipnir_v2  | 65.0 | 30.7 | | fenrir_v2  | 61.4 | 65.5 |
| draugr_v2  | 60.4 | 64.4 | | kraken_v2  | 60.1 | 64.3 |
| audhumbla_v1  | 59.1 | 65.4 | | huldra_v1  | 58.6 | 68.2 |
| fenrir_v1  | 58.2 | 24.4 | | huldra_v2  | 57.8 | 59.6 |
| hraesvelgr_v1  | 57.0 | 60.8 | | skoll_v2  | 55.5 | 59.8 |
| hel_v2  | 54.7 | 24.2 | | ratatoskr_v1  | 54.6 | 59.6 |
| sleipnir_v1  | 54.3 | 58.0 | | jormungandr_v2  | 53.1 | 61.7 |
| fafnir_v1  | 50.6 | 54.1 | | kraken_v1  | 49.1 | 53.2 |
| draugr_v1  | 48.3 | 52.0 | | gullinbursti_v1  | 47.5 | 53.9 |
| hraesvelgr_v2  | 46.4 | 25.9 | | fafnir_v2  | 46.4 | 34.4 |
| ratatoskr_v2  | 44.9 | 52.8 | | ymir_v1  | 44.2 | 46.9 |
| valkyrie_v1  | 43.5 | 52.2 | | nidhoggr_v2  | 39.9 | 27.4 |
| ymir_v2 **OUT** | 34.9 | 38.1 | | gullinbursti_v2 **OUT** | 34.1 | 39.7 |
| hel_v1 **OUT** | 31.6 | 37.8 | | skoll_v1 **OUT** | 29.5 | 36.5 |
| audhumbla_v2 **OUT** | 28.5 | 36.2 | | valkyrie_v2 **OUT** | 23.7 | 35.0 |

|  | mean | sd | in band |
|---|---|---|---|
| promoted post-138 | 49.8 | 15.0 | 26/32 |
| **round two** | 49.9 | 12.0 | 26/32 |

Unspent energy over 15% (real end-of-turns): audhumbla_v1 23%, fafnir_v2 21%, draugr_v2 19%, audhumbla_v2 16%

## 136h — engine: remove the Strength stack cap, add two scalings

`src/engine/actions/ActionExecutors.ts`:
- `export const STRENGTH_STACK_CAP = 8;` → `export const STRENGTH_STACK_CAP = Number.POSITIVE_INFINITY;`
  Henry: *"No caps allowed."* Both the card-side `STRENGTH_STACKS` scaler and the hook-side one in
  `HookFactory.ts` read it; no shipped deck currently binds on it (`core_overclock_daemon` is in no
  deck). Update the comment blocks that explain the cap at both sites and any test pinning 8.
- In `getEffectiveAttackPower`, add before the `BARKSHIELD_STACKS` branch:
```ts
    if (action.scaling === 'SELF_ANY_STATUS') {
        const distinct = new Set(
            (source?.statusEffects ?? []).filter(s => s.stacks > 0).map(s => s.type),
        ).size;
        return power * distinct;
    }
```
- In `resolveScaling`'s switch, add before `case 'BURN_TIMES_ENERGY'`:
```ts
        case 'BURN_STACKS':
            return target?.statusEffects.find(s => s.type === 'Burn')?.stacks || 0;
```
- `src/engine/types.ts` scaling union: add `'BURN_STACKS' | 'SELF_ANY_STATUS'`.
- `powerscale.ts` cannot price either new scaling; note them in its manual-review list (hand-priced
  in this ticket: Firestorm Talon 25 × ≤4 Burn ≤ 100 at 2e; Corroded Edge 20 × 3–4 statuses at 1e).

## 136i — fenrir_v1 UNBOUND_KERNEL (24.7 → 59.5)

1. `hooks.json` `fenrir_v1_hook`: Strengthened `"stacks": 1` → `2`. Description →
   `"Attack programs apply 2 Strengthened and deal 2% Max HP recoil damage. Fire attacks deal up to 50% more damage, scaled by how much of your max HP is missing."`
2. New cards (schema template `equilibrium` for the HEALTH_THRESHOLD split, `momentum_crash`-style STRENGTH_STACKS):
```json
"war_pact": {
    "id": "war_pact", "name": "War Pact",
    "description": "Above half HP: gain 2 Strengthened and 2 Dazed. Below half: heal with 15 power.",
    "element": "Fire", "target": "Self", "category": "Skill", "rarity": "Uncommon", "baseCost": 0,
    "constraints": ["not_stunned", "not_asleep", "energy_base"],
    "actions": [
        { "type": "STATUS", "status": "Strengthened", "stacks": 2, "target": "SELF", "conditionals": [{ "type": "HEALTH_THRESHOLD", "target": "SELF", "value": "GT:50" }] },
        { "type": "STATUS", "status": "Dazed", "stacks": 2, "target": "SELF", "conditionals": [{ "type": "HEALTH_THRESHOLD", "target": "SELF", "value": "GT:50" }] },
        { "type": "HEAL", "power": 15, "target": "SELF", "conditionals": [{ "type": "HEALTH_THRESHOLD", "target": "SELF", "value": "LT:51" }] }
    ]
},
"unbound_fang": {
    "id": "unbound_fang", "name": "Unbound Fang",
    "description": "Deal 5 power for each stack of Strengthened you hold.",
    "element": "Fire", "target": "Single", "category": "Attack", "rarity": "Uncommon", "baseCost": 1,
    "constraints": ["not_stunned", "not_asleep", "energy_base"],
    "actions": [ { "type": "ATTACK", "power": 5, "scaling": "STRENGTH_STACKS", "target": "TARGET" } ]
}
```
3. `blood_rite`: no number changes; description → `"15 power. +15 power above half HP; otherwise heal with 40 power."` (the old text said "10% of your max HP" — same amount, honest wording).
4. `mingmingRegistry.ts` fenrir: `decks.fenrir_v1` →
   `["ragnarok_edge", "ragnarok_edge", "battle_rhythm", "war_pact", "war_pact", "unbound_fang", "unbound_fang", "blood_rite", "blood_rite"]`
   and `startKits.fenrir_v1` → `["ragnarok_edge", "war_pact", "unbound_fang", "battle_rhythm", "blood_rite"]`
   (the old kit named berserk_rush and crimson_draw, which leave the deck; `startKits.test.ts` enforces kit ⊆ deck).
   Update the species comment block for v1.

## 136j — hraesvelgr_v2 (26.1 → 46.3)

`programs.json`:
- `sun_eaters_plunge`: `"baseCost": 3` → `2`; ATTACK `"power": 68` → `45`; description →
  `"Dive from the sun: 45 power. Apply 3 Burn."`
- `firestorm_talon`: `"baseCost": "X"` → `2`; actions →
  `[ { "type": "ATTACK", "power": 25, "scaling": "BURN_STACKS", "target": "TARGET" } ]`;
  description → `"Deal 25 power for each stack of Burn on the target."`
Deck unchanged. `burnMechanic.test.ts` / `OSReworks.test.ts` may pin the old Talon shape — update values only.

## 136k — hel_v2 UNDERWORLD_GATEWAY (24.5 → 54.9)

`src/engine/core/CustomFirmware.ts` `OS_KNOBS.hel.pctPerEnergy: 6` → `5`. Cap stays 25.
`hooks.json` hel_v2 description: "6% of her max HP per Energy" → "5%". Update the ticket-80 comment
block above OS_KNOBS (it records the 5 → 6 move; this is 6 → 5, measured: 4% = 83, 5% = 60, 6% = 25).
`StanceSystem.test.ts` / hel tests that pin 6 → update the value.

## 136l — sleipnir_v2 WAR_STEED (30.6 → 64.9)

`mingmingRegistry.ts` sleipnir `decks.sleipnir_v2` →
`["lance", "lance", "cavalry_charge", "feather_cache", "feather_cache", "carrion_swoop", "war_molt", "stampede"]`
(dust_devil, water_slap and both zephyr_strike out; feather_cache ×2, carrion_swoop, stampede in — all existing cards). No card changes.

## 136m — nidhoggr_v2 BLOOD_SCENT (28.6 → 40.7)

1. `bloodletting`: ATTACK `"power": 18` → `25`; self-Poison `"stacks": 2` → `1`; description →
   `"25 power. Add 1 stack of Poison to yourself."` **Henry's call, knowingly above the 0e curve** (10
   budget; 22 is the honest number and measured 42, 25 measured 46 single-row) — do not "fix" it.
2. New card (template `sun_devourer`):
```json
"bloodwrath": {
    "id": "bloodwrath", "name": "Bloodwrath",
    "description": "Consume your own Poison: deal 10 power per stack consumed.",
    "element": "Dark", "target": "Single", "category": "Attack", "rarity": "Rare", "baseCost": 1,
    "constraints": ["not_stunned", "not_asleep", "energy_base"],
    "actions": [
        { "type": "STATUS", "status": "Poison", "consume": true, "target": "SELF" },
        { "type": "ATTACK", "power": 10, "scaling": "STATUS_CONSUMED", "target": "TARGET" }
    ]
}
```
3. `decks.nidhoggr_v2`: replace `"water_slap"` with `"bloodwrath"`.

## 136n — fafnir_v2 CORRUPTED_GOLD (34.4 → 46.4)

New cards:
```json
"tarnish": {
    "id": "tarnish", "name": "Tarnish",
    "description": "Apply 2 Weakened. You gain 1 Weakened.",
    "element": "Earth", "target": "Single", "category": "Status", "rarity": "Common", "baseCost": 0,
    "constraints": ["not_stunned", "not_asleep", "energy_base"],
    "actions": [
        { "type": "STATUS", "status": "Weakened", "stacks": 2, "target": "TARGET" },
        { "type": "STATUS", "status": "Weakened", "stacks": 1, "target": "SELF" }
    ]
},
"corroded_edge": {
    "id": "corroded_edge", "name": "Corroded Edge",
    "description": "Deal 20 power for each different status on yourself.",
    "element": "Earth", "target": "Single", "category": "Attack", "rarity": "Rare", "baseCost": 1,
    "constraints": ["not_stunned", "not_asleep", "energy_base"],
    "actions": [ { "type": "ATTACK", "power": 20, "scaling": "SELF_ANY_STATUS", "target": "TARGET" } ]
}
```
`decks.fafnir_v2`: `"water_slap"` → `"tarnish"`, `"squirrel_away"` → `"corroded_edge"`.

## Gate for round two

Order: land 136h–136n BEFORE ticket 137 (the AI Regen constant). The targets above were measured
with the AI still valuing Regen at 3%; 137 re-measures its own grid afterwards.

Same gates per commit. Final grid target is the round-two table above (±5). Band count ≥ 26/32.
The six decks out after round two (ymir_v2, gullinbursti_v2, hel_v1, skoll_v1, audhumbla_v2,
valkyrie_v2) are EXPECTED out — they are the next session, not a failure of this one.
