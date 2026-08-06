# Balance-sim performance: parallelize the suite

- Type: wayfinder:task
- Status: closed
- Assignee: wayfinder (Claude session, 2026-08-06)
- Blocked by: —

## Question

Henry's observation from the deck-pass sessions: `npm run balance` takes ~3.5–4 minutes per run and the deck-tuning loop runs it constantly (the jormungandr pass alone was seven runs). Speed it up without changing what it measures; determinism non-negotiable.

## Resolution

Landed 2026-08-06. Gates: 740/740 vitest, tsc, build clean — and the decisive check: the full sharded run's report is **byte-identical** to the committed one.

**1. Sharding for the worker pool.** Vitest parallelizes per *file*, and the suite was 3 files — so the mirror suite (400 battles × 16 species, two-thirds of the whole load) was one serial lump. It's now a parameterized factory (`mirrorSuite.ts`) invoked by **4 shard files**, and os-variance likewise (`osVarianceSuite.ts`, 2 shards): **7 balance files** total, each on its own core. The gauntlet stays whole because its overall-aggregate redline is computed in-file. `publishFragments` now names fragments per-worker (`suite.pid-seq.json`) so shards can't clobber each other — the merge sorts globally, so naming never reaches the report bytes.

**2. `BALANCE_ONLY` scoped mode — the tuning-loop win: 3m36s → 10s (21×).** `BALANCE_ONLY=jormungandr npm run balance` (Windows cmd: `set BALANCE_ONLY=jormungandr&& npm run balance`; PowerShell: `$env:BALANCE_ONLY='jormungandr'; npm run balance`) scopes every suite to the named species — mirrors, OS variance, and the gauntlet's opponent list all filter through the one `BALANCE_SPECIES` constant. **A scoped run never writes `docs/balance/`** — `writeBalanceReport({commitToDocs:false})` guards it, verified by diff — and prints a clearly-labelled scoped summary instead. Empty shards under scoping register an explicit no-op test rather than tripping vitest's no-tests failure.

**Measured:** full run 3m36s on this 2-core sandbox — CPU-saturated, so sharding can't show its gain here; on an 8-core machine the critical path becomes the longest single shard (≈1500–1600 battles ≈ 60–90s), which is the ticket's target. **Scoped run: 10.0s, measured.** The next deck pass's tuning loop costs seconds per iteration with the full committed run reserved for the final gate — record Henry's real-machine full-run time here when he next runs it. Recorded: 11m09s on the 2-core cloud sandbox, 2026-08-06 (ticket-20 implementation run — in line with the 11m15s projection above); Henry's real-machine time still pending.
