# The absolutes cannot be tuned (ticket 94)

Henry asked for a balancing pass on the remaining 0/100 matchups, the same shape as the nerf and
buff passes. **The pass ran, and it produced a negative result that is worth more than a ship:
these cells do not respond to tuning at all.** Nothing is shipped, deliberately.

## What was tried

The 20 remaining neutral absolutes group into three engines, not six decks
([absolutes-diagnosis.md](absolutes-diagnosis.md)):

- **8 cells** - `audhumbla_v2` has no clock (her whole offence is 50% of her heal power via
  NOURISH_ROUTINE, on 10.5-turn games).
- **5 cells** - `gullinbursti`'s wall (up to 13 Sharp AND 21 Bark Shield, the only uncapped
  mitigation in the game).
- **3 cells** - `fafnir_v2` buys damage with self-inflicted debuffs and pays it into that wall.
- 4 singles.

Every lever below was measured against **the cells themselves** at 30 iterations, not against field
win rate - which turned out to be the whole lesson.

## What happened: field moves, rails do not

| arm | field | the cells |
|---|---|---|
| `audhumbla_v2` live | 42.2% | 0 / 0 / 0 / 0 / 0 / 100 / 98 |
| NOURISH 50% -> **55%** | 48.4% | **0 / 0 / 0 / 0 / 0 / 100 / 100** |
| NOURISH 50% -> **60%** | 56.7% | **0 / 0 / 0 / 0 / 0 / 100 / 100** |
| NOURISH 50% -> **65%** | **65.4%** | (blowout count went UP) |
| NOURISH 60% **+ `sacred_spring` -> `supernova_v2`** (108 power) | - | **0 / 0 / 1.7 / 0 / 100** |
| `gullinbursti_v1` live | 51.0% | 100 / 100 |
| Bark Shield **-40%** (5/8/8 -> 3/5/6) | 42.5% | **95 / 100** |
| Bark Shield **capped at 12%** maxHP | - | **98.3 / 100** |
| Bark Shield **capped at 8%** maxHP | - | **98.3 / 100** |
| `fafnir_v2` live | 39.2% | 0 / 0 |
| species attack 68 -> **74** | 46.4% | - |
| `veinburst` -> `crag_barrage` (multi-hit) | 26.8% | - |
| opponent's shield capped at 8% | - | **1.7 / 0** |

**Read the audhumbla row again.** A 20% better conversion rate *and* swapping her biggest heal for
a 108-power nuke - the largest change short of a rebuild - and she still loses **60 games out of
60** to `gullinbursti_v1`, `huldra_v1` and `valkyrie_v1`. Her field win rate rose fifteen points on
the way. **She got much stronger against the middle of the roster and did not win a single extra
game at the rails.**

And cutting the wall by 62% - Bark Shield capped at 8% of maxHP against the 21% it reaches today -
moved `gullinbursti_v1` vs `fafnir_v2` from 100% to **98.3%**.

## Why

These are not near-misses that rounding pushed to zero. They are **throughput mismatches of a
different order**. `audhumbla_v2` deals single digits a turn into an 85-100 HP frame carrying 90
defence, a 21% shield and Regen. To cross that threshold she does not need 20% more damage, she
needs three or four times more - at which point she is a different deck. Every knob in range moves
her along the part of the curve where the opponent's sustain already loses, and none of it reaches
the part where it does not.

This is the measured version of what Henry said after playing them:

> *"There doesn't feel like a possible way to win those fights and it just feels bad."*

He is right, and now we know a number cannot fix it.

## The instrument, which is the reusable part

`scratch/cells.ts` measures **the specific matchups** at 30 iterations rather than the field.
Field win rate is the wrong instrument for an absolute - it moved 15 points across arms that changed
nothing about the cells, and `offenders`' `<10%` / `>90%` counts include type-advantaged cells,
which the bucket standard exempts. **Any future work on an absolute should start here.**

## The decision, which is Henry's

Two honest options, and they are not tuning:

1. **Accept them as counter-texture, on exactly the argument the bucket standard already makes for
   typed cells.** The shipped game is 3v3 with three simultaneous actives and no switching, so
   `audhumbla_v2` never faces `gullinbursti_v1` alone. If a type disadvantage may be unwinnable 1v1
   because allies cover it, an engine mismatch may be too. **This is a change to the standard, not
   to the decks** - it would retire 16 of the 20 as by-design and leave the four singles.
2. **Rebuild the two losing decks.** `audhumbla_v2` needs a win condition that is not a fraction of
   her own healing, and `fafnir_v2` needs a payoff that a wall cannot eat - a shield-piercing card
   would need engine support, which does not exist today. That is a design session, not a pass.

My recommendation is **(1) for now and (2) when the decks come up for their own passes** - because
the alternative on offer today is shipping a fifteen-point power increase to `audhumbla_v2` that
fixes none of the cells it was aimed at, and that is how a roster gets quietly inflated.

## Not shipped

Nothing. Every arm above is measured and reverted. The two knobs added to the harness
(`nourish`, `shieldnums`, `shieldcap` in `scratch/`) stay, because the next attempt at these cells
should start from the same instrument.
