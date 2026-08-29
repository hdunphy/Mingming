# The launch triangle: 17.5% of EA matchups are decided at character select (ticket 71)

- Type: wayfinder:grilling
- Status: open
- Assignee: 
- Blocked by: nothing - the measurement is done (below)
- Phase: Vertical Slice
- Scope note: this ticket rules DIRECTION on a launch-scope question. The lever is one engine
  constant (`TYPE_CHART` in `combatUtils.ts`); any deck-level follow-up lands through
  deck-archetypes coordination, per the map's scope boundary.

## Why this exists

Raised in [the balance merge report](../../deck-archetypes/MERGE-REPORT-balance-to-steam-release.md)
section 2, as a paragraph rather than a ticket - which is how a launch-scope design decision ends up
somewhere nobody looks again. It is not a balance bug and no deck is out of band. It is a
**consequence of the EA scope** that Henry has never been asked to rule on.

**Early access ships Nature, Water, Fire** - and those three are exactly the rock-paper-scissors
triangle: Fire beats Nature beats Water beats Fire. In the full nine-element roster that triangle is
diluted by neutral pairings. In a three-element one it *is* the game.

## The measurement (verified independently, 2026-08-29)

Recomputed from `docs/balance/deck_grid.json` (post-merge build, 960 cells, 30 iterations per turn
order) against the six launch species - fenrir, skoll (Fire), kraken, jormungandr (Water),
ratatoskr, huldra (Nature) - which is 12 decks and **120 ordered matchups**.

| measure | EA subset | full roster |
| --- | --- | --- |
| matchups at **0% or 100%** | **21 of 120 = 17.5%** | 68 of 960 = 7.1% |
| subset mean win rate | 49.9% | 50.3% |

**The dilution claim holds: extremity is 2.5x worse inside the launch set than across the roster.**
Every deck is in band; the mean is dead centre. The problem is entirely in the spread.

### What the merge report did not say: three of the 21 are NOT the type chart

Splitting the 21 by whether the two decks share an element:

- **18 are cross-element** and follow the triangle exactly - `fenrir_v1` loses 0% into
  `jormungandr_v1`, `kraken_v1` and `jormungandr_v1` both take `skoll_v1` 100%, and so on.
- **3 are SAME-element**, where the multiplier is 1.0 and cannot be the cause:
  `huldra_v1` vs `ratatoskr_v1` (100% / 0% both ways) and `ratatoskr_v2` vs `huldra_v2` (100%).
  Nature-on-Nature, decided by deck design.

So the merge report's *"the lever is the 1.5x multiplier, not any individual deck"* is right for
**18 of 21** and wrong for three. Turning the multiplier down would leave a hard-countered Nature
pairing behind, and that pairing is invisible in any roster-mean view.

## The state of the constant

`src/engine/combatUtils.ts`: advantage **1.5x**, resistance **removed entirely** (was 2.0 / 0.5).
That softening was itself a Henry ruling (deck-archetypes ticket 35) measured over 1,440 games per
variant, and its own header argues 1.5/1.0 is already near the floor of what reads as a type system.
**So "just lower it" is re-opening a ruling that was made carefully.** That is the honest framing of
Q1 below.

## The questions for Henry

**Q1 - Is 17.5% decided-at-select a problem, or the point?**
(a) **It is the point.** A clean triangle is legible, it is what a three-element roster IS, and
teaching it is teaching the game. Ship it and say so in the tutorial. (b) **It is too sharp** - a
player who picks wrong has no game, and at EA that is the review that gets written. (c) It depends
on how often a player is actually *forced* into a bad matchup - which is a run-structure question
(the gym offer screen telegraphs the element, [ticket 68](68-boss-redesign-drivers.md)), not a
combat one. **This is the question; Q2 and Q3 only matter if the answer is (b).**

**Q2 - If it is too sharp, which lever?**
(a) The **multiplier** (1.5 -> 1.35 or 1.25) - one constant, global, and re-opens deck-archetypes
ticket 35's measured ruling. (b) **Restore a soft resistance** (1.0 -> 0.9 on the bad side) - the
old 0.5 is not on the table; this is a different, gentler shape. (c) **Neither - fix it in run
structure**: guarantee the offer screen never forces a triple-disadvantage gym, which leaves combat
alone entirely. (d) **Widen the EA element set** - the triangle dilutes itself if a fourth element
ships, at the cost of scope.

**Q3 - The three same-element cells.**
Whatever Q2 rules, `huldra_v1`/`ratatoskr_v1` and `ratatoskr_v2`/`huldra_v2` stay hard-countered.
Is that (a) fine - decks *should* have bad matchups and this is two of twelve - or (b) a
deck-archetypes request to soften, given both are launch decks a player will own early?

## What NOT to do without a ruling

**Do not touch `TYPE_CHART`.** It is one line and it looks free; it is a measured ruling with 1,440
games behind it, and moving it silently re-opens every band in `deck_grid.json` and the 67/68 boss
numbers with it.

## Reproducing the numbers

The grid is the source; no new harness is needed. Filter `docs/balance/deck_grid.json`'s cells to
the six launch species by `primaryElement in {Nature, Water, Fire}`, count `winRate === 0 || === 1`,
and split by whether `primaryElement` matches on both sides.

## Resolution

_(open)_
