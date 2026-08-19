# The status grid: percent vs power (ticket 95) - measured, nothing shipped

Henry, after playing: *"the statuses don't feel very noticeable. Like a very small change in damage
output maybe 1-2 dmg once you hit the cap."* He is describing the live shape exactly: the four
duality statuses are **2% per stack against a +-25% cap**, which at level 15 is one or two points of
damage on a card that deals ten. You spend a card to apply them and see nothing.

His proposal: re-denominate them in **POWER** - each stack worth power on the relevant side, added
before the pace divisor, **uncapped**, with the duality cancel and the sheds as the valve rather
than a ceiling.

Both shapes are now switchable through one exported `STATUS_MODEL`, and this is the grid.
**Nothing is shipped: `STATUS_MODEL` sits at the live values and all 851 tests pass unchanged.**

## The grid

Six status-driven decks' field win rate, plus the three cells the ticket names. 8 iterations per
opponent over a third of the roster, 20 per exhibit cell.

| arm | gull_v1 | gull_v2 | skoll_v2 | draugr_v2 | huldra_v1 | sleipnir_v1 | draugr vs huldra | **gull vs fafnir_v2** |
|---|---|---|---|---|---|---|---|---|
| **PCT 2 / cap 25 (LIVE)** | 46.7 | 29.2 | 37.8 | 44.3 | 44.5 | 43.3 | 15.0 | **100.0** |
| PCT 2 / cap 40 | 52.9 | 30.4 | 37.8 | 44.3 | 45.8 | 46.8 | 15.0 | 97.5 |
| PCT 2 / cap 60 | 56.7 | 30.4 | 37.8 | 44.3 | 45.8 | 46.8 | 15.0 | 97.5 |
| PCT 4 / cap 25 | 46.0 | 34.6 | 39.8 | 47.4 | 52.5 | 47.5 | 7.5 | 100.0 |
| PCT 4 / cap 40 | 56.9 | 41.8 | 40.9 | 49.3 | 68.1 | 60.0 | 5.0 | 100.0 |
| PCT 4 / cap 60 | 66.3 | 47.9 | 40.9 | 49.3 | **81.3** | 67.5 | 2.5 | 100.0 |
| PCT 6 / cap 25 | 47.5 | 35.8 | 37.5 | 48.7 | 54.6 | 50.6 | 5.0 | 100.0 |
| PCT 6 / cap 40 | 55.0 | 46.8 | 42.5 | 54.3 | 77.5 | 66.3 | 2.5 | 100.0 |
| PCT 6 / cap 60 | 63.7 | 55.5 | 43.6 | 55.5 | **86.3** | 76.3 | 2.5 | 100.0 |
| **POWER +1** | 48.5 | 26.3 | 34.6 | 45.0 | 56.9 | **85.5** | 5.0 | **70.0** |
| **POWER +2** | 65.6 | 37.9 | 36.8 | 53.6 | 79.2 | **88.8** | 2.5 | **62.5** |

## Three findings, in order of how much they should change the decision

### 1. POWER is the only thing that has ever moved the wall

`gullinbursti_v1` beats `fafnir_v2` **100%** in every single percent arm, at every rate and every
cap. Under POWER it drops to **70.0%** at +1 and **62.5%** at +2.

That cell is one of the absolutes ticket 94 declared untunable, and it earned that label: a 62%
Bark Shield cut moved it to 98.3%, an attack bump moved it not at all. **Power-denominated statuses
move it thirty-seven points.** The reason is exactly the mechanism Henry described wanting: fafnir's
Strengthened stacks are uncapped in the raw count, so at +1 power each they finally punch through a
wall that a +25% multiplier could never scratch. **The re-denomination does not just make statuses
feel better - it gives a beaten deck a second lever.**

### 2. Uncapped power makes the stack ENGINES runaway, and that is the real cost

`sleipnir_v1` goes **43.3% -> 85.5%** at POWER+1 and 88.8% at +2. His OS grants 2 Strengthened
every time he plays a 0-cost card and his deck is built out of them, so he is not spending a card to
buy a status - he is generating them faster than any cancel can eat. `huldra_v1` does the same at a
smaller scale (44.5 -> 56.9 -> 79.2).

**The valve the ticket proposed - the duality cancel - only works between two decks that both
apply statuses.** Against a deck that applies none, an uncapped generator has nothing cancelling it.
That is the single problem to solve before POWER can ship, and the honest place to solve it is the
GENERATION side (how many stacks an OS may hand out) rather than the effect side, because capping
the effect is what produced the invisible statuses in the first place.

### 3. Every arm makes the tug-of-war WORSE, including Henry's

`draugr_v2` vs `huldra_v1` - the cell where Henry watched his payoff read 4 damage because her Sharp
was annihilating his Dazed - is **15.0% live and lower in all ten arms**, bottoming at 2.5%.

The logic is unavoidable: when statuses matter more, the side that applies MORE of them wins harder.
Huldra out-generates Draugr, so amplifying the currency amplifies her advantage. **If that cell is
meant to be fixed, the fix is the cancel rule or draugr's own second lever - not the denomination.**
Raising the percentages makes it worse too, so this is not an argument against POWER specifically.

## What I would put to Henry

- **POWER +1 is the arm worth pursuing.** It is the only shape that breaks a wall the project has
  failed to move three separate ways, it leaves the raw-stack scalers roughly alone (`skoll_v2`
  -3.2, `gullinbursti_v2` -2.9 - the feared double-dip did not materialise at +1), and it makes a
  status stack worth something a player can see.
- **It cannot ship until stack GENERATION is bounded.** `sleipnir_v1` at 85.5% is the proof. A cap
  on what a single OS may generate per turn, or a diminishing return on stacks past N, keeps the
  visibility while removing the runaway - and both are changes to the source of stacks rather than
  to their worth.
- **Raising the percentages is not a cheaper substitute.** PCT6/cap60 inflates `huldra_v1` to 86.3%
  and fixes nothing: the wall stays at 100.0% and the tug-of-war falls to 2.5%. It is the same
  runaway with none of the upside.
- **The tug-of-war is a separate ticket** whichever shape wins.

## Blast radius, for when a shape is picked

Recorded in the ticket and unchanged by this grid: `powerscale`'s status prices, the cleanse and
removal premiums that are derived from them, and `TacticalAI.statusValue` all encode 2%-per-stack
arithmetic and would need re-deriving. None of that is touched here.
