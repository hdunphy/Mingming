# Sim speed, piece 1: the deterministic cell cache (ticket 97)

- Type: wayfinder:task - infrastructure, **no balance changes**. Branch `archetype-web`.
- Status: **piece 1 closed**. **Pieces 2 and 3 resolved by ticket 108** -
  [research/three-tier-ai.md](../research/three-tier-ai.md): piece 2 (parallelism) is UNPARKED and
  shipped as child processes rather than `worker_threads`, bit-identity gated; piece 3 (adaptive
  sampling) is **rejected as a speed lever** - early stopping manufactures absolutes 10-for-13, and
  blowout count is a metric this project rules on. It belongs back as a PRECISION lever instead.

Picked up off the queue as one of the tickets that needs no design input.

## Measured

| | wall clock | cache |
|---|---|---|
| full 960-cell grid, cold | **58m 23s** | 0 hit / 960 miss |
| full 960-cell grid, warm | **1m 36s** | 900 hit / 60 miss |

**36x, and the two assemblies are byte-identical.** That is the difference between a balance pass
being an hour of dead time and being a coffee.

## How the key is built, and why it is deliberately over-broad

`src/debug/balance/cellCache.ts`. A cell's key hashes:

- both decks' card lists **and the resolved data of every card in them** - a power change on a
  shared card has to invalidate every deck that runs it;
- both species' stat blocks, draw and elements, and their move lists;
- both OSes' firmware - `hooks.json` via `FIRMWARE_REGISTRY`, plus the hand-written
  `CustomFirmware` hook ids;
- **the source text of thirteen engine files** - `combatUtils`, `Hooks`, `HookFactory`,
  `CustomFirmware`, `StatusBehaviors`, `ActionExecutors`, `battleReducer`, `resolutionEngine`,
  `effectHandlers`, `TacticalAI`, `gameConfig`, and the two balance-harness files;
- the seed and the iteration count.

The engine-source term is blunt on purpose: editing `combatUtils.ts` invalidates **all 960 cells**,
even though most never touch the line that changed. The alternative is a model of which constants
reach which cells, which is precisely the kind of cleverness that ships a stale number. Passes that
touch only a deck list, a card or one OS - tickets 82, 84, 86, 93 - keep the rest of the cache,
which is where the 36x lives.

## The bug the first warm run found

The first warm run hit **900 of 960, not 960**. Sixty cells missed, and the reason is worth
recording: **the engine mutates registry-resident card data during a battle**, so a key computed
inside the loop hashed a different object than the same key computed before any cell had run. Keys
are now all computed up front, before the first battle, which removes the ordering dependency
entirely - the slice proof goes 24 hit / 0 miss.

Note what the cache did NOT do: serve those sixty cells from a stale entry. It reported the
inconsistency as a miss and recomputed them. **A cache that is fast and wrong is worse than no
cache**, so the failure mode it has is the one worth having.

## The gate

`scratch/cacheproof.ts` runs a slice three ways - cold, warm, and `FORCE_FULL=1` - and asserts all
three assemblies are byte-identical, plus that warm is all hits and forced reads nothing. It passes.
The full-grid run above is the same proof at 960 cells.

The cache file is gitignored: it is a build artifact keyed on the engine hash, so it is worth
exactly nothing to anybody whose source differs by a character.

## Piece 2 (workers): written, parked, not shipped

`scratch/parallelGrid.wip.ts` + `scratch/cellWorker.wip.ts` + `scratch/parallelproof.ts`. The runner
hands work out by index and writes results back at that index, so output order is input order
whatever order the workers finish in - determinism by construction rather than by discipline, as the
ticket requires.

**It is parked because of the loader, not the logic.** `worker_threads` does not inherit the
parent's TypeScript loader; `--import tsx` resolves against the repo and tsx is a global install in
this sandbox, and registering the hooks from a plain-JS shim trips tsx's own deprecated-`--loader`
guard. On a machine where tsx is a devDependency the first route works unchanged. **This sandbox
also has 2 cores**, so even a working runner could not have demonstrated more than ~2x here - the
piece belongs on a machine with cores to spend.

Piece 3 (adaptive sampling) is untouched. It should come after piece 2, and it is the one piece that
needs care with 0-DECISION-GRADE and the seed-base law - an early stop near a band line is exactly
where a wrong number does damage.

## Not changed

No balance numbers. 851 tests green, `tsc` clean, and the grid this ran against is bit-identical to
the one ticket 93 committed.
