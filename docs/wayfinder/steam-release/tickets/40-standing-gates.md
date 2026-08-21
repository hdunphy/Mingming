# Standing quality gates: parity, canary and determinism in CI; release checklist script (ticket 40)

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

