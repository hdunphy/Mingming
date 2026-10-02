# Ticket 144 — Sim speed, piece 4: fewer sims, cheaper sims, leaner lanes

> **Status: CLOSED 2026-09-08** — done — 144a–d shipped (2.1× cumulative, beam ladder ruled); e/f/g were optional and are not being taken. Closed in the ticket audit (`../TICKET-AUDIT-2026-09-07.md`).

**Type:** instrument work. **No balance numbers may change** unless a row says so and Henry rules it.
**Branch:** `legion/ai-perf`, one commit per lettered row, authored as Henry.
**Continues:** ticket 97 (cell cache, 36× warm), ticket 108 (process pool, three-tier AI, adaptive
sampling rejected), ticket 127 (where an enemy turn goes: 93,889 reducer sims a 3v3 decision).
**Asked by Henry, 2026-09-06:** *"is there any way to speed these up? … multi-threaded AI planning,
cache calculations, bitwise ops, inverted multiplies, performant arrays…"*

---

## 0. The profile this ticket is built on

V8 `--cpu-prof` on one paired 3v3 job (fenrir_v1 + skoll_v1 + ratatoskr_v2 vs kraken_v1 +
ratatoskr_v1 + huldra_v1, 1 iteration = 2 battles, beamless, full tier), 235 s sampled.

| self time | where |
|---|---|
| 38.1% | `resolutionEngine.ts` — `executeResolutionStack` 8.9 + its inner loop/callbacks ~16 + `applyMutations` 3.4 + `executeCostCalculated` 3.3 |
| 20.5% | `battleReducer.ts` — `handlePlayProgram` **16.9** |
| 11.0% | `effectHandlers.ts` — `handleApplyStatus` 5.4, `handleAttack` 2.4, `handleHealEffect` 1.6 |
| 5.5% | GC / native |
| 4.6 + 4.3% | `Hooks.ts` (`get` 2.5), `HookFactory.ts` (`checkCondition`, `executeActions`) |
| 4.3% | `TacticalAI.ts` — `findBestSequence` 2.2, `evaluateState` 1.0 |
| 2.4% | `programRegistry.ts` — `GetProgramData` 1.4, `inflateConstraint` 0.8 |
| 1.0% | `combatUtils.ts` — `calculateDamage` 0.8 |

Inclusive: `findBestSequence` ≈ 95% of the run; `battleReducer` ≈ 87%; `executeResolutionStack`
≈ 52%. Also: the lane wrote **92,341 `[checkDefeat]` console lines** (6.5 MB) for two battles.

**What that says.** The AI's own logic is 4%. Arithmetic is ~1%. The cost is (a) *how many* times
the engine is asked to simulate an action — ticket 127 measured 93,889 reducer calls per 3v3
decision, branching ≈ casters × hand × targets ≈ 45, cubed for `MAX_DEPTH = 3` — and (b) what each
simulated action costs: rebuilding the hook list from scratch on every hook phase, re-inflating
program data, building log strings and copying `state.logs`, and the immutable spreads that feed GC.

So, plainly: **bitwise ops, inverted multiplies and typed arrays are not levers here.** V8 already
JITs the arithmetic and there is 1% of it. Multi-threading the planner is a latency fix for the
shipped game's enemy turn (ticket 39/127), not a throughput fix for the grid, which already runs one
process per lane and is core-bound. Adaptive sampling stays rejected (ticket 108: it manufactures
blowouts). The levers are below, in the order they pay.

---

## 1. Rows — all bit-identity gated

Every row ships only if the gate in §3 passes. Expected gains are from the profile, not promises.

### 144a — Dedupe interchangeable cards in the AI's enumeration (fewer sims, ~1.5–2×)

