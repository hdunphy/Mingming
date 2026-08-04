# Seeded save factories

- Type: wayfinder:task
- Status: closed
- Assignee: subagent-22-seeded-saves (cowork-2026-08-03-opus5)
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

## Implementation status — 2026-08-03

Code landed by subagent `af1861594a19cc1fa`; **open until Henry's gates pass.**
`createStarterSave(starterId?, seed?)`, `createMingmingInstance(definitionId, level, rng?)` and
`createOwnedProgram(dataId, rng?)` are seeded via `SeedStream`, matching 09's contract exactly
(absent seed → one `rollSeed()`, then thread). `crypto.randomUUID()` and `Math.random()` are gone
from `gameTypes.ts` entirely. Same seed ⇒ deep-equal `IPlayerSave` for all three starters; generated
saves pass `PlayerSaveSchema`. IV bands preserved (0–31 general, 10–15 for starters).

09's fixed save literal in `determinism.test.ts` is replaced by a seeded `createStarterSave` — the
proof this ticket existed for. **Bonus coverage:** the real starter save has a non-null `activeDeck`,
so `createBattleState`'s non-null-deck branch is now exercised for the first time (09's literal had
`activeDeck: null`). It is deterministic; all six battle branches still deep-equal.

No caller changes were needed. One landmine found and defused:

- **`RewardSystem.ts:237` does `pickedIds.map(createOwnedProgram)`**, which passes the array
  **index** as the second argument. A plain `rng?: SeedStream` parameter would have been a compile
  error there and a runtime crash (`0` survives `??`). The parameter is therefore
  `SeedStream | number` with an `instanceof` guard; the `number` arm exists solely for that call
  site and is ignored, never used as a seed. Fixing the call site to
  `pickedIds.map(id => createOwnedProgram(id, rng))` would let the union narrow back and would also
  seed reward-card ids — deliberately left alone as out of scope. See the map's fog.


## Resolution

Shipped in `c224506`; the ticket was left open by the session that did the work.
Closed during a bookkeeping sync on 2026-08-03 after verifying the code is present and the
full suite, `tsc -b` and `npm run build` (including `assert-no-debug`) are green.

Landed: Math.random/randomUUID removed from gameTypes.ts save factories.
