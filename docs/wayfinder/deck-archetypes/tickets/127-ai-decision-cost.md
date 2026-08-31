# Ticket 127 — the enemy turn takes 16 seconds, and 5.4 of them were paid twice

**Status:** PARTIALLY SHIPPED. The pause/search reorder is done; the beam needs a ruling.
From Henry's ticket-118 playtest: *"enemy turns are taking a long time between each card. Its slow to
think"*, and *"the AI is incredibly slow here. Taking a couple seconds to even play a card."*

Full measurement: `docs/wayfinder/deck-archetypes/research/ai-decision-cost.md`.

---

## What it costs

3v3, ticket-118 comp, 60 timed ENEMY decisions (`scratch/aiprof.ts`):

| | ms / decision | reducer sims / decision |
|---|---|---|
| 1v1, full tier, no beam | **6.3** | 87 |
| **3v3, full tier, no beam — what ships** | **1320** | **93,889** |
| 3v3, full tier, `AI_BEAM=8` | 569 | 44,501 |
| 3v3, greedy tier, no beam | 1003 | 79,252 |

An enemy turn is **7.0 plays plus END_TURN = 8 decisions** (counted, not assumed), so **10.6 s of
thinking**. `BattleArena` then adds `1200 + 7 × 600` = **5.4 s of pacing, serial with it**. ~16 s.

## The three findings

1. **Width, not depth.** 1,079× the simulations for 3× the bodies, because `findBestSequence` is
   `branching ^ MAX_DEPTH` and branching is casters × hand × targets.
2. **The lookahead is not the cost.** Greedy — no lookahead at all — still costs 76% of full.
   Downgrading the enemy's grade buys 24% and makes the AI worse. Not the lever.
3. **The 2× that already exists is unreachable from the game.** `AI_BEAM` halves full tier, and it is
   read from `process.env`, which `vite.config.ts` defines to `{}` in the app bundle. In the browser
   `BEAM` is 0 and nothing can change it.

## Shipped here

**Think during the pause instead of after it** (`BattleArena.tsx`). The pause becomes a floor on how
fast a play may appear rather than an addition to it. **16 s → 10.6 s**, no behaviour change.

It does **not** fix the freeze — `getBestAction` is synchronous on the main thread, so the lock now
lands during the beat instead of after it. That needs steam-release ticket 39's Web Worker.
A 50 ms debounce stays in front of the search: the old 600 ms pause was doubling as the thing that let
a superseded effect cancel, and computing at the top of the effect searches twice per decision under
React's dev double-invoke.

## Gate re-run, because it was stale

`3v3-optimisation.md` gated the beam as bit-identical on 90 1v1 cells and asked for a re-run after any
card-pool change. Tickets 115, 123, 124 and 126 all changed the pool. `scratch/beamgate.ts` re-ran it:

**0 of 90 cells moved**, and the beam is **proven live** — the gate asserts with `AI_CENSUS=1` and
throws if nothing was pruned; it pruned 336 / 933 / 70 across the three rows.

Still unproven: what the beam does to a **3v3** outcome. It is an approximation there by design.

## Needs your ruling

Make the beam reachable and default it to 8 — either as a one-line constant default (my
recommendation) or as a per-battle field beside `enemyAiTier`. Estimated enemy turn afterwards:
**~4.6 s**. I would run a 3v3 outcome check before it becomes the default; that is affordable now.

## Ruled out, do not redo

A transposition table. `3v3-optimisation.md` built one, proved the key sound with zero mismatches, and
measured it **3.4× slower**. Alpha-beta does not apply to the expensive half — inside a turn there is
no min/max alternation to cut against.

## Recorded, unmeasured

The search computes the best 3-card **sequence** and returns only its first action, then recomputes the
whole tree next decision. Reusing the plan's tail would cut searches per turn up to 3×. Not exact —
the lookahead re-ranks every decision — so it would need the same 90-cell gate.
