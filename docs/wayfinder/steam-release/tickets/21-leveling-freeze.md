# Leveling removal: freeze the engine at the calibration point everywhere (ticket 21)

- Type: wayfinder:task
- Status: closed
- Assignee: legion-02 (2026-08-21)
- Blocked by: [01](01-gap-audit.md)
- Phase: Vertical Slice

## Deliverable

vision.md: NO leveling — engine frozen at the level-15 calibration; progression is acquisition. Code still carries `level`/`experience` on `MingmingInstance`, `avgPlayerLevel ± 2` in `EncounterGenerator`, XP in `RewardSystem`, `syncPartyStats`, the XP bar in `RosterTerminal`, the `levelUp` SFX, and level inputs across `battleFactories`/debug scenarios. Remove or constant-fold them so every entity is created at the calibration level; keep the stat-roll jitter (that is the collection depth). Coordinate with deck-archetypes: the sim pipeline must keep producing identical numbers (registry hash unchanged or the change documented).

## Done when

`grep -rn "level\|experience" src/engine src/ui` shows only the frozen constant; `npm test` green; one `npm run balance` row-check shows no movement.

## Resolution

Closed 2026-08-21. **72 files changed, 2 deleted.** `tsc -b` clean, **`npx vitest run` green at 901 tests**, `npm run build` clean, and lint went **510 → 491** (deleting the XP machinery removed 19 findings).

### The one number that survived

`CALIBRATION_LEVEL = 15` in `engine/types.ts`, plus its derivative `CALIBRATION_LEVEL_DAMAGE_BASE = floor(2 × 15 / 5) + 2 = 8`. Nothing else reads a level, because **no entity has one**: `level` and `experience` are gone from `IMingmingState` (and therefore from `IBattleEntity`), not defaulted.

Gone rather than defaulted on purpose. `calculateStandardStat(base, mod)` and `calculateHealth(base, mod)` **lost their `level` parameter entirely**, as did `createMockEntity`, `createMingmingInstance`, `createUnit` and `simulate1v1`. A default would have left a seam a future caller could pass 20 into and quietly re-introduce stat inflation — the exact thing `vision.md` rules out. With no parameter there is nothing to pass.

15 is not a new number: it is `BALANCE_LEVEL`, the level **every row of the balance corpus has always been computed at**. `balanceScenarios.ts` now re-exports the engine constant under that name, so corpus and engine cannot drift.

### The balance proof — the ticket's hardest gate

`npm run balance`, 29 minutes, and then a byte-comparison of every generated artifact against the committed baseline:

| Artifact | Result |
|---|---|
| `docs/balance/balance_report.json` | **byte-identical** |
| `docs/balance/balance_matchups.csv` | **byte-identical** |
| `docs/balance/balance_redlines.csv` | **byte-identical** |
| `docs/balance/matchup_band_census.json` | **byte-identical** |
| `docs/balance/field_census.json` | **byte-identical** |

Not "no movement in a row-check" — **no movement anywhere**. `registryHash` is unchanged too (it hashes the three registries, never `IMingmingState`), so all 51 committed `.scenario.json` files and playtest snapshots still load.

**20 balance-suite tests DID fail — and they were already failing.** Every one is the OS-variance audit's 15% v1-vs-v2 cap, on ten species (fenrir, kraken, fafnir, skoll, gullinbursti, ratatoskr, huldra, draugr, audhumbla, nidhoggr; the count is 20 because the sharded file repeats them). Verified by running `os-variance.balance.ts` against an untouched checkout of the parent commit: **the same ten species fail with the same percentages**. This is pre-existing balance debt owned by the deck-archetypes map — huldra_v1 at 99% against its own v2 is the worst — and this ticket neither caused nor fixed it. Flagging it here because `npm run balance` is not in CI and nobody may have looked recently.

### What this changes about the live game (it is not a no-op)

The sim is unaffected because it always ran at 15. **The shipped game is not**: `createStarterSave` built starters at **level 5** and they levelled through combat XP. Frozen at 15, a starter's stats jump:

| Species | L5 hp/atk/def | L15 hp/atk/def | Δ |
|---|---|---|---|
| fenrir | 48 / 15 / 13 | 75 / 37 / 31 | +27 / +22 / +18 |
| kraken | 47 / 16 / 15 | 72 / 40 / 36 | +25 / +24 / +21 |
| ratatoskr | 48 / 16 / 12 | 76 / 39 / 27 | +28 / +23 / +15 |

This is intended and self-balancing: enemies were generated at `avgPlayerLevel ± 2` (`EncounterGenerator`) or `max(playerParty.level)` (`battleFactories`), so both sides move together — and both sides now sit exactly where the tuned corpus lives. The damage coefficient goes 4 → 8 at the same time, which is why absolute damage numbers in the unit tests roughly doubled.

