# Making 3v3 affordable: 4x, and two ideas that had to be killed to get there

- Type: wayfinder:implementation. **Follows ticket 98.** Branch `archetype-web`.
- **868 tests green**, `tsc` clean, build clean.
- **1v1 is bit-identical: 0 of 90 grid cells moved.** That is the gate ticket 98 set for any change
  to the AI search, and it is the only reason this is shippable at all.

---

## 0. The short version

A 3v3 battle cost **52 seconds**. The same work now costs about **13**, and the roster's 1v1 numbers
did not move by a single cell.

| build | 6 fixed 3v3 games | vs HEAD | 1v1 grid |
|---|---|---|---|
| HEAD | 243.9s | 1.00x | — |
| **+ Self-card dedup** | **123.4s** | **1.98x** | **0/90 moved** |
| **+ `AI_BEAM=8`** | **60.1s** | **4.06x** | **0/90 moved** |
| + `AI_BEAM=6` | 56.1s | 4.35x | 0/90 moved |
| + `AI_BEAM=4` | — | — | **7/90 moved** ← too narrow |

Win rate was **16.7% in every arm**, and turn counts stayed in a 4.2–5.0 band.

Answering the four questions directly:

- **Caching card lookups?** Not where the time is. The valuable cache looked like *positions*, not
  cards — and it **lost**, badly (§3). Card/registry lookups never appeared in the profile.
- **Alpha-beta?** **It does not apply to the expensive layer** (§4). Inside a turn there is no
  min/max alternation for it to cut against.
- **Another way to reduce the decision set?** Yes — two of them, and both shipped (§1, §2).
- **A genetic algorithm for 3v3?** **No, none exists.** It is on the roadmap *after* ticket 98
  (red-team coevolution against a hall-of-fame), and 98 only just landed. Scoped in §6.

---

## 1. The free one: a Self card was being simulated three times

The candidate loop is `for card in hand / for source in party / for target in potentialTargets`, and
the action it builds ends with:

```ts
const effectiveTargetId = programData.target === 'Self' ? source.id : target.id;
```

**A Self card ignores the loop variable.** So in 3v3 the target loop runs three times and emits the
*identical* action three times — three identical full `battleReducer` simulations, and three
identical recursive subtrees underneath them. `AI_CENSUS=1` measured it at **18.1% of every
simulation in a 3v3 battle**, and 0% at 1v1, where there is only one target to repeat.

Collapsing it is exact per candidate — the removed actions are byte-identical to the one kept.

**But it is not a no-op on the decision, and that part is a bug fix rather than a regression.**
`getBestAction` takes the top `LOOKAHEAD_TOP_N` candidates into the lookahead. Those three slots were
being filled with three copies of one action, so **the lookahead was examining one distinct line
while believing it was examining three.** After the fix it examines three real ones. This is why a
3v3 battle changes trajectory (4 turns → 7) while 1v1 does not move at all: 1v1 never had a duplicate
to collapse.

**1.98x, and 0 of 90 grid cells moved.**

---

## 2. The beam: cut the exponent, not the base

What is left is the shape of the search itself. `findBestSequence` recurses over every *ordering* of
every play available this turn, so cost goes roughly as `branching ^ MAX_DEPTH` (`MAX_DEPTH` is 3).
Branching is `casters x hand x targets`: about 6 in 1v1, about 20 in 3v3. Cubed, that is the ~95x
per-decision gap, not the 3x the party size suggests.

The beam still enumerates every candidate at a node — the simulation **is** the score, so that part
cannot be skipped — but recurses into only the best `BEAM` of them.

| | reducer sims per decision | per sim |
|---|---|---|
| 1v1 | 83 | 96us |
| 3v3, HEAD | **16,677** | 35us |
| 3v3, after dedup | 7,792 | 35us |
| 3v3, `AI_BEAM=8` | **6,656** | 27us |

### The bug that nearly shipped a silent behaviour change

My first version sorted the deferred candidates by immediate score and recursed in that order. At
`AI_BEAM=16` — well above 1v1's branching, pruning essentially nothing there — **23 of 90 cells still
moved.**

The cause: `bestScore` improves on a strict `>`, so among equal-scoring lines **the first one visited
wins**. Recursing in score order silently re-picks every tie. The fix is to select the top `BEAM` by
score and then **restore enumeration order before recursing**. Both halves are load-bearing:
selecting is the optimisation, restoring the order is what stops the beam changing anything it did
not prune.

That is worth recording because the failure was invisible — right answers, different tie-breaks, and
a diff that looked like the beam being "approximate" when it was actually a defect.

### Sizing, stated honestly

`AI_BEAM` of 6, 8, 12 and 16 are all bit-identical on the 90 cells tested; 4 moves 7 of them.
**8 is the recommendation.**

One caveat I want on the record rather than buried: **that identity is empirical, not structural.**
`AI_CENSUS=1` shows `AI_BEAM=8` pruning 3 candidates *even at 1v1* — so 1v1 branching does exceed 8
occasionally, and those three lines simply were not going to win. A new card, a bigger hand or a
wider roster could change that. **Re-run the grid gate after any change to the card pool.** Do not
read "bit-identical on 90 cells" as "cannot move".

The beam is **off by default** for exactly this reason. It is opt-in per run: `AI_BEAM=8`.

It is also an approximation in 3v3, ranked on the immediate score, so it inherits the bias ticket 108
measured in the cheap AI tier — it under-reads lines whose payoff is one play further on. Depth 0 is
never beamed: that is the layer producing the candidate list `getBestAction` ranks, and truncating it
would hide legal plays from the decision entirely.

---

## 3. The transposition table: built, verified sound, and 3.4x SLOWER

This was the idea I expected to win, and it is worth writing down why it didn't.

