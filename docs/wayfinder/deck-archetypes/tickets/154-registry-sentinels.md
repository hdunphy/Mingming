# Ticket 154 — The registry sentinels let a bad id travel

**Type:** wayfinder:task — engine hygiene, no balance surface. **Status:** OPEN, opened 2026-09-11
off ticket 142d, where the sentinel cost an afternoon and was then misdiagnosed twice.
**Henry:** *"Add a ticket for that please"* — after asking *"Did you fix the bug?"* about 142d's
firmware-id defect, where the honest answer was "I fixed my instance; the thing that caused it is
still there."
**Relates to:** 59 (the registry triage that walks these same lookups), 139 (description-data guard
— the other place a registry lie was made checkable).

---

## 1. What happens today

Both registry accessors answer a bad id with a **plausible object** rather than a failure:

| accessor | on a bad id | the object it returns |
|---|---|---|
| `GetMingmingData` (`mingmingRegistry.ts:1058`) | `console.warn('Mingming ID not found: …')` | `{ id: 'missing', name: 'Missing Mingming', primaryElement: 'None', … }` |
| `GetProgramData` (`programRegistry.ts:108`) | `console.warn('Program ID not found: …')`, plus `console.trace()` when the id is empty | `{ id: 'missing', name: 'Missing Program', baseCost: 99, actions: [] }` |

Each sentinel is deliberate and its reasoning is sound as far as it goes: *"it exists so a bad id
renders a hollow unit instead of throwing."* A player mid-run should not get a white screen because
one id is wrong.

**The cost is that the value is well-formed, so it does not stop — it propagates.** `'None'` is a
real element. `99` is a real cost. Nothing downstream can tell them from data.

## 2. The 142d incident, as the worked example

`gym.leaderComp` holds **firmware** ids (`kraken_v1`), not species ids. 142d's first biome builder
called `GetMingmingData('kraken_v1')`, took `.primaryElement`, and got `'None'` — three times over.
It then built a biome advertising an element no species pool contains. The failure surfaced **three
files away**, as `createRun.test` reporting that a run had read the wall clock.

Two things about that are the actual argument for this ticket:

1. **The warning was printed nine times, in the same test output being read**, and was taken for
   noise beside a failing assertion about a clock. A `console.warn` that fires during a normally
   noisy test run is not a signal.
2. **It was then written up wrong, twice** — first as "returns undefined", then as "fails
   silently". Neither is true. A failure mode that the person who just debugged it still describes
   incorrectly is a failure mode that will be rediscovered.

## 3. The evidence that it has bitten before

Three tests already assert against the sentinel *after the fact*, each in a different file:

- `baseDecks.test.ts:51` — `expect(program.id).not.toBe('missing')`
- `EncounterGenerator.test.ts:27` — `expect(data.id).not.toBe('missing')`
- `encounter.test.ts:439` — `for (const id of enemyDeckIds) expect(GetProgramData(id).id).not.toBe('missing')`

Nobody writes that assertion unprompted. Each is a scar from a bad id that travelled far enough to
need catching at the far end, which is the pattern this ticket removes the need for.

## 4. Blast radius, measured

**40 non-test call sites** for `GetMingmingData`:

| area | sites |
|---|---|
| `src/ui/screens` | 22 |
| `src/engine/run` | 5 |
| `src/engine/data` | 5 |
| `src/debug/scenarios` | 3 |
| `src/ui/components` | 2 |
| `src/engine/core`, `src/engine`, `src/debug/panels` | 1 each |

That distribution is why this is its own ticket and not a fix folded into 142d: changing the return
type to `T | undefined` is a 40-site change concentrated in the UI, and doing it inside a route
change would be a refactor smuggled under a gameplay commit.

## 5. Arms, cheapest first — Henry picks

- **154a — throw in DEV, sentinel in PROD.** `import.meta.env.DEV` already gates the debug root
  (`App.tsx:26`), so the convention exists. A bad id stops the moment it is created, in the only
  environment where anyone is watching; a shipped build behaves exactly as it does now. **No call
  site changes.** This is the recommendation: it fixes the thing that actually went wrong (a bad id
  travelling in development) at the smallest possible surface.
- **154b — make the sentinel loud where it renders.** Keep the object, but have the UI draw it as
  an obvious error tile rather than a hollow unit. Complements 154a; does nothing for engine-side
  propagation like the 142d case, which never reached a screen.
- **154c — `T | undefined` and make every caller decide.** The honest type. 40 call sites, 22 of
  them UI. Large, and worth doing only if 154a proves insufficient.
- **154d — a typed id, so `kraken_v1` cannot be passed where `kraken` is wanted.** Branded types
  (`SpeciesId` / `FirmwareId`) make 142d's exact bug a compile error rather than a runtime warning.
  The largest change and the only one that prevents the *class*; worth recording as the end state
  even if it is not built now.

## 6. Also in scope, and small

The firmware→species resolution is written out by hand in **three** remaining places —
`src/debug/balance/liveness.ts:132`, `runDeckReport.ts:69`, `runGate.ts:235`. 142d named that
resolution once as `gyms.speciesOwningFirmware` and converted the two engine copies; these three are
debug-toolkit territory and were left alone deliberately. Fold them in here or leave them; the
point is that they are known, not forgotten.

## 7. Gates

- The 142d bug, reproduced as a test: resolving a firmware id through the species path fails loudly
  under the chosen arm rather than yielding `'None'`.
- No behaviour change in a production build under 154a — same sentinel, same warning.
- The three "not.toBe('missing')" assertions in §3 stay green, and the ticket says whether they are
  now redundant or still earning their place.
- `npm run gate` clean.
