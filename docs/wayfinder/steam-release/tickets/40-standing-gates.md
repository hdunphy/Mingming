# Standing quality gates: parity, canary and determinism in CI; release checklist script (ticket 40)

> **2026-09-25 — CLEANUP (ticket 28b). `BOSS_COMPS` and `gauntlet-boss.balance.ts` are DELETED, so they are not part of any canary set.** That table held the eight teams the FORMULA boss draw could produce, and its own docblock ruled its end: *"that space shrinks by one gym per authoring session until it is empty, at which point this table goes, rather than being ported."* All three gyms are authored (`run/bosses.ts`), so the space is empty and the suite was measuring a boss the game cannot field. **The replacement was already named there and is not new: the run gate pinned to a gym (`npm run balance:run-gate -- --cells gauntlet:fight2 --gym gym_emberfall`) fights the shipped entity through the shipped roll**, and `scratch/t28b_canary.ts` is the cheap version for a composition change (3×3 grid, gym × element party, at beam 0). Ticket 18's FTK-0 / no-stall gates are unaffected — they were properties of the fight, and the run gate reports both.

> **2026-09-24 — NOTE. The short canary set is the 162c partner comps (the EA 3v3 set: detonation, poison, water-engine, keeper, strength, dazed) plus `npm run balance:drivers`; `teamComps.ts` is mostly post-EA species. The run gate's bands are ruled NOISE on v2 until 157's walker (see 67).**

- Type: wayfinder:task
- Status: closed
- Assignee: legion (2026-09-25)
- Blocked by: [03](03-ci-gate.md), [16](16-drivers.md), [28](28-authored-gyms.md)
- Phase: Content Complete

## Deliverable

Make the gates that the design wayfinder relies on run automatically where they are cheap: preview-parity (already in `vitest run`), a SHORT canary (a handful of `teamComps.ts` comps at low iterations, FTK 0 / no stalls — under 60 s) on every push, determinism tests for run generation, and a `npm run release-check` script that runs everything plus `assert-no-debug`, prints asset weight, and fails on any `console.error` during a scripted smoke run. The long `npm run balance` stays manual/nightly.

## Done when

CI time reported; `release-check` is what ticket 52's checklist calls.

## Resolution

Closed 2026-09-25. **Two of the four asks were already met and were recorded rather than rebuilt; the other two are new; and the measurement killed the canary set the 09-24 note named.**

### The short canary cannot be the comps, and that is measured

The 2026-09-24 note put *"the 162c partner comps plus `npm run balance:drivers`"* in the short canary set. **Neither can run on a push.** A 3v3 battle with draw engines runs 70–340 seconds, so **zero of them fit in a 60-second budget**:

| | measured |
|---|---|
| one `balance:drivers` battle, beam 8, `AI_LITE=1` | **91 s** |
| `balance:drivers` at its default scope (9 arms × 12 battles) | **~2.7 h** |
| the 162c comps, one iteration (162 §11's own figure) | **58 min** |

**What ships instead: `npm run canary:short`** — the run gate's two cheap 1v1 cells at 60 samples each. **120 battles, 8 s of compute, 10.4 s wall, exit 0.** Wired into `ci.yml` as a blocking step.

**It gates FTK and stalls, and deliberately NOT the win rates.** The same note rules the bands *"NOISE on v2 until 157's walker"*, and 157 has since moved fight one seventeen points on one deck rule — a job that went red on a win rate would fail builds over a number nobody is tuning to. FTK and stalls are structural claims about the fight and are ticket 18's own standing gates, so a regression in either is a bug rather than a tuning question. `--gate-structural` is that gate, added to `runRunGate.ts` and kept separate from `--strict`, which is the band one.

`npm run balance`, `balance:drivers` and the 162c comps are the nightly set, which is where this ticket already put the long balance run.

### Already met, recorded not rebuilt

- **The console.error smoke gate exists and is standing.** `src/testing/interaction.tsx` spies on `console.error` and fails any test that triggers one unless it opts out; `src/App.loop.test.tsx` drives the whole loop click by click through that harness — starter pick, assembly, gym offer, region map, a card played, END TURN, rewards, an elite and its Driver. That IS the scripted smoke run, it is in `vitest run`, and it has therefore been running on every push since ticket 58. Writing a second one would have been a worse copy that drifts.
- **`assert-no-debug` is the tail of `npm run build`** (with `assert-sfx`), so it is covered by running the build rather than by a second call.
- **Determinism for run generation was covered piece by piece** across seven files — `createRun`, `generateRegionGraph`, `offerGyms`, `rollGauntletFight`, `rollEncounter`'s seed, the marketplace restock and the workshop roll.

### The determinism gap that was real, and now is not

Every one of those asserts that ONE call is pure. None asserted that **the same seed plays the same run**, which can be false while every piece is individually pure — by a shared `SeedStream` consumed a different number of times down one branch, or by a policy reading a clock, a `Math.random` or a `Set` order. A single-call test cannot see either, because one call is consistent with itself.

`runWalker.test.ts` now walks a complete run twice on one seed and asserts the fights, the route, the picks, the buys, the recruits, the patches, the final deck, the scrap and the outcome all match — plus a third walk on a different seed that must NOT match, so the test cannot pass by the walker ignoring its seed.

### `npm run release-check`

`scripts/release-check.mjs`. Typecheck → tests → lint → build, then the asset-weight report, then one verdict; exit 0 only if every gate passed. It orchestrates rather than re-implements, because the gates already existed. Verified end to end:

```
typecheck  PASS    9s
tests      PASS  309s   (incl. preview-parity + the console.error smoke walk)
lint       PASS   60s
build      PASS   11s   (ends in assert-no-debug + assert-sfx)

ASSET WEIGHT — 69 files, 1990.1 KB total
  .js  1016.0 KB (51.1%) · .mp3 674.7 KB (33.9%) · .png 204.8 KB (10.3%) · .css 86.7 KB (4.4%)
```

Weight is printed, not gated: a budget would be a number nobody has ruled on, ticket 39 owns the performance targets, and `assert-sfx` already gates the one asset class with a ruled budget.

### CI time, as the Done-when asks

Measured on a quiet 2-core sandbox, the convention ticket 03's resolution set (GitHub's runners are faster):

| gate | wall |
|---|---|
| typecheck | 9 s |
| `vitest run` — **213 files / 3,093 tests** | 278 s |
| lint | 60 s |
| build | 11 s |
| **`canary:short`** (new) | **10 s** |

**A regression this row caught on the way, worth more than the row's own deliverable.** `runWalker.test.ts`'s whole-walk case carried the note *"a seed chosen because it ends QUICKLY"* — true when written. **157-r2 softened the opening fight, so runs survive further, and that one test grew to 40 seconds**, most of the gap between a 127-second suite and a 243-second one. Nothing failed; the premise decayed silently. **A seed chosen for speed is a premise any balance change can retire without saying so**, so it is bounded by `stopAfterFights` now — three fights is three fights whatever the ladder does next. That file went 39.5 s → 7.6 s, and no single test now exceeds 4.1 s.

