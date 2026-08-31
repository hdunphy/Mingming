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

---

# Part two — shipped 2026-08-31

Henry: *"That would be great. We should also show the cards that get played, animate them to show
center screen so the player knows what was played rather than having to check the log. That animation
can eat up the time as well."*

## The beam is on in the game and off in a harness

Not a global default of 8 — that would have silently re-baselined every balance number on record,
because every `scratch/` instrument and every `src/debug/` suite runs under Node and ticket 108's rule
is *"confirm anything you intend to act on at full, BEAMLESS"*.

The default is keyed on the thing that separates the callers: **a harness runs under Node, the game
does not.** `globalThis.process` exists in vite-node, vitest and every scratch lane, and not in a
browser or the Electron renderer.

```
browser  -> beam 8      the player gets the 2.3x
Node     -> beam 0      every measurement keeps the search it was calibrated against
AI_BEAM  -> overrides either way, and AI_BEAM=0 means beamless rather than "unset"
```

`resolveBeam(hasNodeProcess, override)` is extracted and unit-tested on both branches, because a test
cannot reach the browser branch by running in a browser — vitest is Node and jsdom does not remove
`process`. One-line revert if you want it out: `GAME_BEAM_WIDTH`.

## The played card, held at centre stage

`useBattleVfx` publishes a `PlayedCardAnnouncement` off `PROGRAM_PLAYED`, and `PlayedCardReveal`
renders the **real `ProgramCard`** — that event's `programId` is the dataId, so there is no second card
face to drift from the one in the hand. The reveal is `pointer-events: none` (it sits over the stage
while the player may be mid-drag, and a face that swallowed a pointer-up would eat a play), it is not
on an expiry timer (a timer would race the enemy loop's hold — the next play or the turn ending
replaces it), and the player's own casts get the same reveal arriving from their side of the stage.

**The between-actions beat is now the reveal**: `PLAYED_CARD_REVEAL_MS` (700ms) with the card on
screen, then the search. Old: 600ms of nothing plus 1320ms of thinking. New: 700ms of card plus 569ms
of thinking.

| | think / decision | enemy turn (8 decisions) |
|---|---|---|
| before ticket 127 | 1320 ms | **~16.0 s**, blind and frozen |
| pause/search reorder | 1320 ms | 10.6 s, blind |
| + beam on in the browser | 569 ms | ~4.6 s |
| **+ the reveal hold** | 569 ms | **~10.1 s, every second showing a card** |

The comparison that matters is not 4.6 against 10.1 — it is **10.1 s of legible fight against 16.0 s
of frozen screen and a scrolling log.** The reveal hold is real time, spent on purpose.

## The bug this walked into

`VfxState` had two fields for its whole life, and several `setVfx` branches rebuilt it by listing both
by hand instead of spreading `prev`. Adding a third walked straight in: the `DAMAGE_TAKEN` branch
dropped `playedCard`, so any card that dealt damage cleared its own reveal before it rendered.
`tsc -p tsconfig.app.json` caught it — the same class of error that once survived a full merge and
1984 green tests back when `tsc --noEmit` was resolving an empty program. Now covered by
`playedCardReveal.test.tsx`.

## The 3v3 gate came back "moved", and the size is unresolved

The check the original beam work left open. 6 team pairs x 6 iters x 2 orders per arm:

- **1v1: 0 of 90 cells moved.** Exact identity, re-confirmed on the current pool.
- **3v3: every pair moved.** Mean win rate 51.39 -> 55.55, mean absolute delta **6.94**, max 16.66.
- 72/72 decisive in both arms, zero stalls, mean turns 7.90 -> 8.30.
- The arm is proven live: 28.8M candidates pruned of 39.8M enumerated (89.7M beamless).

**But 12 games per pair cannot resolve an 8-point shift** — the standard error at p=0.5 is ~14 points,
and three of the six deltas are exactly ±8.33, which is *one game in twelve*. Ticket 108 measured full
tier disagreeing with **itself** across seed bases at MAD 6.0–13.2; the beam's 6.94 is inside that
band. A second seed base is running to get the 3v3 self-disagreement figure directly, which is the
honest denominator.

**Shippable anyway, and the risk named plainly:** the balance corpus is not exposed (Node stays
beamless, so nothing re-baselines and no future grid is silently beamed). The exposure is confined to
*the enemy sometimes taking the second-best line at 3v3* — a quality-of-play cost, not a balance one,
paid for 2.3× in the mode the game ships. It never stalled and never failed to resolve.

## Still needs an eyeball

The reveal's **rendering**, same caveat as ticket 125's chips: the data layer is covered, the visual is
not. Worth watching for whether 700 ms is the right hold when the enemy casts seven cards a turn, and
whether the card wants to be smaller or higher so it does not cover the sprite being hit.
