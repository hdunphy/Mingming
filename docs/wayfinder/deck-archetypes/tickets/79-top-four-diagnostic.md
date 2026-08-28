# Top four diagnostic (ticket 79): why hel_v2, ymir_v2 and both nidhoggrs are strong

- Type: wayfinder:research - REPORT-ONLY. Henry-requested, 2026-08-17.
- Status: **closed** (2026-08-17)

## Ask

Henry: diagnose the four worst offenders together (one at a time is too slow), establish why they
are strong, see whether stats move them, and produce a knob list **starting with the OS**. Preserve
the shape of the OS + deck - those choices were deliberate; prefer adding conditions so an OS
triggers less, or hits less hard when it does. Also: *"damage share itself doesn't identify the
issue as some decks are literally built around one card payoff. What we want to understand is how
easy is it to get that payoff and is it hitting too hard."*

## Resolution

Report: [research/top-four-diagnostic.md](../research/top-four-diagnostic.md). Instrument
`scratch/offenders.ts` - field win rate vs all 31 decks, payoff accessibility (first-cast turn,
casts a game) and magnitude (damage as a share of the target's whole health bar), plus an OS-off
arm. Sweeps at 15 iterations.

**Also shipped: [METHOD.md](../METHOD.md)**, the running lessons-learned document Henry asked for -
the process compiled from tickets 60-79, separate from HANDOFF's findings log.

**The OS-off measurement is the headline and it says these are four different problems:**

| deck | live | OS off | OS worth |
|---|---|---|---|
| `hel_v2` | 81.4% | **1.8%** | +79.6 - the OS IS her economy |
| `ymir_v2` | 81.3% | 60.1% | +21.2 |
| `nidhoggr_v2` | 75.7% | 66.9% | +8.8 |
| `nidhoggr_v1` | 78.2% | 70.9% | +7.3 |

Three of the four would still be top-eight decks with the OS deleted, so an OS nerf alone cannot
fix them; `hel_v2` is the opposite and cannot function without hers.

**Recommended first knobs, all OS, no card touched:**

| deck | knob | field |
|---|---|---|
| `hel_v2` | blood price 5% -> 6% per Energy | 80.7 -> **67.6** |
| `ymir_v2` | `maxCardsPerTurn` 2 -> 1 (make the inert drawback real) | 81.3 -> **65.9** |
| `nidhoggr_v2` | BLOOD_SCENT drops the DRAW, keeps the Energy | 75.7 -> **67.7** |
| `nidhoggr_v1` | needs a `maxStacks` hook field built first | interim: defense 80->68 = 67.0% |

**Findings worth carrying forward:**

- **`hel_v2` has no gate.** `soul_tithe` (3e, 90 power) costs 15% of her max HP against a 20% turn
  budget, so it casts on **turn 1.8, twice a game, for 32% of the target's health bar** - and the
  OS's +50% healing refunds the blood. The turn cap is **inert** at 15% too; it does not bind at any
  value that keeps her shape.
- **`ymir_v2`'s drawback was already documented as inert** in `CustomFirmware.ts` by ticket 50, and
  the bonus has been walked 50% -> 35% -> 25% without fixing her. **Measured: she plays 1.06 cards a
  turn against a cap of 2.** Making the cap real is worth -15.4 and changes her actual play by a
  quarter of a card a turn.
- **`nidhoggr_v1`'s OS knob is backwards.** `minStacks` gates maintenance on the pile being LARGE,
  so it fires MORE in the late game. The shape needed is a **maximum** - stop maintaining a pile
  once it is big - which needs a `maxStacks` field the hook schema does not have.
- **`nidhoggr_v2` does not self-loop.** I expected `bloodletting` self-damage to farm the threshold;
  measured, **she crosses below half 1.01 times a game.** The OS fires ~twice a game and is still
  worth +8.8. Its draw is worth more than its Energy (-8.0 vs -2.7).
- **`powerscale` cannot see firmware**, so every Ice card in `ymir_v2` is worth 25% more than its
  printed score and the card audit does not know. True of any damage-multiplying OS.
- **`wither_feast` prices at -10.8 and measures 13.1** - any repricing of `nidhoggr_v1` is wrong
  until that is fixed.

Nothing shipped: these are 15-iteration rankings and all four decks are top-eight, so the pick
wants a re-read at 30, a full 8-DIFF and a deck-grid re-run.
