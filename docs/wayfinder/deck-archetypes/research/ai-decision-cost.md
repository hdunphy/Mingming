# Where an enemy turn actually goes: 16 seconds, and 6 of them are paid twice

- Type: wayfinder:research. **Ticket 127.** Branch `legion/ai-perf`, from `f2f6c1e`.
- **2050 tests green**, `tsc -p tsconfig.app.json` clean.
- Instruments: `scratch/aiprof.ts` (per-decision cost), `scratch/beamgate.ts` (1v1 identity gate).

Henry, ticket-118 playtest: *"enemy turns are taking a long time between each card. Its slow to
think"*, and on the stacked comps *"the AI is incredibly slow here. Taking a couple seconds to even
play a card."*

---

## 0. The short version

**A 3v3 enemy turn costs about 16 seconds today.** Ten and a half of those are the AI thinking; the
other five and a half are the deliberate pacing in `BattleArena` — and the two were **serial**, so
the player paid both. One reorder removes the five and a half.

**The thinking is 219× more expensive at 3v3 than at 1v1** — 1320 ms a decision against 6.3 ms —
and the cause is not the lookahead. It is the same-turn enumeration, and there is already a
built, measured, grid-gated switch that halves it: `AI_BEAM`. **The shipped game cannot reach
it.** It is read from `process.env`, which `vite.config.ts` defines to `{}` in the app bundle, so in
the browser the beam is permanently off no matter what anything asks for.

| lever | enemy-turn cost | state |
|---|---|---|
| today | **~16.0 s** | shipping |
| pause overlapped with the search | **10.6 s** | **done, this branch** |
| + `AI_BEAM=8` reachable and on | **~4.6 s** | needs your ruling — gate re-run below, 0/90 moved |
| + search off the main thread | same, but not frozen | ticket 39 already asks for it |

---

## 1. The measurement

`scratch/aiprof.ts` plays real turns of the ticket-118 comp — control panel (kraken/huldra/draugr)
against zoo panel (jormungandr/sleipnir/hraesvelgr) — and times every **ENEMY** `getBestAction`.
Real turns rather than a constructed board, because the expensive decisions are the ones with a full
hand and three living targets, and a synthetic mid-game state would have measured whatever I built.

**It profiles the enemy side on purpose.** The tier is a property of the battle and it describes the
enemy only (`IBattleState.enemyAiTier`, steam-release ticket 67). That is also the only switch that
works: **under vite-node an environment variable reaches module code by no route at all** — probed,
`globalThis.process.env` has zero keys — so `AI_LITE=1` in front of a harness silently profiles
`full`. My first three runs of this probe all printed `tier full` and I nearly reported them as a
tier comparison.

60 ENEMY decisions per row, 3v3 unless stated:

| arm | mean | median | p95 | reducer sims / decision |
|---|---|---|---|---|
| **1v1**, full, no beam | **6.3 ms** | 5.2 | 18.6 | **87** |
| **3v3, full, no beam** ← ships today | **1320 ms** | 1339 | 3652 | **93,889** |
| 3v3, full, `AI_BEAM=8` | 569 ms | 671 | 1260 | 44,501 |
| 3v3, lite, no beam | 1031 ms | 671 | 4377 | 81,234 |
| 3v3, lite, `AI_BEAM=8` | 513 ms | 425 | 1498 | 32,989 |
| 3v3, greedy, no beam | 1003 ms | 674 | 5026 | 79,252 |
| 3v3, greedy, `AI_BEAM=8` | **257 ms** | 202 | 1015 | 29,049 |

Three things fall straight out of that table.

**The width is the whole problem.** 87 simulations a decision at 1v1, 93,889 at 3v3 — 1,079×, for
three times the bodies. `findBestSequence` recurses over every *ordering* of every play available
this turn to `MAX_DEPTH` 3, so cost is `branching ^ 3` and branching is casters × hand × targets.
Roughly 6 at 1v1 and 20 at 3v3. Cubed, that is the gap.

