# Ticket 154 — The registry sentinels let a bad id travel

> **Status: CLOSED 2026-09-24 — 154a shipped (throw in DEV, sentinel in PROD, no call-site changes), and §6's three hand-written firmware→species resolutions folded onto `speciesOwningFirmware`. 142d is pinned as a test; a production build is unchanged. 154b/c/d are recorded as the further arms and are not open work — reopen against a fresh incident, not on principle.**

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

- **154a — throw in DEV, sentinel in PROD. RULED YES by Henry 2026-09-24 — build it.** `import.meta.env.DEV` already gates the debug root
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

---

## 8. Write-back (2026-09-24) — 154a shipped, and §6 folded in

### What it does

`src/engine/data/registryMiss.ts` holds the whole decision in one place, and both accessors call it
where their `console.warn` used to be:

```ts
if (import.meta.env.DEV && tolerated === 0) throw new Error(message + hint);
console.warn(message);
```

**A shipped build is byte-for-byte what it was** — same sentinel object, same warning, same recovery
— which is what let 154a land without touching any of the 40 call sites §4 measured. `App.tsx`
already gates the debug root on `import.meta.env.DEV`, so the switch is not a new convention.

**The message carries the diagnosis, not just the id.** §2's incident was a CATEGORY confusion — a
firmware id where a species id was wanted — and that is by far the likeliest way either lookup
misses, so the throw names `speciesOwningFirmware` rather than leaving the reader to rediscover it
for a third time. The `Program` half points at `archive/programs-v1.json`, since 162a's alias table
has already been consulted by the time the lookup fails, so a miss there means the card does not
exist under any spelling. The old `console.trace()` for an empty id is gone: an Error carries the
same stack and the runner prints it instead of it being scrolled past.

### The escape hatch, and why it is shaped the way it is

`allowRegistryMisses(reason)` returns a release function, and a suite holds it for one file:

```ts
beforeAll(() => allowRegistryMisses('stackHand skips a card the registry dropped'));
```

`beforeAll` uses the returned function as its teardown, so the tolerance cannot leak into the next
file. It is a COUNTER, not a boolean, so a nested hold cannot be switched off by the inner release —
asserted, along with idempotent release, in `registryMiss.test.ts`.

**It is deliberately not a global switch, a `.env` entry or a vitest setup file.** A blanket opt-out
would turn the whole thing back into a `console.warn`, and 154a's entire value is that a bad id
stops in the suite that produced it.

### What the throw found: eleven tests in six files, and they are two different things

Turning it on failed 11 tests. Every one is now green, and the split is worth recording because it
is §2's "read as noise" claim, quantified:

- **Three files MEANT to reach the sentinel** and are pinning graceful degradation —
  `enemyHand.test.ts` (`stackHand` skips a card the registry has dropped from a saved run),
  `RewardSystem.test.ts` (the element-pool fallback), `baseDecks.test.ts` (`getDeckForOS` returning
  `[]`). These hold the hatch and say why.
- **Three files build battle entities with INVENTED `definitionId`s** — `def1`, `def2`, `test_def`
  in `Kernel.test.ts`, `BugFixes.test.ts`, `drawFormula.test.ts`. Those were never registry-backed,
  and `generateIntents` has been asking the registry about them on every pre-turn for as long as
  they have existed. **That is the noise §2 describes, with a count on it.** They hold the hatch
  rather than being given real species ids: a real species brings a real moveset, which would change
  what those tests measure, and the ticket is not licensed to do that.

### The §3 assertions: still there, no longer the enforcement

`baseDecks.test.ts:51`, `EncounterGenerator.test.ts:27` and `encounter.test.ts:439` all assert
`.id).not.toBe('missing')` after the fact. **They stay green and they are now unreachable as
failures** — under 154a a bad id throws inside `GetProgramData` before the expectation is evaluated,
so the red they would have produced arrives earlier and with a better message.

They are NOT being deleted. Each is a scar from a bad id that travelled far enough to need catching
at the far end (§3), and the sentence still states what that far end requires. What has changed is
that the requirement is enforced upstream instead of being checked downstream — which is the whole
point of the ticket, and the right epitaph for the assertions that were standing in for it.

### §6 — the three hand-written resolutions, folded in

`liveness.ts:132`, `runDeckReport.ts:69` and `runGate.ts:235` each re-implemented firmware → species
by walking `MingmingRegistry` looking for `availableOS.includes(osId)`. All three now call
`run/gyms.speciesOwningFirmware`, which 142d named once and converted the two engine copies onto.
It was free, so it is in.

One of the three was not a literal equivalence and is worth the sentence: `runGate`'s copy searched
`LAUNCH_SPECIES` only, and the shared function searches the whole registry. Same answer for every id
this gate can hold — `TUNED_OS_IDS` is built FROM `LAUNCH_SPECIES`, and a firmware belongs to exactly
one species — and `runGate.test.ts` now asserts both halves of that rather than leaving it as an
argument in a comment.

### §7's gates

| gate | result |
|---|---|
| 142d's bug reproduced as a test | `registryMiss.test.ts` — `GetMingmingData(MingmingRegistry.kraken.availableOS[0])` throws, and the message names `speciesOwningFirmware`. Asserted against a firmware id READ FROM the registry, so it cannot rot into a test about a string |
| no production behaviour change | `vi.stubEnv('DEV', false)` → both accessors return the sentinel with `id: 'missing'`, `primaryElement: 'None'`, `baseCost: 99`, `actions: []`, and do not throw |
| the three §3 assertions stay green | yes — see above for whether they still earn their place |
| `npm run gate` clean | eslint 0, `tsc -b` 0, **2,998 vitest across 210 files**, build clean |

All three claims in `registryMiss.test.ts` were mutation-tested: with the throw disabled 7 of the 9
fail; with the hatch ignored, the 2 that describe the hatch fail. Nothing passes vacuously.

### What is NOT done

154b (a loud error tile where the sentinel renders), 154c (`T | undefined` at 40 call sites) and
154d (branded `SpeciesId` / `FirmwareId`, the only arm that prevents the CLASS) are untouched. 154d
stays recorded as the end state: it would have made 142d a compile error rather than a runtime
throw, and it is the arm to reach for if 154a proves insufficient.
