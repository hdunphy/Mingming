# Decision density: the instrument failed, and the failure is the finding (ticket 99)

The ticket asked: measure which decks ASK the player something, validate the ranking against
Henry's playtest hands, and **if the ranking disagrees with the playtest, the instrument is wrong -
report the disagreement, do not rationalize it.**

It disagrees. All four proxies disagree. Reported.

## What was measured

A decision tap was added to `TacticalAI` (the same seam shape as the store's action tap: ships
inert, only debug fills it). Every time the AI picks a play it now reports how many lines beat
standing pat, the eval gap between the best two, whether the decision was close enough to trigger
the 1-turn lookahead, and whether that lookahead **changed the pick**. 32 decks, 32 games each
against the same 8-opponent spread.

## The ranking, against Henry's hands

| deck | Henry's verdict | flip% | close% | foreclosure% |
|---|---|---|---|---|
| `ymir_v2` | **TOP - choices 5/5** | 19.4 (22nd) | **49.3 (lowest)** | **+67.1** |
| `fafnir_v1` | **TOP - choices 4/5** | 25.7 (9th) | 96.1 | +35.5 |
| `hel_v2` | **TOP - "the most fun"** | 18.8 (28th) | 98.1 | **-19.4** |
| `fenrir_v1` | bottom - 2/5 | 19.3 (24th) | 93.3 | +42.5 |
| `fafnir_v2` | bottom - 1/5 | **30.3 (3rd)** | 99.5 | +31.1 |
| `draugr_v2` | bottom - 2/5 | 28.1 (7th) | 85.3 | +30.8 |
| `audhumbla_v2` | bottom - 1/5 | 19.4 (23rd) | 92.3 | +23.1 |

**Henry's three favourites rank 22nd, 9th and 28th of 32 on flip rate. Two of the decks he found
boring rank 3rd and 7th.** The instrument is close to inverted against ground truth.

Close-call rate is worse than useless: 28 of 32 decks sit between 82% and 99.5%, so it separates
nothing - except `ymir_v2` at 49.3%, the LOWEST on the roster, which is the deck he rated 5/5.

Foreclosure - a fourth proxy added after the first three failed, measuring the share of held cards
never played - does not separate either: `fenrir_v1` (boring, 42.5%) sits between `ymir_v2` (fun,
67.1%) and `fafnir_v1` (fun, 35.5%).

## Why they fail

**Every proxy measures how hard the choice is to COMPUTE. Henry's fun tracks what the choice
COSTS.**

`ymir_v2` is the clearest case. Her close-call rate is the lowest on the roster - the AI almost
always knows exactly which of her cards is best, because it can compute it. And Henry rated her the
most decision-dense deck in the game. Both are true: her OS lets her play **one card a turn**, so
the choice is not *which line scores higher* but *which card I am giving up, this turn and possibly
forever*. The solver never feels the opportunity cost, so its telemetry cannot see the thing that
makes the turn interesting.

`hel_v2` is the same story from the other end. Her foreclosure is **negative** - she plays more
cards than she holds at turn start, because paying HP instead of Energy lets her chain. The cost is
real and it is paid in a currency the eval function treats as just another number.

## What DOES predict Henry's ranking

Read the OS text instead of the telemetry:

| deck | second resource axis |
|---|---|
| `hel_v2` | **HP is a currency** - Dark spells cost 6% max HP per Energy instead of Energy |
| `ymir_v2` | **plays are rationed** - one card a turn, whatever the hand holds |
| `fafnir_v1` | **Energy is bankable** - unused Energy stores and cashes later |
| `fenrir_v1`, `fafnir_v2`, `draugr_v2`, `audhumbla_v2` | none - spend Energy, play cards |

**3 of 3 of his favourites have a second resource axis. 0 of 4 of the decks he called boring do.**

That is a perfect separation, it took no simulation to produce, and it is exactly the prediction the
ticket put on record - *"decks with an alternate resource - HP-casting, hoard, forced scarcity,
growing energy - top the table"*. The prediction was right; **none of the four proxies were the
route to it.**

It is also ticket 87's finding arriving from the other side. That ticket measured that every deck
has the same economy - 2 Energy, 3 cards - and concluded the archetypes had no axis to live on.
This says the same thing in the player's language: **a deck with one resource has one kind of turn.**

## The full roster on this reading

Second resource axis, by inspection of the firmware:

- **`hel_v2`** HP-as-currency; **`ymir_v2`** rationed plays; **`fafnir_v1`** banked Energy;
  **`hraesvelgr_v2`** and **`audhumbla_v1`** growing max Energy; **`draugr_v1`** turns-as-resource
  (acts while Asleep, wakes for Energy); **`hraesvelgr_v1`** chosen discard; **`sleipnir_v2`**
  generated fodder for discard costs.
- **The other 24 decks have exactly one resource.**

Eight of thirty-two. And three of the eight are the three decks Henry picked out unprompted.

## What I would do with this

1. **Stop trying to measure decision density from AI telemetry.** A solver cannot report opportunity
   cost, and everything cheap to instrument is a proxy for computational difficulty.
2. **Audit the second axis instead** - it is a one-line read per OS, it separates Henry's hands
   perfectly, and it turns into a design rule: *every deck should have something to spend besides
   Energy.*
3. **The 24 single-resource decks are the backlog**, and it is the same backlog ticket 88 produced
   from the economy side. That is two independent routes to the same list, which is the strongest
   argument yet for spending a pass on it.

## Kept

`scratch/decisions.ts` and the `setDecisionTap` seam stay. The numbers are real even though the
hypothesis they were built to test is wrong, and the tap is the only way to see the AI's candidate
distribution at all - it will be worth having when the AI itself is next under review.
