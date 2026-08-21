# Pipeline optimization (ticket 108): the 3-hour run becomes minutes

- Type: wayfinder:task - Henry-directed 2026-08-20 ('we really need to optimize our
  testing pipeline' - the latest design test ran 3+ hours). Branch archetype-web.
- Status: **open**. Diagnosis: 2-core VM, single-threaded runs, fixed iteration counts,
  full grids for row-sized questions, and the cache misses on exactly the cells being
  changed. The fix is algorithmic - neither environment has more cores.

## In payoff order

1. **THREE-TIER AI PROTOCOL (amended per Henry's objection, 2026-08-20 - greedy is biased
   against decision-heavy cards, which is exactly what the fun program adds).**
   - **Screening tier = LOOKAHEAD-LITE** (top-2 candidates, 1 determinization vs the
     current top-3 x 2 x depth-2): keeps decision-awareness at ~4-6x cheaper. Default for
     all sweep arms. Build it as an AI_LITE flag beside AI_GREEDY.
   - **Greedy is legal ONLY for pure numeric-knob arms** (power values, stack counts,
     caps - no play-pattern change), AND each such sweep runs ONE arm both ways as a
     calibration check: if its greedy-vs-lookahead delta differs from baseline's beyond
     noise, greedy is DISQUALIFIED for that sweep and it falls back to lite.
   - **Any arm touching a DECISION (new card, consume, conditional, timing) gets full
     lookahead. No exceptions.** The census's greedy-gap list is the reference for decks
     needing extra care.
   - Finalists always confirm at full lookahead, decision grade, two seed bases near lines.
2. **Finish ticket 97 pieces 2+3** - promote scratch/cellWorker.wip.ts +
   parallelGrid.wip.ts (workers, ~1.8x on 2 cores) and build adaptive sampling (CI
   early-stop per cell, floor 10 iterations, never below decision grade near a line;
   ~2-3x). Both compound with the cache and the protocol.
3. **MEASUREMENT MENU (rule, add to HANDOFF verbatim):** arm-ranking = subject ROW,
   10 iter, greedy. Ship gate = subject row, 30 iter, lookahead, two seed bases. 
   Re-baseline = full grid (cache-assisted). A rebuild sweep needs ~30 cells, not 960.
4. **Early termination at screening tier only**: HP-lead cutoff for decided games -
   never in gate-grade runs (it changes measurements).
5. **Second lane: push the branch.** `git push -u origin archetype-web` -> the designer
   session clones in its cloud container and runs measurement tickets in parallel with
   this agent's implementation work - no tree contention, works when Henry's machine is
   off. Keep the remote current after each ship.

Expected compound (revised honest math): 3-hour design test -> 15-20 minutes - half a multiplier traded for an instrument that stays honest about decision-heavy cards. Gates: a timed before/after on a
real sweep, bit-identity spot-check for the workers, the greedy-screen caveat list
embedded in the sweep harness. ONE commit per piece is fine.
