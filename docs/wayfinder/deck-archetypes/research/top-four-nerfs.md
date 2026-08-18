# The top four, shipped (ticket 80): all four nerfs together

Henry's picks from ticket 79's knob list, applied and tested **together** because these four decks
play each other. Baseline `7261b4f`. Measured on the full 960-cell grid at 30 iterations x both
turn orders.

| deck | before | after | change made |
|---|---|---|---|
| `ymir_v2` | 81.3% | **69.0%** | `maxCardsPerTurn` 2 -> **1** |
| `hel_v2` | 81.4% | **71.0%** | blood price 5% -> **6%** per Energy, cap 20% -> **25%** |
| `nidhoggr_v1` | 78.2% | **68.2%** | defense 80 -> **68** (species-level) |
| `nidhoggr_v2` | 75.7% | **69.1%** | same defense change |

All four land in a 68-71% band, inside the 0.35-0.80 field gate. **No card was touched.**

## The one that did not go to plan

Henry: *"hel move to 6% energy cost but remove the 20% cap. If she is too OP try 25% and back to
20% if she still is out of control."*

**Removing the cap made her stronger, not weaker: 81.4% -> 87.0% field.** The price rise was worth
about -13 points and the cap removal was worth about +19, so the net was +5.6.

The reason is the interaction the OS-off arm already pointed at. Uncapped she chains Dark casts for
as long as she likes, and the OS's **+50% healing refunds the blood faster than a 1-point price
rise takes it**. Volume beat cost. A cap on a resource you can regenerate is not an arbitrary
restriction - it is the only thing bounding the loop.

Falling back as instructed: **25% lands her at 71.0%**, 20% at 70.0%. One point apart, inside noise
at this sample, so 25% keeps the looser texture. The cap now allows four Energy-points of Dark a
turn (24%) where the old 5%/20% pairing allowed four as well - so **the shape is unchanged and each
cast simply costs 20% more blood**, which is what the price knob was for.

**Worth knowing before anyone tunes this again: the cap moves in Energy-point steps, not percent
steps.** At a 6% price, caps of 18% and 20% are *identical* - both allow exactly three points. Only
19->20->24 crossings do anything.

## `ymir_v2`: the drawback finally bites

`maxCardsPerTurn` sat at 2 for three tickets and never bound - ticket 50 wrote that down and nobody
acted on it, and ticket 79 measured her playing **1.06 cards a turn** against it. Meanwhile the Ice
bonus was walked 50% -> 35% -> 25% three separate times without fixing her.

Setting the cap to 1 is worth **-12.3 points** and changes what she actually does by a quarter of a
card a turn. Her 100%-cells go from 15 to 6. The +25% Ice bonus is untouched, which is the half of
the OS that works.

## The nidhoggrs: one stat change, both decks

They share a species stat block, so defense 80 -> 68 covers both. Chosen over the OS knobs on
Henry's call - *"the other ones feel too targeted and remove the fun"* - and the ticket-79 data
agreed for v1 anyway, where the OS knob was measured backwards (gating maintenance on a **large**
Poison pile makes it fire *more* late, not less).

`nidhoggr_v1` 78.2% -> 68.2% with 100%-cells 4 -> 1; `nidhoggr_v2` 75.7% -> 69.1%, 2 -> 1. Both
OSes are exactly as designed. `wither_feast` still lands on turn 4.4 for 39% of a health bar - the
payoff was never the problem, the frame it was mounted on was.

## Roster effect

| | before | after |
|---|---|---|
| absolute 0% cells | 80 | **71** |
| absolute 100% cells | 78 | **70** |
| NEUTRAL absolutes (0 / 100) | 34 / 33 | **26 / 26** |
| band violations | 411 (42.8%) | **369 (38.4%)** |
| FTK | 2 | 2 |

**This is the largest single improvement to roster health we have measured** - 42 fewer out-of-band
cells and 15 fewer neutral absolutes, which are the ones the bucket-band standard actually gates.

Everything not targeted moved **+1.0 to +2.5 points**, which is the arithmetic of four strong decks
getting weaker rather than anything happening to them. 25 decks moved by at least a point and every
one of them moved *up*.

Unit suite **843/843**. `npm run balance` 8-DIFF: 5 of 67 rows, all in the three affected species.
Redlines 54 -> 55.

## The new problem, and it was predictable

**`ymir_v1` is now the strongest deck in the game at 77.1%, with 10 cells at an absolute 100%.**

She was second before and untouched by this pass; nerfing her sibling promoted her. `os:ymir` went
62% -> **98%** (v1 over v2), which is the one added redline - a section-2.3 diagnostic, so not a
gate failure, but it is the honest cost of nerfing one variant and not the other.

Ticket 79 already named her mechanism: **`avalanche` is "9 power per Bark Shield stack",
explicitly uncapped, behind two 0-cost `frost_ward`s and two `rimeguard`s** - the third instance of
the 0-cost-engine-into-unbounded-multiplier shape, after `jormungandr_v1` and `ratatoskr_v1`. She is
the obvious next pass, and since caps are off the table the lever is the rate (9 per stack) or the
shield the engine generates.

Second on the list: **`hraesvelgr_v2` at 75.2%**, which has never had a pass and is now second.

## Method note

Testing all four together mattered. Measured individually at 15 iterations the knobs predicted
67.6 / 65.9 / 67.0 / 67.3; together at 30 they landed 71.0 / 69.0 / 68.2 / 69.1 - every one **2-3
points higher**, because each deck's nerf makes its three former rivals slightly easier for the
others. Single-deck arms systematically over-state a simultaneous nerf. Added to `METHOD.md`.
