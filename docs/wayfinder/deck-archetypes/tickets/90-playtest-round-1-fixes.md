# Playtest round 1 bug fixes (ticket 90)

- Type: wayfinder:task - Henry-directed, 2026-08-19. Branch `archetype-web`.
- Status: **closed** (2026-08-19)

Henry played one match of the round-1 pack (A1, `sleipnir_v1` vs the control) and it *"made it hard
to play"*. Six items came back in `docs/bugs.txt`. All six fixed; the findings are in
[research/playtest-round-1.md](../research/playtest-round-1.md).

| fix | where |
|---|---|
| **Status tooltips were wrong by 10x** - the glossary said 20% per stack, the engine applies **2% per stack capped at +-25%**. All four of Strengthened/Weakened/Dazed/Sharp. | `statusGlossary.ts` |
| **The damage preview could not see per-card scaling** - `stampede`, the deck's payoff, previewed at its printed power however wide the turn was. Extracted `getDamageScalingMultiplier`, now shared by the executor and the preview. | `ActionExecutors.ts`, `damagePreview.ts` |
| **...and it was off by one** - the reducer increments `cardsPlayedThisTurn` before actions resolve, so a scaler counts the card being cast. | `damagePreview.ts` |
| **Turn counter and cards-played counter** in the HUD, top-left. The cards chip lights when the count is above zero, because on that deck the count IS the damage. | `BattleArena.tsx` |
| **Snapshot export after the battle ends** - Ctrl+Shift+E falls back to the final state of the last battle, so you no longer have to predict the killing blow. | `snapshotIO.ts` |
| **The preview now names its multiplier** - a chip reading `x4 CARDS PLAYED` beside the STAB and effectiveness chips. | `MingmingUnit.tsx` |

847 tests (3 new: preview-vs-reducer parity for a per-card scaler, the multiplier value, and the
no-scaling case). `tsc` clean.

## The part that is not a bug

At level 15 a 15-power card deals **2-3 damage** into an 87 HP bar - `floor(levelBase x power x
atk/def) / 45` with `levelBase` 8 - and **the sim runs at the same level 15**, so the numbers Henry
saw are the numbers we balance against. `sleipnir_v1`'s damage is not supposed to come from those
cards: it comes from `hoofbeat_daemon` (flat 10 per 0-cost play, no divisor), `momentum_crash`
(8 per Strengthened stack, up to 64 power) and `stampede`. **All three were invisible while piloting
her** - one previewed wrong, one reads 0 until the engine spins up, one is a daemon that never
appears in a hover preview. Choices 2/5 is the right score for that, and it is a readability failure
rather than a balance one.

**Worth re-running A1 now that the preview tells the truth**, before spending anything on ticket
88's draw experiment - a wide deck whose damage arrives through counters the player cannot see gets
*more* opaque with an extra card a turn, not less.

## Still open

`[ ]` the extra-energy display (`4/3`). The over-energy branch exists and renders `currentEnergy` in
cyan above `maxEnergy`; if it still reads `3/3` the defect is in when Energized converts into
Energy, not in the display.