`findBestSequence` enumerates every card in hand × every caster × every target. Hands are full of
pairs (`water_slap` ×2, `pollen_cloud` ×2, `fury_strike` ×2, `ragnarok_edge` ×2 …) and the second
copy produces the same subtree as the first. Skip a hand card if an earlier hand card has the same
`dataId`, the same `currentCost`, and the same `card_growth:<id>` counter (that counter is keyed on
the instance, so it is the one per-instance fact that can differ). Branching at each depth drops by
the pair count; at depth 3 that compounds.

**Why it should be bit-identical.** Today both copies are enumerated and the best is chosen with a
strict `>`, so a tie goes to the first copy — which is the copy the dedupe keeps. The chosen action
only differs if the two copies' subtrees score differently, which needs a mid-turn reshuffle inside
the search (an effect-draw emptying the deck). Rare; the gate will say how rare.

### 144b — Cache the hook list per entity (cheaper sims, ~20%)

`executeResolutionStackInner` (and its twin `executeStatusDamageCalculated`) rebuilds, on every
phase call of every simulated action: the alive-entity list, a `Set` of hook ids from `e.hooks`
+ `getOSBehavior(e.activeOS).hooks` + every daemon's `GetProgramData(...).hooks`, then `getHook`
per id, then a sort. None of that depends on anything but `(activeOS, hooks, daemon dataIds)`.

Memoize per entity: a `Map<string, HookDefinition[]>` keyed on
`${activeOS}|${hooks.join(',')}|${daemons.map(d => d.dataId).join(',')}`, holding that entity's
registered hooks already filtered to "has *some* phase", and a second level keyed on `phase`. The
pair list is then built by iterating alive entities in the same order and concatenating each
entity's cached per-phase list, then the same stable sort by priority — identical order, because
JS sort is stable and the input order is unchanged. Cache lives at module level; invalidate on
`HookRegistry` registration (tests register hooks).

### 144c — Silent simulation (cheaper sims, 5–10%)

Inside the AI search, logs are dead weight: every `addLog` copies `state.logs` (`[...state.logs,
msg]`), every `LOG` mutation builds a template string, and `state.logs` grows through the battle so
the copy gets longer every turn. Add a module-level `simulationDepth` counter the AI increments
around its `battleReducer` calls (it already has `resolutionStackDepth` for the same shape); when
`> 0`, `addLog` / `LOG` mutations return `state` unchanged and `handlePlayProgram`'s `{owner} …`
interpolations are skipped. Real plays (depth 0) log as today. Also delete the `[checkDefeat]`
`console.log` at `effectHandlers.ts:325` — 92k lines a job, synchronous, and it is debug residue.

Bit-identity: `state.logs` is not part of any result the harness reads or hashes (`cellCache` keys
on assemblies; `runBatch` reads outcomes). Confirm `evaluateState` does not read `logs.length`.

### 144d — Memoize `GetProgramData` / `inflateConstraint` (cheaper sims, 2–3%)

Called per candidate, per hook scan, per daemon; re-inflates constraints each time. Cache the
inflated object by `dataId`, invalidated on registry mutation. Ticket 97 found the engine mutates
registry-resident card data during a battle — so the cache must hand back the *same* object the
registry holds (identity), not a copy, or that mutation path changes behaviour.

### 144e — Lean lanes: a pre-bundled shard (throughput, ~1.3–1.5×)

Each lane is a `vite-node` process (TypeScript transform, source maps, module graph in memory).
Henry measured 11 lanes at 80% RAM and 310–405 s a battle, 4 lanes at 137–158 s: lanes are
memory-bound before they are core-bound. Bundle `scratch/compshard.ts` (and `gridshard.ts`) with
esbuild to one plain JS file (`scratch/dist/compshard.mjs`, gitignored, rebuilt by
`compgrid.mjs` when sources are newer); lanes run `node scratch/dist/compshard.mjs`. Smaller RSS,
faster start, and 6–8 lanes should fit. Gate: the bundle reproduces the vite-node lane's results
byte-for-byte on a 3-comp slice (JSON imports, `import.meta`, and the `process.env` gap ticket 127
found all need checking — under vite-node `process.env` reached module code by no route, so the
bundle must not silently *enable* `AI_BEAM` or `AI_LITE` where vite-node did not).

