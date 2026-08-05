# Balance-sim performance: parallelize the suite

- Type: wayfinder:task
- Status: open
- Assignee: —
- Blocked by: —

## Question

Henry's observation from the deck-pass sessions: `npm run balance` takes ~3.5–4 minutes per run, and the deck-tuning loop runs it constantly (the jormungandr pass alone was seven runs). Speed it up without changing what it measures:

- **Parallelism first** — the suite is three `*.balance.ts` files (mirror, gauntlet, os-variance) of embarrassingly parallel seeded sims. Check `vitest.balance.config.ts`'s pool settings (threads vs forks, maxWorkers); ensure files AND test cases within files can fan out across cores. The sims are pure CPU-bound reducer calls with no shared state beyond the report collector — `publishFragments`/`recordMatchup` aggregation must stay correct under concurrency (fragments were designed for this; verify).
- **Work reduction second** — a `--changed`-style scoped mode for the tuning loop (e.g. `npm run balance -- os:jormungandr mirror:jormungandr` runs only named matchups) so a deck iteration costs seconds, with the full committed run reserved for the final gate. Report writing must refuse to commit a partial run's report (guard so `docs/balance/` is only overwritten by full runs).
- **Measure** — before/after wall-clock on the full run recorded here. Target: full run under ~90s on a typical 8-core machine, scoped run under ~20s.

Determinism is non-negotiable: same seeds, same results, byte-identical report regardless of worker count or sharding.
