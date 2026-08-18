# Draw scaling (ticket 71): the compensation is a fixed point, and it exposed a broken deck

Ticket: `71-draw-scaling.md`. Henry, 2026-08-16: *"fix card draw scaling as well but then
compensate by increasing the power per draw."*

## 1. What was wrong

`CARDS_DRAWN` scaling multiplies resolved damage by `state.cardsDrawnThisTurn`, and the
draw-phase refill increments that counter (HANDOFF `0-DRAW-COUNTER`). So "12 power per card
drawn" paid its headline rate on turn one with no draw engine at all. Ticket 68 fixed this for
the *constraint* (`surge_protection`) and explicitly left the *scaling* as a Henry decision.
Henry took it.

Two cards carried it, across three decks: `ink_stream` (`kraken_v1`, `jormungandr_v1`) and
`starfall` (`valkyrie_v2`).

## 2. The measurement that changed the plan

Pre-fix, over 1,365 real casts (`scratch/drawcount.ts`, 3 decks x 15 opponents x 4 seeds x 2 sides):

| card | casts | natural-incl mean | TRIGGERED mean | dmg/cast | naive ratio |
|---|---|---|---|---|---|
| `ink_stream` | 886 | 3.71 | 0.92 | 10.1 | 4.04x |
| `starfall` | 479 | 4.76 | 1.85 | 8.1 | 2.57x |

The obvious compensation is that ratio: 12 -> 48 and 10 -> 26. **It over-delivered by 77%.**

| arm | `ink_stream` dmg/cast | `starfall` dmg/cast |
|---|---|---|
| pre-fix target | 10.1 | 8.1 |
| naive ratio (48 / 26) | **17.9** | **14.8** |

**Why: the AI is not a fixed sampler.** `getBestAction` pushes candidate plays through the
reducer and prices the card as it will actually resolve, so raising the payoff makes the AI
*sequence its draws before casting*. The triggered mean is a function of the power: it rose from
0.92 to 1.33 as `ink_stream` went 12 -> 48, and zero-triggered casts fell from 41.5% to 10.7%.
Compensation here is a **fixed point**, not a ratio.

Solved by sweep (`scratch/drawsweep.ts`):

| `ink_stream` power | 24 | 30 | **33** | 36 | 48 |
|---|---|---|---|---|---|
| triggered mean | 1.46 | 1.40 | **1.37** | 1.37 | 1.33 |
| dmg/cast | 10.1 | 12.0 | **13.0** | 13.9 | 17.9 |
| total damage delivered | 6,235 | 8,054 | **8,920** | 9,529 | 11,331 |

Pre-fix total was 8,949. **Power 33 lands at 8,920 — 0.3% off.** `starfall` at 18 gives 3,771
against a pre-fix 3,880 (-2.8%). Both inside the ticket's +/-15% gate.

Note the two possible targets disagree and I chose deliberately: **per-cast** preservation wants
power 24, **total-contribution** preservation wants 33, because cast counts fall (the AI plays
the card less often when it has no fuel). Total is the balance-relevant quantity — it is what
moves a win rate — so that is the one held.

## 3. The variance flag I raised, and why it dissolved

I flagged before shipping that 41.5% of `ink_stream` casts had zero triggered draws, so the card
would deal nothing on nearly half its casts. **That number was counterfactual and it did not
survive.** It measured triggered draws on casts the AI chose for other reasons. Once the card
actually pays for triggered draws, the AI arranges them: zero-triggered casts land at **12.9%**,
not 41.5%. `starfall` likewise 23.4% -> 9.3%. The shape change is real but far milder than the
pre-fix sample implied.

## 4. What it exposed: `kraken_v1` had no draw engine

A single power number cannot be right for two decks that earn different numbers of draws. At
power 33:

| deck | triggered mean | dmg/cast pre -> post | total pre -> post |
|---|---|---|---|
| `jormungandr_v1` / `ink_stream` | 1.75 | 10.7 -> 17.1 | 4,839 -> 6,377 (**+32%**) |
| `kraken_v1` / `ink_stream` | 0.92 | 9.6 -> **8.1** | 4,146 -> 2,543 (**-39%**) |
| `valkyrie_v2` / `starfall` | 2.54 | 8.1 -> 9.5 | 3,876 -> 3,771 (-3%) |

