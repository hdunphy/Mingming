# Seeded save factories

- Type: wayfinder:task
- Status: open
- Assignee:
- Blocked by: [Determinism groundwork](09-determinism-groundwork.md)

## Question

Finish the determinism story. [Determinism groundwork](09-determinism-groundwork.md) made battle
*creation* reproducible, but *save* creation is still nondeterministic, so a scenario cannot start
from a generated save.

`src/engine/gameTypes.ts` — `createStarterSave`, `createMingmingInstance` and `createOwnedProgram`
still use `crypto.randomUUID()` for ids and `Math.random()` for IVs (`:124,130-132,146,174,179-181,187`).
Consequence observed during 09: `createStarterSave()` cannot appear in a determinism test at all,
so 09's test uses a fixed save literal instead.

Checklist:

- Thread an optional seed through the three factories, reusing `SeedStream` from
  `src/engine/core/SeedStream.ts` (built by 09) rather than inventing a second mechanism.
- Absent seed → roll once and thread, matching 09's pattern so behaviour is unchanged for callers
  that don't care.
- Replace 09's fixed-literal save in `src/engine/data/determinism.test.ts` with a seeded
  `createStarterSave`, which is the real proof.

Done when: same seed ⇒ deep-equal `IPlayerSave`, and `npx vitest run` + `npx tsc -b` + `npm run build`
all green.
