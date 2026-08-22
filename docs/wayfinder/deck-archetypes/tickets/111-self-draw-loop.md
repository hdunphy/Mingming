# Ticket 111 — a 0-cost card can draw itself forever, in four cards across seven shipped decks

**Status:** OPEN. Diagnosed and reproduced 2026-08-21 on `legion/balance`. **No engine change made** —
the fix waits until ticket 110's probe has finished measuring, so an engine edit cannot contaminate it.
**Needs no ruling from Henry**; it is a correctness bug, not a balance decision.

---

## 1. The defect

`handlePlayProgram` appends the played card to the **discard** while paying its cost — step 3 of the
snapshot pattern, `battleReducer.ts:286` — **before** its actions resolve at step 4. `drawCards`
(`deckLogic.ts:16`) auto-shuffles the discard into the drawpile whenever the drawpile is empty. So a
0-cost "draw a card" played on an empty drawpile finds its own copy in the discard it was just placed
in, shuffles it back, and draws it into hand. The state afterwards is **identical** to the state
before, minus one advanced seed — and the card costs 0 Energy, so nothing bounds the repetition.

Reproduced directly, `scratch/glimmerloop.ts`, five dispatches:

```
start            { hand: 'glimmer', drawpile: 0, discard: 0, played: 0, energy: 3 }
after play 1     { hand: 'glimmer', drawpile: 0, discard: 0, played: 1, energy: 3 }
after play 5     { hand: 'glimmer', drawpile: 0, discard: 0, played: 5, energy: 3 }
LOOP CONFIRMED
```

A perfect fixed point: hand, drawpile, discard and energy all unchanged. The in-game repro on record
from ticket 100 is `valkyrie_v2` vs `huldra_v1`, seed 761868416, turn 8, `glimmer` ×3949 — where 3949
is the walker's step guard, not the end of the loop.

## 2. It is a CLASS of four cards in seven decks, not one card in one deck

Every 0-cost, non-exhaust card that puts a card in hand (audited across the whole registry):

| card | text | decks holding it |
|---|---|---|
| `glimmer` | Draw a card. | `valkyrie_v2` |
| `slipstream` | Draw a card. | `hraesvelgr_v1`, `hraesvelgr_v2`, `sleipnir_v1` |
| `undertow` | The current pulls: draw a card. | `jormungandr_v1`, `kraken_v1` |
| `forage` | Draw 1. Take damage equal to 15 power. | `hel_v2`, `ratatoskr_v1` |

`forage` is bounded only in the sense that the loop kills you. Everything at 1 Energy or more is
bounded by the energy economy; `echo_of_valhalla` and `strength_burst` exhaust, so they are safe.

**Ticket 100 found this on `glimmer` and named one card. The fix has to target the class.**

## 3. Measured: it does NOT fire in the sims, so no published number is contaminated

This mattered enough to check before anything else, because three of `panel-zoo`'s three decks hold a
loop-class card and so does `panel-control`'s `kraken_v1` — the exact comps ticket 109's headline rests
on. `scratch/loopcheck.ts` counts real plays only (the bus is muted throughout the AI's search, per
`0-AI-SIM-COUNTS`):

| | 1v1, 30 games | 3v3, 6 games |
|---|---|---|
| max plays in a single turn | 9 | 15 |
| longest same-card streak | **3** (`undertow`, twice) | **2** |
| streaks of 3+ | `{undertow: 2}` | none |
| deck shuffles per game | 3.00 | **1.33** |

**No runaway turn in either sample. Ticket 109's zoo numbers stand.** The loop starts and terminates,
because in a real game the discard holds more than the looping card, so the reshuffle returns a full
pile and the card drawn back is usually something else. The pathological case needs the discard to be
*only* the looper, which is what the valkyrie repro had (hand 5, drawpile 0, discard 0).

**A guess of mine, falsified and worth recording:** I expected width to make the loop *more* likely,
since the 3v3 pile is shared and draw is `sum(cardDraw)-(N-1)`. It is the opposite — shuffles per game
fall 3.00 → 1.33, because games are only 1.33× longer while the shared pile is 3× bigger. **The
precondition is rarer at width, not commoner.**