A first census keyed on a narrow signature (vitals, statuses, sorted hand, depth) reported that
**81% of 3v3 simulations landed on a position the same decision had already solved** — A-then-B
reaching where B-then-A reaches, with the whole subtree re-explored. That looked like a 5x sitting
in plain sight.

So I built it with a deliberately **over-broad** key: the entire state minus the four write-only
arrays the engine never reads back (`logs`, `osLogs`, `procs`, `levelUpQueue`). Hand-picking the
"relevant" fields is how you ship a fast wrong answer — it is the `isAttack` trap and the ticket-103
cell-cache bug in one. And I added `AI_MEMO_VERIFY=1`, which recomputes every hit and asserts the
cached score matches, so the key would be *proven* rather than argued.

| | 3v3 battle | hit rate | mismatches |
|---|---|---|---|
| memo off | 39.7s | — | — |
| memo on | **136.1s** | **20.2%** | **0** |

**Zero mismatches — the key was sound. The idea was still wrong.** Two reasons, and the second is
the interesting one:

1. Keying on the full state costs a `JSON.stringify` per node, which dominates a 35us simulation.
2. **The hit rate was 20%, not 81%** — because the positions *are not actually the same*. Play order
   leaves fingerprints my narrow census key ignored: `lastProgramPlayed`, `cardsPlayedThisTurn`,
   per-unit `playsThisTurn`, draw-pile and discard ORDER, and the RNG seed. Several of those
   genuinely change the future (pile order and seed decide what gets drawn; `playsThisTurn` enforces
   per-unit OS limits; `lastProgramPlayed` feeds combo hooks).

**The 81% was my own measurement lying to me, because a narrow key over-counts equivalence.** The
memo is removed from the engine rather than left switched off — strictly-worse code in a hot path is
the dead-schema trap this project keeps paying for.

---

## 4. Why alpha-beta is the wrong tool here

Alpha-beta prunes a **minimax** tree: it needs alternating maximising and minimising plies so a
branch can be cut once it is known to be worse than one already found.

**Inside a turn there is no alternation.** Every ply of `findBestSequence` is the same side playing
another card. It is a pure maximisation over sequences, so there is no beta to cut against. Alpha-beta
has purchase only on the *reply* layer — the opponent's answer in `getBestAction`'s lookahead.

And the reply layer is not where the money is. Ticket 108 already measured the ablation: **greedy,
which has no lookahead at all, still costs 34.4s of a 52.3s 3v3 battle.** So the entire lookahead is
under a third of the cost, and a perfect alpha-beta over part of that third is worth single-digit
percent.

The beam is the right analogue: it is branch-and-bound's cheap cousin, and it attacks the two thirds
that alpha-beta cannot reach.

**Two other things I checked and can rule out:**

- **The battle log is O(n²)** — `addLog` is `{...state, logs: [...state.logs, message]}` at six
  sites. Real, but it tops out at **252 lines** in a 3v3 game, and per-decision cost *falls* as the
  log grows (1503ms early, 20ms late) because cost tracks board width, not history. Not worth fixing.
- **Logging in speculative simulations** — the engine has only three unconditional `console.log`s and
  the event bus is muted around the search. ~6% of the profile, not the problem.

---

## 5. How to actually run 3v3 now

```
AI_BEAM=8 npx tsx scratch/teamcanary.ts          # liveness suite
AI_BEAM=8 AI_LITE=1 node scratch/pool.mjs ...    # screening, if you also want the tier
```

Stacking with ticket 108's work, on an 8-core machine: **4x here, ~1.6x from `AI_LITE`, and the pool
scaling with cores.** A 3v3 battle at ~13s instead of 52s is the difference between a team matchup
being a coffee and being an afternoon — though a full team *grid* is still a different order of
magnitude away, and I would not plan one yet.

**Read the ticket-108 rules as still binding**, and note they compound here: `AI_LITE` compresses the
spread ~77% and the beam is approximate in the same direction. Screen with them; **confirm anything
you intend to act on at full, beamless**.

---

## 6. The genetic algorithm: doesn't exist, and here's what it needs

There is no GA harness. The plan on record (HANDOFF, the 3v3 ruling) has it following ticket 98:
**red-team coevolution against a hall-of-fame**, with three outputs — dominant comps (bugs),
population diversity (meta health), and never-picked decks (dead weight vs. good-teammate, which is
what guardrail 4 wanted data for).

Everything it needs now exists except the loop itself: `teamScenario()` composes any comp,
`runPairedBatch` scores it, and this work makes an evaluation affordable enough to run thousands of
times. The honest blocker is arithmetic. At **13 seconds a battle**, a GA generation of 30 comps
evaluated over 10 matchups at 6 games each is **~16 hours**. Before a GA is worth writing, an
evaluation needs to cost seconds, which means either a much coarser fitness (fewer games, accepting
0-DECISION-GRADE rankings rather than verdicts) or another order of magnitude of speed.

**My recommendation: don't start the GA yet.** Use the affordable 3v3 to answer the questions ticket
98 raised first — above all whether status prices survive a 12-turn game, since a GA run against
mispriced statuses would optimise against the wrong game and produce confident nonsense.

---

## 7. What I'd want from you

- **Nothing is blocked, and no 1v1 numbers moved.** The dedup is on by default; the beam is opt-in.
- **Is `AI_BEAM=8` on by default for team runs what you want?** I left it off so nothing changes
  silently. If you'd rather the team instruments set it themselves, that's a one-line change.
- **Worth deciding whether to spend a full-grid gate on the beam.** The 90-cell check is three deck
  rows; a 960-cell run would upgrade "bit-identical on 90 cells" to a roster-wide claim, at roughly
  two hours of cold grid. I'd do it before the beam ever became the default, not before you use it
  for team work.