**The lookahead is not where the money is.** Greedy has no lookahead at all and still costs 1003 ms
against full's 1320 — **76%**. So the entire lookahead is under a quarter of the cost, and turning
the AI stupid buys 24%. That matches what `3v3-optimisation.md` measured a different way (greedy
34.4 s of a 52.3 s battle). **Downgrading the enemy's grade is not the fix**, which is worth saying
plainly because it is the first knob anyone reaches for.

**The beam is where the money is.** It halves full (1320 → 569) and quarters greedy (1003 → 257),
because it cuts the exponent of the enumeration rather than trimming the layer on top.

## 2. The enemy turn is 8 decisions long, and it paid for each one twice

`aiprof` counts the plays the enemy actually makes before ending its turn rather than assuming a
number: **7.0 plays per turn at 3v3 full tier**, plus the closing `END_TURN` = **8 decisions**. Three
bodies with per-mingming energy and a shared 7-card draw is a long turn.

So the thinking is `8 × 1.32 s` = **10.6 s**.

Then `BattleArena.tsx`'s enemy loop:

```ts
await new Promise(r => setTimeout(r, 1200));   // or 600 between actions
if (cancelled) return;
const action = getBestAction(battleState);     // ← 1.3 s, AFTER the wait
```

`1200 + 7 × 600` = **5.4 s of pacing, serial with 10.6 s of thinking**. Total **~16 s**, and the tab
is frozen through each 1.3 s search because `getBestAction` is synchronous on the main thread.

**Nothing about the pause requires the board to be undecided while it elapses.** Ticket 127 makes the
pause a *floor* on how fast a play may appear rather than an addition to it: think first, then sleep
whatever of the beat is left. A fast decision still waits its full beat — the pacing is deliberate,
the player has to see what happened — and a slow one has already spent the beat thinking.

**8 × 1.32 s = 10.6 s. The 5.4 s is gone.** No engine change, no behaviour change, no ruling needed.

Two honest caveats, both in the code comment:

- **It does not fix the freeze.** The UI is still locked for the duration of each search; the freeze
  now lands *during* the banner/beat instead of after it. Un-freezing needs the search off-thread,
  which is what steam-release ticket 39 already asks for (*"move the AI to a Web Worker if it exceeds
  1.0 s p95"* — it exceeds it by 3.6×).
- **A 50 ms debounce stays in front of the search.** The old 600 ms pause was doubling as the thing
  that let a superseded effect cancel before spending a second in the search. Computing at the top of
  the effect would have run the search twice for one decision under React's dev-mode double-invoke.

## 3. The 2× the game cannot reach

`AI_BEAM` was built in `3v3-optimisation.md` and it is the right shape: it still enumerates every
candidate at a node (the simulation **is** the score) but recurses into only the best `BEAM` of them,
cutting the exponent rather than the base. It shipped **off by default**, opt-in per run:

```ts
const BEAM = Number(env.AI_BEAM ?? 0);
```

where `env` is `globalThis.process?.['env'] ?? {}`. In a browser `globalThis.process` is undefined, so
`env` is `{}`, so **`BEAM` is 0 in the shipped game and there is no way to set it.** The 2× exists, is
measured, is gated — and is unreachable by the only build a player runs. That is not a bug in the
original work; it shipped deliberately off. It is a gap between "opt-in per run" and a product that
has no runs.

### The gate, re-run, because it was stale

`3v3-optimisation.md` put the caveat on the record rather than burying it:

> that identity is EMPIRICAL, not structural. **Re-run the grid gate after any change to the card
> pool.** Do not read "bit-identical on 90 cells" as "cannot move".

The pool **has** changed since: ticket 115 moved five control cards to Side scope, 123 rescoped
`CARDS_PLAYED` to the caster, 124 made `rimebreaker` pay a stack, 126 moved Burn/Poison/Regen to turn
start. Every one of those moves branching, the eval, or both. So the claim was not held up by
anything as of this branch.

`scratch/beamgate.ts` re-runs it — the same three deck rows, `draugr_v2` / `hel_v2` / `huldra_v1`,
10 iterations, seed base `grid`:

**0 of 90 cells moved.** Win rate and average turns are identical to two decimal places in every cell.

**And the arm is proven live**, which is the part that matters after four dead arms in this arc: the
gate runs with `AI_CENSUS=1` and asserts the beam pruned something, throwing if it did not. It pruned
**336 / 933 / 70** candidates across the three rows at beam 0 versus beam 8 — so 1v1 branching does
exceed 8 occasionally, the beam is not a no-op there, and those lines simply were not going to win.
A beam that had failed to load would have printed two identical rows and I would have reported
bit-identical having run the same build twice.

### What is still not proven

The 90 cells are **1v1**. The beam is an approximation *in 3v3* — it ranks the deferred candidates on
their immediate score, so it under-reads lines whose payoff is one play further on, the same bias
ticket 108 measured in the cheap AI tier. Nobody has measured what it does to a 3v3 outcome, because
until now a 3v3 grid was unaffordable. It is less unaffordable at 569 ms a decision.

## 4. What I recommend, and what needs you

**Shipped on this branch, no ruling needed:** the pause/search reorder. 16 s → 10.6 s.

**Wants your ruling:** make the beam reachable and default it to 8. Three ways, in order of how much
they respect the existing design:

1. **Per-battle field, next to `enemyAiTier`.** `IBattleState.aiBeam`, set at battle creation exactly
   as ticket 67 set the tier, defaulting to 8. Fits the precedent, and lets the gauntlet run beamless
   later if that ever matters. Most code.
2. **Default the constant to 8** and keep the env override for harnesses. One line. The env override
   stays dead in the browser, which is fine — the browser now gets the good default.
3. **Derive it from the tier**, like `lookaheadTopN`. Tidy, but it entangles two calibrations that
   were measured separately, and I would rather not.

I would take (2) now and (1) if the gauntlet ever needs a beamless grade. Either way I want the
3v3 outcome check run before it is default, and it is affordable now.

**Then ticket 39's Web Worker**, which is the only thing that fixes the *freeze* rather than the
*duration*. 569 ms a decision still misses ticket 39's own p95 target of 1.0 s at the tail (1260 ms).

**Not recommended:** downgrading the enemy grade (buys 24% and makes the AI worse), and a
transposition table (`3v3-optimisation.md` built one, proved the key sound with zero mismatches, and
measured it **3.4× slower** — do not rebuild it).

## 5. One structural idea, unmeasured

`findBestSequence` computes the best **3-card sequence** and `getBestAction` returns only its first
action — then the next decision recomputes the whole depth-3 tree from scratch. Over a 7-play turn
that is 8 full searches where 3 would nearly do. Reusing the plan for the sequence's tail would cut
searches per turn by up to 3×.

It is **not** exact: the lookahead re-ranks candidates at every decision, so replaying a cached tail
skips that re-rank. It would need the same 90-cell gate. I have not measured it and I am not
proposing it yet — recording it because it is the largest remaining lever and it is invisible unless
you notice the search throws away most of what it computed.

---

# Part two: the beam is on, and the wait now shows you the card

Added 2026-08-31 after Henry's ruling: *"That would be great. We should also show the cards that get
played, animate them to show center screen so the player knows what was played rather than having to
check the log. That animation can eat up the time as well."*

## 6. The beam is on in the game and off in a harness

Flipping `AI_BEAM`'s default to 8 outright would have been the wrong fix, and it is worth saying why
rather than just not doing it. **Every `scratch/` instrument and every suite in `src/debug/` runs
under Node**, and ticket 108's standing rule is *"confirm anything you intend to act on at full,
BEAMLESS"*. A global default of 8 would have silently re-baselined the entire balance corpus with no
commit saying so — the exact failure family this project keeps paying for.

So the default is keyed on the thing that actually separates the two callers: **a harness runs under
Node and the game does not.** `globalThis.process` is present in vite-node, vitest and every scratch
lane, and absent in the browser and in the Electron renderer (the desktop build differs only in
`base`).

```
browser  -> beam 8       the player gets the 2.3x
Node     -> beam 0       every measurement keeps the search it was calibrated against
AI_BEAM  -> overrides either way
```

The rule is extracted as `resolveBeam(hasNodeProcess, override)` and unit-tested on both branches,
because a test **cannot** reach the browser branch by running in a browser — vitest is Node and jsdom
does not remove `process`. Detection stays at the call site; the decision is pinned in a test.

`AI_BEAM=0` deliberately means beamless rather than "unset", so a pre-127 number stays reproducible.

## 7. The wait now carries information

Henry's second instruction is the one that changes the shape of the fix: *"That animation can eat up
the time as well."*

The old between-actions beat was a blind 600 ms with nothing on screen, and then 1.3 s of thinking.
It is now `PLAYED_CARD_REVEAL_MS` (700 ms) with the card that just resolved held at centre stage, and
then the thinking. **Wall-clock is roughly what it was; the time now carries the information the
player was having to dig out of the combat log.** With the beam on it is 700 + 569 ms against the old
600 + 1320 ms — a third less, and the third that remains is showing you something.

- `useBattleVfx` publishes a `PlayedCardAnnouncement` off `PROGRAM_PLAYED`. That event's `programId`
  **is** the dataId (`battleReducer` emits `card.dataId`), so the reveal looks the program up and
  renders the real `ProgramCard` — the same component the hand renders. A hand-built "played card"
  panel would be a second card face, and a second card face drifts the next time a card gains a
  keyword chip.
- The reveal is **not** on an expiry timer. A timer would race the enemy loop's own hold. The next
  play, or the turn ending, is the honest thing that replaces it.
- It is `pointer-events: none`. The reveal sits over the stage while the player may be mid-drag on
  their own turn, and a card face that swallowed a pointer-up would eat a play.
- The player's own casts get the same reveal (arriving from their side of the stage instead of the
  enemy's), but only the enemy loop paces itself to it.

### The bug this walked into, recorded because it was invisible

`VfxState` had exactly two fields for its whole life, and several `setVfx` branches rebuilt the
object by **listing both by hand** instead of spreading `prev`. Adding a third field walked straight
into it: the `DAMAGE_TAKEN` branch dropped `playedCard`, so a card that dealt damage — i.e. every
attack in the game — cleared its own reveal before it rendered.

`tsc -p tsconfig.app.json` caught it, which is worth noting given this project's history: the same
class of error survived a full merge and 1984 green tests back when `tsc --noEmit` was being run
against a solution file that typechecks nothing. There is now a test for it
(`playedCardReveal.test.tsx`, *"survives the damage the card deals"*).

### Still needs an eyeball

The reveal's **rendering** is untested by construction — the data layer is covered, the visual is
not, same caveat as ticket 125's status chips. Worth a playtest look at: whether 700 ms is the right
hold at 3v3 (seven cards a turn is seven reveals), and whether the reveal wants to be smaller or
further up so it does not cover the sprite that is being hit.

## 8. Where the enemy turn stands

| | think per decision | enemy turn (8 decisions) |
|---|---|---|
| before ticket 127 | 1320 ms | **~16.0 s**, blind |
| pause/search reorder | 1320 ms | 10.6 s, blind |
| **+ beam on in the browser** | **569 ms** | **~4.6 s** |
| + the reveal's 700 ms hold | 569 ms | **~10.1 s, and every second of it shows a card** |

The last row is the honest one and it is a deliberate trade Henry made: the reveal hold is real time,
spent on purpose. The comparison that matters is not 4.6 s against 10.1 s — it is **10.1 s of legible
fight against 16.0 s of a frozen screen and a scrolling log.**

The freeze is still there. `getBestAction` is synchronous on the main thread, so the reveal animates
in its 700 ms window and then the tab locks for 569 ms. That is what steam-release ticket 39's Web
Worker is for, and it is now the largest remaining item: 569 ms still misses ticket 39's own p95
target of 1.0 s at the tail.

## 9. The 3v3 gate came back "moved", and the size is unresolved

This is the check the original beam work explicitly left open, and it does **not** reproduce the 1v1
result. `scratch/beamgate3v3.ts`, 6 team pairs x 6 iterations x 2 orders = 72 games per arm:

| pair | beam 0 | beam 8 | delta | turns 0 | turns 8 |
|---|---|---|---|---|---|
| fenrir+skoll+sleipnir vs ratatoskr+valkyrie+nidhoggr | 58.33 | 50.00 | **-8.33** | 5.50 | 5.33 |
| kraken+gullinbursti+ratatoskr vs ymir+audhumbla+kraken | 41.67 | 50.00 | **+8.33** | 12.50 | 15.83 |
| skoll+hraesvelgr+ymir vs draugr+nidhoggr+fafnir | 66.67 | 75.00 | **+8.33** | 6.50 | 6.67 |
| jormungandr+ratatoskr+draugr vs audhumbla+fenrir+jormungandr | 91.67 | 91.67 | 0.00 | 6.83 | 7.00 |
| hraesvelgr+huldra+audhumbla vs hel+fafnir+gullinbursti | 33.33 | 33.33 | 0.00 | 10.25 | 9.75 |
| sleipnir+draugr+hel vs fenrir+skoll+sleipnir | 16.67 | 33.33 | **+16.66** | 5.83 | 5.25 |

- mean win rate **51.39 -> 55.55**, mean absolute delta **6.94**, max **16.66**
- **72/72 decisive in both arms**, zero stalls, zero FTKs, mean turns 7.90 -> 8.30
- the beam is doing real work here: **28.8M candidates pruned of 39.8M enumerated**, against 89.7M
  enumerated beamless. So this is not a case of the arm failing to take.

**So the beam is not identity-preserving at 3v3, and nobody should claim it is.** That is exactly what
`3v3-optimisation.md` said it would be — it ranks the deferred candidates on their immediate score,
so it under-reads lines whose payoff is one play further on.

**But "moved" is not the same as "moved measurably", and 12 games cannot tell the difference.** At
p = 0.5 a 12-game sample has a standard error of ~14 percentage points, so every delta in that table
except possibly the last is inside one standard error of zero. Three deltas are exactly +/-8.33, which
is *one game out of twelve* — the smallest step this sample can represent.

The comparison that decides it is not beam-vs-beamless, it is **beam-vs-beamless against
beamless-vs-itself.** Ticket 108 measured full tier disagreeing with ITSELF across seed bases at MAD
6.0-13.2 at 1v1. The beam's mean absolute disagreement here is **6.94** — inside that band. A run at a
second seed base is in flight to get the self-disagreement figure at 3v3 directly, which is the
honest denominator.

### Why this is shippable anyway, and what the risk actually is

**The balance corpus is not exposed.** The whole point of the Node/browser split in §6 is that every
instrument and suite keeps the beamless search it was calibrated against. Nothing on record
re-baselines, and no future grid is silently beamed. The risk of the beam is confined to one thing:
**at 3v3 the enemy sometimes picks a slightly different line.** It never stalled, never failed to
resolve, and turn counts moved by 0.4.

That is a different category of risk from a balance change, and it is worth naming plainly: an enemy
that occasionally takes the second-best line is a *quality-of-play* cost, paid for a 2.3x speedup in
the mode the game ships. Set against a 16-second frozen turn, that is a trade worth making — but it
IS a trade, not a free win, and if Henry would rather not make it the single-line revert is
`GAME_BEAM_WIDTH`.