## 4. Why it has survived

`runPairedBatch`'s per-turn action cap ends the game, so the balance sim records an **ordinary
truncated result** rather than a hang. A human hits a turn that never ends. This is the same shape as
`0-CACHE-FIRMWARE-BLIND`: an instrument reporting something plausible instead of failing loudly.

## 5. The two candidate fixes, and which one I would take

**Fix A — move the played card to the discard AFTER resolution.** This is the actual defect. But
ticket 105's fizzle guard depends on the current ordering, and says so in a comment at
`battleReducer.ts:357`: *"The card is already paid for and already in the discard by this point, which
is the correct outcome for a cast whose price killed you: it is spent, and it fizzles."* Fix A breaks
that invariant and the fizzle path would have to discard explicitly. Also in the blast radius:
`PLAY_LAST_CARD` / `reprogram`, whose ordering the reducer already comments on for `lastProgramPlayed`,
and the `DISCARD` executor, which reads discard length before and after to identify what it just
discarded (`ActionExecutors.ts:453-469`).

**Fix B — exclude the currently-resolving card from a mid-resolution reshuffle.** Narrower, fixes the
whole class in one place, and touches no ordering anything else depends on. `drawCards` would need to
know which instance is resolving, which the reducer has.

**Recommendation: Fix B.** Fix A is more principled and more expensive, and its cost lands on two
mechanics that were each hard-won (105's fizzle, and Reprogram's echo ordering). Fix B is the smaller
blast radius for the same coverage, which is the trade this repo has taken before — the
`0-FIRMWARE-CAP-ESCAPE` precedent, hand-written over a data-model change for one consumer.

**Gate for either fix:** the repro test asserting the loop cannot form, **verified to fail without the
fix**; the 1v1 grid re-run proving play did not move (`scratch/pool.mjs --verify` for bit-identity);
and `loopcheck.ts` re-run to confirm the streak counts do not change, since a fix that also stopped
legitimate reshuffle-draws would show up there.


---

## 6. GRID GATE (2026-08-22) — and a reimplementation it forced

**The first cut of Fix B filtered the resolving card out BEFORE the shuffle.** That shuffles n-1
cards where the engine used to shuffle n, so it consumes a different amount of the PRNG and re-rolls
the drawpile order for *every* reshuffle in the game. Instrumented (`scratch/exclusionscan.ts`,
temporary counters, reverted): **all 32 decks reach that path**, and on `hel_v2` 19,056 of 25,363
reshuffles had the exclusion change the shuffle input. A correctness fix would have forced a full
1v1 re-baseline as a side effect.

**Reimplemented: shuffle the whole discard first, then extract the resolving card from the result.**
The PRNG stream is then byte-identical to the old behaviour and exactly one thing changes — the card
mid-resolution is not available to its own draw. It returns to the discard and is drawable again on
the next reshuffle.

**Measured, every deck against a five-deck spread, 155 cells, fix ON vs fix OFF:**

| | cells |
|---|---|
| bit-identical (win rate AND turns) | **97 of 155 — 62.6%** |
| moved at all | 58 |
| moved 5+ win points | 30 |

Largest movers: `hraesvelgr_v2` vs `kraken_v1` −40.0, vs `skoll_v1` −25.0; `hraesvelgr_v1` vs
`audhumbla_v2` −15.0; `sleipnir_v1` vs `audhumbla_v2` +15.0. At 10 iterations (20 games a cell) five
points is a single game, so most of the 30 are one-game flips; the −40 and −25 are real.

**What this means, stated plainly: the fix is NOT bit-identical roster-wide, and it was never going to
be.** Removing a card from a draw changes what gets drawn, and drawing during a card's own resolution
is common. Preserving the shuffle order bought 62.6% identity; the rest is the bug not happening any
more.

**So the 1v1 grid needs a re-baseline** — `docs/balance/deck_grid.json` regenerated at 30 iterations,
960 cells, roughly five hours. Per the HANDOFF's own rule (anything over ~30 minutes gets a standalone
runner rather than a sandbox run) **that is a job to hand Henry, not to run in-session**, and the
field numbers quoted anywhere from the old grid should be treated as pre-fix until it lands.
