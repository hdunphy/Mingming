# Top four nerfs (ticket 80): all four shipped together

- Type: wayfinder:task - Henry's picks from ticket 79's knob list, 2026-08-17.
- Status: **closed** (2026-08-18)

## Shipped

| deck | before | after | change |
|---|---|---|---|
| `ymir_v2` | 81.3% | **69.0%** | `maxCardsPerTurn` 2 -> 1 |
| `hel_v2` | 81.4% | **71.0%** | blood price 5% -> 6% per Energy, cap 20% -> 25% |
| `nidhoggr_v1` | 78.2% | **68.2%** | defense 80 -> 68 (species-level) |
| `nidhoggr_v2` | 75.7% | **69.1%** | same defense change |

No card touched. Report: [research/top-four-nerfs.md](../research/top-four-nerfs.md).

## The one that did not go to plan

Henry asked to REMOVE hel_v2's 20% cap alongside the price rise, with 25% then 20% as fallbacks.
**Removing it made her stronger: 81.4% -> 87.0%.** The price rise was worth about -13 and the cap
removal about +19. Uncapped she chains Dark casts, and the OS's +50% healing refunds the blood
faster than a 1-point price rise takes it - **a cap on a resource you can regenerate is the only
thing bounding the loop.** Fell back as instructed: 25% -> 71.0%, 20% -> 70.0%, one point apart, so
25% keeps the looser texture.

**The cap moves in Energy-POINT steps, not percent steps**: at a 6% price, caps of 18% and 20% are
identical (both allow three points). Only 19->20->24 crossings do anything.

## Roster effect - the largest single improvement we have measured

| | before | after |
|---|---|---|
| absolute 0% cells | 80 | **71** |
| absolute 100% cells | 78 | **70** |
| NEUTRAL absolutes (0/100) | 34/33 | **26/26** |
| band violations | 411 (42.8%) | **369 (38.4%)** |
| FTK | 2 | 2 |

25 decks moved by at least a point and **every one moved UP** (+1.0 to +2.5) - the arithmetic of
four strong decks getting weaker. 843/843 unit tests; 8-DIFF 5 of 67 rows, all in the three
affected species; redlines 54 -> 55.

## The new problem, predictable

**`ymir_v1` is now the strongest deck at 77.1% with 10 cells at 100%** - untouched by this pass and
promoted by her sibling's nerf. `os:ymir` 62% -> 98% is the added redline (a 2.3 diagnostic). Her
mechanism is already named in ticket 79: **`avalanche`, "9 power per Bark Shield stack", uncapped,
behind two 0-cost `frost_ward`s** - the third instance of the 0-cost-engine-into-unbounded-multiplier
shape. Caps are off the table, so the lever is the rate or the shield the engine generates.
`hraesvelgr_v2` at 75.2% is second and has never had a pass.

## Method finding

**Single-deck arms systematically over-state a simultaneous nerf.** Measured individually at 15
iterations the four knobs predicted 67.6 / 65.9 / 67.0 / 67.3; shipped together at 30 they landed
71.0 / 69.0 / 68.2 / 69.1 - every one 2-3 points higher, because each deck's nerf makes its former
rivals easier for the others. Added to METHOD.md.
