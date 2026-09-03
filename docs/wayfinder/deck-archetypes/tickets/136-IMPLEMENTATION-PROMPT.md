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
