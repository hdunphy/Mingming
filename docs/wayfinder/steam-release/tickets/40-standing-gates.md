# Standing quality gates: parity, canary and determinism in CI; release checklist script (ticket 40)

> **2026-09-25 — CLEANUP (ticket 28b). `BOSS_COMPS` and `gauntlet-boss.balance.ts` are DELETED, so they are not part of any canary set.** That table held the eight teams the FORMULA boss draw could produce, and its own docblock ruled its end: *"that space shrinks by one gym per authoring session until it is empty, at which point this table goes, rather than being ported."* All three gyms are authored (`run/bosses.ts`), so the space is empty and the suite was measuring a boss the game cannot field. **The replacement was already named there and is not new: the run gate pinned to a gym (`npm run balance:run-gate -- --cells gauntlet:fight2 --gym gym_emberfall`) fights the shipped entity through the shipped roll**, and `scratch/t28b_canary.ts` is the cheap version for a composition change (3×3 grid, gym × element party, at beam 0). Ticket 18's FTK-0 / no-stall gates are unaffected — they were properties of the fight, and the run gate reports both.

> **2026-09-24 — NOTE. The short canary set is the 162c partner comps (the EA 3v3 set: detonation, poison, water-engine, keeper, strength, dazed) plus `npm run balance:drivers`; `teamComps.ts` is mostly post-EA species. The run gate's bands are ruled NOISE on v2 until 157's walker (see 67).**

- Type: wayfinder:task
- Status: open
- Assignee: 
- Blocked by: [03](03-ci-gate.md), [16](16-drivers.md), [28](28-authored-gyms.md)
- Phase: Content Complete

## Deliverable

Make the gates that the design wayfinder relies on run automatically where they are cheap: preview-parity (already in `vitest run`), a SHORT canary (a handful of `teamComps.ts` comps at low iterations, FTK 0 / no stalls — under 60 s) on every push, determinism tests for run generation, and a `npm run release-check` script that runs everything plus `assert-no-debug`, prints asset weight, and fails on any `console.error` during a scripted smoke run. The long `npm run balance` stays manual/nightly.

## Done when

CI time reported; `release-check` is what ticket 52's checklist calls.

## Resolution

_(open)_