A side effect worth knowing: **statuses now read truthfully.** At the old level-5 default a single Weakened or Sharp stack rounded away entirely (3 damage either way); at CALIBRATION_LEVEL the same stack is a visible point (7 → 6). The status economy is legible at the level the game is actually played at, which is a second argument for freezing there.

### What was removed

**Engine.** `getExpForLevel`, `calculateDeathXp`, `handleLevelUp`, `addExperience` and the whole XP-award block in `checkDefeat`; `LevelUpEvent` and `IBattleState.levelUpQueue`; the `avgPlayerLevel ± 2` scaling in `EncounterGenerator` (the ±2 PRNG draw is **deleted, not ignored** — a dead draw would have shifted every downstream roll in that seeded stream); `playerLevel` in `battleFactories`' gym tiering.

**Store / UI.** `gameSlice.grantExperience`; `gameSlice.syncPartyStats` — with level and XP gone it had nothing left to persist, so a battle no longer mutates the roster at all; `battleSlice.dismissLevelUp`; `LevelUpOverlay.tsx` (deleted); the XP bar and `LV.` overlay in `MingmingUnit`, the plaques in `BattleStage`, the "Efficiency Logs" XP panel in `BattleReport`, and the level readouts in `RosterTerminal`, `DeckTerminal` and `HubScreen`.

**Debug toolkit.** `level` off `PartyMemberSetup`/`EnemySetup`/`BattleEntitySchema` and `levelUpQueue` off the snapshot schema; the launcher's per-unit level input and its "≡ Match player level" button (`matchPlayerLevel` deleted); the save editor's level field and grant-XP row; **`BalanceTester`'s two level sliders** — with the engine frozen those sliders would have moved nothing while appearing to work, which is worse than not having them.

**Not removed:** the `levelUp` SFX recipe and its `useBattleVfx` trigger. The ticket lists it, but the sound is now simply unreachable, and `sfxRecipes.ts` is union-checked complete — pulling one member is an audio-pass edit, not a leveling edit. Left for [ticket 35](35-audio-pass.md). Likewise `IRewardBundle.totalXP`, which was already hard-coded `0`; it is now structurally meaningless and [ticket 12](12-rewards-refit.md) should drop it with the rest of the bundle refit.

### One change outside the ticket's letter, and why

`SaveSystem.PlayerSaveSchema`'s `MingmingInstanceSchema` still **required** `level` and `experience`. Left alone it would have rejected every save the game can now produce — 48 tests failed on exactly that. Removing those two fields was the minimum needed to keep the save system working; [ticket 23](23-save-v4.md) replaces the schema wholesale.

### Two test assertions that turned out to encode a rounding coincidence

Worth recording because the instinct is to retune the number and move on.

`OSGapClosures` asserted `withOS === withoutOS + floor(withoutOS × 0.35)` for ymir_v2's "+35% to Ice", which reads like a pin on the ticket-09 knob. It is not: the knob applies to **power, before the pace divisor**, so what reaches the HP bar was never 1.35×. Measured at the old level-20 pin the observed ratio was 5/4 = **1.25**; measured at CALIBRATION_LEVEL it is 26/21 = **1.238**. **The OS is unchanged** — the old formula only matched because `floor(4 × 0.35)` happened to equal the real +1 at that one scale. The assertion is now a band (1.15–1.40) with the reasoning written down, and the test card was resized 20 → 120 power so the percentage survives flooring at all.

The neighbouring fenrir_v1 missing-HP test had the same shape: `half > full` strictly held at level 20 (8/8/10/10) but per-hit flooring hides that step at CALIBRATION_LEVEL (6/6/6/8). Same clause, different resolution — so it now asserts monotonic non-decreasing with a strict increase by the sliver case.

Neither number was fitted to make a test pass; both were checked against the pre-change build first.

### Test surgery

44 test files touched. Deleted outright because their subject no longer exists: `repro_freeze.test.ts` ("should award XP and level up correctly"), the `XP pacing` describe in `BugFixes`, `grantExperience` in `gameSlice.rewardActions`, `matchPlayerLevel` in `composeScenario`, `requires level >= 1` in `scenarioSchema`, the grant-XP case in `saveEdit`, godVerbs' XP award case, and Kernel's `Exponential XP` case. `SaveSystem`'s "rejects level < 1" was **re-pointed rather than deleted** — the IV band is the surviving per-instance numeric constraint and it stands for the same assertion (a schema-invalid roster member is refused, not written).

A process note for whoever does the next sweep of this size: the first mechanical pass used a non-greedy regex that ate neighbouring properties on shared lines (`level: 5, maxHp: 100, ...` lost the whole line). It was caught by diffing every removed line against the parent commit, and every test file was then restored from HEAD and re-swept with whole-line-only matching plus a canonical-form equality check proving nothing but level/experience/levelUpQueue moved. **Do that audit; do not trust the regex.**