That redistribution *is* the design — "per card you earned" should reward a draw engine — but
`kraken_v1` did not have one. The registry comment claims *"draw engine (4 draw cards feed the
ink)"*; the four are `whirlpool_v2` x2 (draw 1) and `pressure_point` x2 (**draw 1 only if
Dazed**), which measured 0.92 triggered draws a cast against `jormungandr_v1`'s 1.75. Her OS,
ABYSSAL_INK_SYS, pays out on non-draw-phase draws too, so *two* of her three v1 systems were
starving. The bug had been hiding it by paying her for the refill.

First balance run confirmed it: control's win rate against `kraken_v1` went **39% -> 59%**, i.e.
`kraken_v1` beat control only 41%, **below the 0.60 control floor** and the only deck in the
roster to fail it.

**Fix, in ticket 71 because ticket 71 caused it:** `kraken_v1`'s `water_slap` filler ->
`undertow` (0e Water, "draw a card"). Same cost, same element, and it is the exact card
`jormungandr_v1` runs to reach 1.75.

## 5. 8-DIFF (before = HEAD `6fcfbbf`, after = this ticket)

8 of 67 rows moved >= 0.5 points, and every one belongs to a carrier species:

| row | before | after | delta |
|---|---|---|---|
| `gauntlet:control-vs-kraken:kraken_v1` | 39.0% | **4.0%** | **-35.0** |
| `os:valkyrie` (v1 over v2) | 89.0% | 69.0% | -20.0 |
| `os:kraken` (v1 over v2) | 57.0% | 71.0% | +14.0 |
| `os:jormungandr` (v1 over v2) | 91.0% | 98.0% | +7.0 |
| `gauntlet:control-overall:slot1` | 6.9% | 4.8% | -2.2 |
| `mirror:jormungandr` | 47.2% | 49.0% | +1.8 |
| `gauntlet:control-overall` | 6.5% | 5.4% | -1.1 |
| `mirror:kraken` | 51.2% | 52.0% | +0.8 |

Reading them: **`kraken_v1` now beats control 96%**, up from 61% pre-71 and 76% pre-68 — she is
back in line with the roster, where every other deck beats control 100%. `valkyrie_v2` gained 20
points on her sibling, which **shrinks** a standing section-2.3 violation from a 78-point gap to
38. `jormungandr_v1` gained 7, which **widens** one from 82 to 96.

## 6. Gates

- Unit suite **833/833 green**, 63 files. Two new files: `drawScaling.test.ts` (7 tests) joins
  ticket 68's `triggeredDraw.test.ts` (6).
- `npm run balance` clean; **FTK 0** on every row; dead-card ratio max 0.241 (`mirror:kraken`)
  against a 0.35 gate; **no card-budget redline added or removed** (42 either way).
- Matchup redlines 11 -> 12. The addition is `os:kraken`, a **section 2.3** row — demoted to
  diagnostic by the deep-phase policy, and it fires because `kraken_v1` is now clearly the
  stronger variant rather than because anything broke.
- `powerscale.ts` gets `ASSUMED_TRIGGERED_CARDS_DRAWN = 1.25`, cast-weighted from the census.
  Unlike its neighbours this is a MEAN, not a floor, and the file says so.

## 7. What this does to ticket 70

Ticket 70 exists because kraken was weak: ticket 67 measured her at **net -1.49 damage a turn**
in neutral matchups and Henry's answer was *"Kraken needs to pick a lane and with low HP and Def
it's not working."* One 0-cost card swap moved her from 41% to 96% against control. **Ticket
70's premise needs re-baselining before any stat sweep** — its own instrument section already
requires this, and the stat lane may now be unnecessary or much smaller than three arms of
three. I recommend running ticket 69's census first and reading kraken's field row off it.

## 8. Open

- `os:jormungandr` at 98% is the widest variant gap in the roster and this ticket widened it.
  `jormungandr_v2` is the deck to look at, not `v1`.
- One power number serves two decks with different draw density. It is honest at the roster
  level and unfair at the deck level; the alternative is per-deck tuning of a shared card, which
  this codebase does not do. Noted, not fixed.