### 144f — The comp grid gets the cell cache (reruns mostly free)

Ticket 97's `cellCache` (`engineHash` + `cellKey`) is wired into the 1v1 grid only. `compshard.ts`
runs `runPairedBatch(teamScenario(...))` uncached, so after ticket 143 — which touched two
fenrir_v1 cards — a full rerun recomputes all 144 comps when only the 36 with fenrir_v1 changed.
Key a comp cell on: both comps' member ids, each member's deck list and resolved card data, species
stat blocks, both OSes' firmware, `engineHash()`, seed, iterations. Store `{winsA, decisive,
turns, truncated, ftk}` under the key; `compshard` consults it before running and writes after.
Same over-broad rule as ticket 97: an engine-file edit invalidates everything, and that is correct.
Gate: `cacheproof`-style — cold, warm, `FORCE_FULL=1` on a slice, three identical assemblies, warm
all hits.

### 144g — Transposition table inside a decision (fewer sims; MEASURED ARM, not a ship row)

Different same-turn orderings of the same plays often reach the same board (Str then attack vs
attack then Str do not; two attacks at two targets in either order do). Memo `findBestSequence`
on a hash of `(state, side, depth)` for the duration of one `getBestAction`. Exact *if* the hash
covers the whole state; the cost is hashing a large immutable object per node. Measure: hash cost
vs subtree cost at depth 1–2, hit rate, and the gate. Ship only if it clears the gate and nets
> 20% on the 3v3 profile job; otherwise record the numbers and drop it.

---

## 2. A decision for Henry — the beam

`AI_BEAM=8` is built and gated (ticket 127: 0 of 90 1v1 cells moved) and halves 3v3 decisions.
It is off in every grid on record by ruling (the instrument stays beamless to match the 1v1
numbers), and ticket 127 found the shipped game *cannot reach it* (`process.env` is `{}` in the
bundle). Two coherent positions:

- **Beamless everywhere** (today): the game's enemy AI is the full search; the grid measures what
  the player faces. Slow, honest.
- **Beam 8 everywhere:** wire a real switch (`IBattleState.aiBeam`, like `enemyAiTier`), ship it
  on, and rebaseline the 3v3 grids once with it on. The game gets ~2× faster enemy turns, the grid
  gets ~2×, and the instrument still measures what the player faces.

What is not coherent is beam in the game and beamless in the grid, or the reverse. This ticket does
not touch the beam; it needs a ruling.

---

## 3. The gate

Same discipline as tickets 97/108/127, per row and for the package:

1. **1v1:** `scratch/beamgate.ts`-style — three decks × 30 opponents × 30 iterations, `grid`
   seed base, before vs after: **0 cells moved** (not "within noise" — identical). Decks:
   fenrir_v1, ratatoskr_v2, kraken_v1 (a pair-heavy hand, a 0-cost hand, an effect-draw hand).
2. **3v3:** the profile job above plus two more pairs, 3 paired iterations each: identical
   `{winsA, decisive, turns}` before vs after.
3. **Timing:** the profile job, before vs after each row and cumulative, same box, one lane.
   Report seconds per battle and the `census.simulated` count (144a/144g should move it; 144b–f
   should not).
4. `npm test` green, `tsc` clean.

If a row fails identity (144a is the candidate), report which cells moved and by how much and do
NOT ship it; Henry rules whether a ≤ 1-cell drift is acceptable for a 2× — that is the beam
decision again in a smaller coat.

## 4. What to write back

Per row: the timing delta, the sim-count delta, the gate result. Cumulative: seconds per 3v3 battle
before and after (the number Henry feels), and what `--lanes` the lean bundle allows on his box at
< 60% RAM. Then the beam question, answered or still open.

---

## RESULTS — 144b, 144c, 144d shipped; 144a measured and NOT shipped (2026-09-06)

### The package, cumulative

| | before | after | |
|---|---|---|---|
| 1v1, three deck rows, 2 lanes | 5.5 min | **3.9 min** | **1.41×** |
| 3v3 profile job, 1 lane | 131 s a battle | **107 s** | **1.22×** |

All three rows are **identity-clean**: 0 of 90 1v1 cells moved (the CSVs differ only in their `ms=`
timing comment), and the 3v3 job returns the same `winsA`, `decisive`, `turns` and `ftk`.

| row | fenrir_v1 | kraken_v1 | ratatoskr_v2 | cells moved |
|---|---|---|---|---|
| baseline | 90 s | 91 s | 146 s | — |
| + 144c silent simulation | 74 | 75 | 129 | 0 / 90 |
| + 144b hook-list cache | 66 | 72 | 111 | 0 / 90 |
| + 144d program-data memo | 63 | 65 | 104 | 0 / 90 |

§0's reading held up: the AI's own logic was never the cost. What paid was **not doing the same
work ninety thousand times a decision** — copying a growing log array, rebuilding a hook list that
cannot change during a resolution, and re-inflating a card that nothing mutates.

144c beat its 5–10% estimate (15–17%); 144b came in under its ~20% (9–14% on top of 144c, and the
two overlap — silencing the log made the hook walk a larger share of what was left, not a smaller
one). The `[checkDefeat]` console.log alone was **92,341 lines / 6.5 MB per two-battle job**.

### 144a — 1.5× more, and it is NOT bit-identical. Henry rules.

Built as specified: skip a hand card when an earlier one has the same `dataId`, `currentCost` and
`card_growth:<instanceId>`.

**It is fast.** With b/c/d already in: 3.9 min → **2.6 min**, so 144a alone is another 1.5×, and
**2.1× cumulative** against the pre-144 baseline. On the 1v1 rows: fenrir 63 s → 43, kraken 65 → 42,
ratatoskr 104 → 69.

**And it moves the numbers, well past the ticket's "≤ 1 cell" framing:**

| deck | cells moved | mean \|Δ\| | max \|Δ\| | field |
|---|---|---|---|---|
| fenrir_v1 | 21 / 30 | 3.5 | 15.0 | 54.77 → 53.63 |
| kraken_v1 | 26 / 30 | 3.9 | 11.7 | 48.22 → 48.37 |
| ratatoskr_v2 | 22 / 30 | 2.5 | 10.0 | 41.55 → 42.11 |
| **all** | **69 / 90** | **3.3** | **15.0** | |

Reverted, per §3. But note *what* the numbers say, because it changes the question: §1's argument was
that the two copies can only diverge through a mid-search reshuffle, which should be **rare**.
69 of 90 cells at a mean of 3.3 points is not rare. So the interchangeability argument has a hole in
it that neither the ticket nor this pass has found — and until it is found, the choice is not
"accept a small drift for a 2×", it is "ship a change whose mechanism we cannot yet explain".

**Recommendation: leave it out until the hole is found.** The deck-level fields barely move (≈1
point), so if the mechanism turns out to be benign this is cheap to revisit — and it is worth
revisiting, because 1.5× is the largest single number in this ticket.

### §2 — the beam, RULED

Henry, 2026-09-06: **beam 8 everywhere.** Wire a real switch (`IBattleState.aiBeam`, alongside
`enemyAiTier`), ship it on, and rebaseline the 3v3 grids once with it on.

Deliberately NOT done in this pass, and the order matters: turning the beam on changes the numbers
by design, so doing it beside three rows whose entire gate is "nothing changed" would have made both
unreadable. It is its own row, with its own rebaseline, on top of these three.

### Not attempted

144e (bundled lanes) and 144f (comp-grid cell cache) are wins on Henry's box specifically — lane RAM
and rerun cost — and neither can be honestly verified on the 2-core container these rows were
measured on. 144g (transposition table) is a measured arm rather than a ship row and is untouched.

---

## 144a — the hole in §1, found (2026-09-06)

**§1's premise is false, and not by a little.** It says two copies of the same card produce the same
subtree, so they can only diverge through a rare mid-search reshuffle. They diverge on the first
ply, on most turns, for a reason that has nothing to do with reshuffles.

### What playing a copy actually does

`scratch/probe144a.ts` walks a real battle and, at every decision, plays each member of every
interchangeable group ONE PLY and structurally diffs the results. Across three of the matchups that
moved:

| matchup | groups seen | one-ply states identical | **differ** |
|---|---|---|---|
| fenrir_v1 vs kraken_v2 | 10 | 5 | **4** |
| kraken_v1 vs nidhoggr_v1 | 6 | 0 | **5** |
| ratatoskr_v2 vs huldra_v2 | 21 | 6 | **14** |

The differing field is always the same one — the deck state — and always in the same way:

```
copy A: hand = [maelstrom, scald, capacitor, boiling_surge, boiling_surge, hydro_blast, capacitor]
copy B: hand = [scald, maelstrom, capacitor, boiling_surge, boiling_surge, hydro_blast, capacitor]
```

Same cards. **Different order.** Removing index 0 from a list leaves a differently-ordered remainder
than removing index 1, and hand order is the AI's enumeration order — and `bestScore` improves on a
strict `>`, so among equal-scoring lines the first one VISITED wins. The engine already knows this
about itself: the beam's own comment says restoring enumeration order is *"what stops the beam
changing anything it did not prune… that bug cost a measurement"*.

*(The first version of this probe sorted the hand before comparing, and reported 9 of 9 groups
identical. Sorting is exactly what hid the mechanism. Worth remembering when writing the next
fingerprint.)*

### And two more, downstream, in how candidates are consumed

Even with identical subtrees, dropping a candidate would still move numbers:

1. **`topN = improving.slice(0, lookaheadTopN(tier))` is a fixed-size window.** Duplicates occupy
   slots in it, so removing them promotes genuinely different plays into the lookahead. That is not
   rare, it is most contested turns.
2. **`lookaheadValue` seeds its determinization PRNG with the candidate's INDEX** —
   `lookahead|${leaf.seed}|${leaf.turn}|${candidateIndex}|${d}`. Removing an entry shifts every
   later index, so every lookahead value after it changes.

### Both fixes were built and both failed the gate

| attempt | speed | cells moved |
|---|---|---|
| v1 — skip the duplicate card entirely | 3.9 → 2.6 min | 69 / 90 |
| v2 — keep every candidate, reuse the twin's subtree | 3.9 → 2.7 min | 68 / 90 |

v2 was built specifically to answer mechanisms 1 and 2: same candidate count, same order, same
indices, each copy carrying its own action — only the recursion shared. It still moves, because of
the hand-order finding above: the twin's subtree is genuinely a different search, so there is
nothing sound to reuse.

**144a cannot be made bit-identical by memoisation.** Reverted; the tree is back to 0 of 90.

### The three ways forward, and what each costs

1. **Drop it.** The package keeps its 1.41×, and nothing else in the ticket is at risk.
2. **Rule the drift acceptable.** Henry's call, and it is the beam question in a smaller coat — the
   deck fields move about a point, individual cells up to 15. Not recommended while the AI's
   decision demonstrably depends on which copy of a card sits earlier in your hand.
3. **Make enumeration order canonical** — sort the hand for enumeration by (dataId, cost, growth)
   so the search stops depending on hand order at all. Then the copies really are interchangeable,
   the dedupe becomes sound, and 144a's 1.5× is available. This is the interesting option, because
   the dependency it removes is arguably a defect: **the order cards happen to sit in your hand is
   an artifact, not information, and right now it changes what the AI does.** It is not free — it
   moves every number once and needs its own rebaseline — but Henry has already accepted one
   rebaseline for the beam, and these two could ride together.

---

## 144a, SHIPPED — the AI reads a hand by its contents, not by its draw order (2026-09-06)

Henry, 2026-09-06, on being shown the hand-order finding: *"if what you're suggesting is for the AI
sort by card then I think that's the obvious answer to help reduce timing. make sure the player is
still by draw order."*

### What changed, in one sentence

The order the **search** walks the hand in. `findBestSequence` now iterates a sorted **copy** —
`dataId`, then cost, then banked growth, then instance id — so two copies of a card sort adjacently
and the second is skipped. Nothing writes back to the state.

### The player's hand is untouched, and that is tested

`src/engine/ai/enumerationOrder.test.ts` runs the AI against a hand whose draw order is the reverse
of its sorted order and asserts the hand comes back identical — same instances, same positions, and
the array is not even a new object. A fourth test asserts the thing the row is *for*: the same six
cards dealt in three different orders now produce the same play. **That test fails on the pre-144a
build and passes on this one**, so it is measuring the fix rather than describing it.

### Why this was the right shape rather than the dedupe alone

Draw order was never information. It is an artifact of the shuffle, and the search was reading it:
`bestScore` improves on a strict `>`, so among equal-scoring lines the first one VISITED won, and
"first" meant "wherever that card happened to land when it was drawn". Once order is a function of
the hand's CONTENTS, two copies really are interchangeable — same remainder after playing either,
same subtree — and skipping the second is sound rather than an approximation.

### Speed

| | 3 deck rows, 2 lanes | vs pre-144 |
|---|---|---|
| pre-144 baseline | 5.5 min | — |
| + 144b/c/d | 3.9 min | 1.41× |
| **+ 144a** | **2.0 min** | **2.75×** |

### The drift it costs, measured on the three gate decks

| deck | cells moved | mean \|Δ\| | max \|Δ\| | field |
|---|---|---|---|---|
| fenrir_v1 | 21 / 30 | 3.9 | 18.3 | 54.77 → 53.47 (−1.30) |
| kraken_v1 | 27 / 30 | 5.2 | 15.0 | 48.22 → 50.00 (+1.78) |
| ratatoskr_v2 | 21 / 30 | 1.8 | 6.7 | 41.55 → 41.28 (−0.28) |

Cells move; decks barely do. The AI plays differently, not better or worse.

### The new 1v1 baseline — the roster is healthy under it

Full 32-deck grid, 30 iterations, `grid` seed base: `results/rebaseline_144a/`.

**Roster mean 50.3%** (the old grid read 49.9%). **Zero decks outside the 35–80 band.** 360 of 960
cells moved by 5+.

Read the per-deck deltas in that SUMMARY with care: its `was` column is
`docs/balance/deck_grid.json`, which is **pre-141**, so those numbers carry 141, 142, 143 and 144a
together. The biggest mover there — skoll_v1 at +12.2 — is ticket 141e's `sun_devourer`, not this
row. The clean attribution for 144a alone is the three-deck table above.

`docs/balance/deck_grid.json` is deliberately NOT overwritten. Promoting it is Henry's call, and it
should probably wait for the beam, so the roster is re-pinned once rather than twice.

---

## §2 — the beam, built and measured (2026-09-06)

`IBattleState.aiBeam`, alongside `enemyAiTier` and with the same semantics: undefined means "take
the process default", which is now **8 for every caller**. `resolveBeam`'s browser/Node split is
gone.

### At 1v1 it is very nearly a no-op

Full 32-deck grid, 30 iterations, beam against beamless on the same build:

**4 of 960 cells moved**, by 0.83 to 1.67 points. Roster mean 50.3% either way, zero decks outside
the 35–80 band either way.

| deck | opponent | | |
|---|---|---|---|
| audhumbla_v1 | ratatoskr_v1 | 32.50 → 33.33 | +0.83 |
| draugr_v2 | ratatoskr_v1 | 40.00 → 41.67 | +1.67 |
| ratatoskr_v1 | audhumbla_v1 | 63.64 → 64.44 | +0.80 |
| ymir_v1 | ratatoskr_v1 | 63.33 → 65.00 | +1.67 |

**Every one of them involves ratatoskr_v1** — and two are the same matchup seen from both ends, so
it is really three matchups and one deck. That is the deck whose hand is all 0-costs, so it is the
one deck whose 1v1 branching regularly exceeds 8 and therefore the only one with anything to prune.
Ticket 127's 90-cell finding holds and now extends to the whole grid.

**`results/rebaseline_144a` therefore did not need redoing**, and `results/rebaseline_beam` is the
belt-and-braces confirmation rather than a replacement.

### At 3v3 it is not free, and this is the part to read

Four comps, 6 battles a cell, same seeds both ways:

| | beamless | beam 8 | |
|---|---|---|---|
| cells whose win rate moved | — | **3 of 4** | |
| mean win rate of side A | 79.2 | **66.7** | **−12.5** |
| mean turns | 4.54 | **5.29** | **+0.75** |
| time | 1274 s | 386 s | **3.30×** |

| comp | beamless | beam 8 | beam 16 | turns |
|---|---|---|---|---|
| fenrir_v1+skoll_v1+ratatoskr_v2 vs the Nature gym | 100% | 83% | 83% | 3.50 → 4.67 |
| kraken_v1+jormungandr_v1+huldra_v2 vs Venom Court | 33% | 17% | 17% | 6.00 → 6.33 |
| fenrir_v1+skoll_v1+jormungandr_v1 vs the zoo | 100% | 83% | 83% | 3.83 → 5.33 |
| Venom Court vs Tidal Forge | 83% | 83% | 83% | 4.83 → 4.83 |

**Every move is in the same direction: the side that was winning wins less, and games run longer.**
That is the bias the beam's own header predicts — it ranks candidates by immediate score, so it
under-reads lines whose payoff is one play further on, and the first thing to go is the kill two
plays out. It does not make the AI play badly; it makes it play less sharply, symmetrically, and
the side with the shorter clock is the one that pays.

Note what that does to a ship gate: ticket 141's *"average turns stay ≥ 4.0"* now passes more
easily, but for the wrong reason — a slightly weaker search rather than a healthier roster.

### A wider beam is not the answer

Beam 16 — twice the ruled width — moves the **same three cells to the same win rates**, and costs
almost as much (3.13× against 8's 3.30×). The lines that mattered were already outside 16. This is
not a width-tuning problem, and if beaming at all, 8 is right.

### One plumbing fact, and it matters more than it looks

**`AI_BEAM` does not reach any harness lane.** `vite.config.ts` substitutes
`define: { 'process.env': {} }`, and vite-node transforms `scratch/` and `src/debug/` through the
same config, so the variable never arrives — verified, not assumed. Before this change that was
harmless, because the Node default was beamless anyway. After it, it would have left every
measurement beamed with **no way to ask for otherwise**, which is exactly what ticket 108's
*"confirm anything you intend to act on at full, BEAMLESS"* forbids. So `BatchOptions.aiBeam`
threads the per-battle switch through `runOne` the way `enemyAiTier` already does, and that is now
the only working way to take a beamless measurement.

### What this leaves open

The **3v3 corpus was all measured beamless** — ticket 140's 144-comp grid, 141's arm B, the gym
check. Those numbers remain internally consistent with each other and are now inconsistent with what
the game plays. Re-running them under the beam is a real cost (the comp grid is the expensive one),
and until it happens, a 3v3 number on record and a 3v3 number measured today are not comparable.
That is a decision for Henry, not a defect.
