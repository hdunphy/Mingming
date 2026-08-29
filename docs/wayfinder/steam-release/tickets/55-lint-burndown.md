# Lint burndown: clear 510 pre-existing errors and make the lint gate blocking (ticket 55)

- Type: wayfinder:task
- Status: closed
- Assignee: agent
- Blocked by: [03](03-ci-gate.md)
- Phase: Foundations

## Why this ticket exists

[Ticket 03](03-ci-gate.md) put `npm run lint` in CI but had to mark it `continue-on-error: true`: the tree fails it with **510 errors and 2 warnings** that all predate the workflow. Henry ruled (2026-08-21) that the CI ticket must not carry a 510-edit diff across the engine, so the burndown is its own ticket and lint is advisory until this one closes.

Measured on `steam-release-prep` at ticket 03's commit, *after* `scratch/` moved into eslint's `globalIgnores` (which removed 76 of the original 588):

| Rule | Count | Notes |
|---|---|---|
| `@typescript-eslint/no-explicit-any` | 296 | the bulk; mostly engine internals and test fixtures |
| `@typescript-eslint/no-unused-vars` | 154 | includes several genuinely dead imports |
| `prefer-const` | 33 | **all 33 auto-fixable** via `eslint --fix` |
| `react-hooks/refs` | 10 | ref read/written during render |
| `react-refresh/only-export-components` | 8 | non-component exports from component files |
| `react-hooks/set-state-in-effect` | 6 | |
| `no-case-declarations` | 3 | |
| `react-hooks/exhaustive-deps` | 2 | warnings |

| Area | Count |
|---|---|
| `src/engine` | 398 |
| `src/ui` | 81 |
| `src/debug` | 30 |
| `scripts` | 2 |
| `src/App.tsx` | 1 |

Worst files: `engine/actions/ActionExecutors.ts` 50, `engine/StatusBehaviors.ts` 35, `engine/battleReducer.ts` 30, `engine/BugFixes.test.ts` 27, `engine/effectHandlers.ts` 25, `engine/data/hookWiring.test.ts` 23.

## Deliverable

Suggested order, smallest blast radius first — each step is independently committable and each must leave `npx vitest run` at 868 passing:

1. `npx eslint . --fix` — clears the 33 `prefer-const` mechanically. Zero semantic change.
2. `no-unused-vars` (154) — delete dead imports/locals. Read each one; some are deliberate `void x` seams or destructuring placeholders and want an `_`-prefix + `argsIgnorePattern` rule instead of deletion.
3. `no-case-declarations` (3) and the 24 react-hooks / react-refresh findings (10 `refs`, 8 `only-export-components`, 6 `set-state-in-effect`, 2 `exhaustive-deps`) — these are the ones most likely to be **real bugs** rather than style. Treat a `set-state-in-effect` or `refs` hit as a defect report before treating it as a lint hit.
4. `no-explicit-any` (296) — the long tail. Typing engine internals is real work; the alternative Henry did **not** pick is downgrading this rule to a warning permanently.
5. Drop `continue-on-error: true` from the lint step in `.github/workflows/ci.yml` and delete the "Note lint outcome" summary step's failing branch.

**Design decisions inside this task stop it.** In particular: if step 4 turns out to need a public engine type changed, that is a deck-archetypes concern, not this map's — file it there and stop.

## Done when

`npm run lint` exits 0 on `steam-release-prep`, the lint step in `ci.yml` is blocking, and `npx vitest run` still reports 868 passing tests.

## Progress — steps 1-3 landed 2026-08-22 (steps 4-5 still open)

**452 errors -> 256, and the 256 are all one rule.** `npx tsc -b` clean, **1547 tests passing**,
build green. The ticket stays open: step 4 (`no-explicit-any`) and step 5 (make the gate blocking)
are untouched, and step 5 cannot land before step 4 does.

| Rule | Before | After |
|---|---|---|
| `@typescript-eslint/no-explicit-any` | 256 | **256** |
| `@typescript-eslint/no-unused-vars` | 141 | **0** |
| `prefer-const` | 31 | **0** |
| `react-refresh/only-export-components` | 8 | **0** |
| `react-hooks/refs` | 7 | **0** |
| `react-hooks/set-state-in-effect` | 5 | **0** |
| `no-case-declarations` | 3 | **0** |
| `react-hooks/exhaustive-deps` | 1 | **0** |

(The table in this ticket's header was measured at ticket 03's commit; the tree had moved since, so
the "before" column is what `eslint` reported at the start of this pass.)

### Step 1 — `--fix`

31 `prefer-const`, mechanically. Zero semantic change; suite unmoved.

### Step 2 — the underscore convention, then 56 genuinely dead things

**71 of the 141 `no-unused-vars` were already correct** and the linter could not read them.
`StatusBehaviors.ts` (35) and `ActionExecutors.ts` (36) are the whole argument: every behaviour
implements one interface, so `onApply(_source, _target, _power)` must accept three arguments whether
or not Burn cares about the source. Position is meaning, so the parameters cannot be deleted;
`void _source` at the top of eleven functions is noise that exists only to satisfy a linter. So the
rule now carries `argsIgnorePattern: '^_'` (plus vars / caught-errors / destructured-array). The
convention was already in the code — this teaches the linter to read it.

`ignoreRestSiblings` is on for exactly one idiom: `const { nextProgramModifier, ...rest } = e` is how
`battleReducer` **strips** a field, so the binding exists precisely to be discarded and has to carry
the real property name. Deliberately not a blanket downgrade — an unused local is still an error
unless it is underscore-prefixed.

That left 56 real ones: 44 dead imports and 12 dead locals, all deleted. **Four were worth reading
before deleting**, and all four turned out to be scaffolding rather than defects:

- `battleReducer.ts:288` `appliedCostReduction` — a **second copy of the discount arithmetic**.
  Harmless only because `getEffectiveCardCost` (line 218) already applies
  `nextProgramModifier.costReduction` through `doesModifierApply`; this one fed nothing and could
  only ever disagree with it.
- `battleReducer.ts:995` `context: HookContext` — hand-built, then never passed to anything.
  `executeStatusDamageCalculated` builds its own; the local is what was left when a direct hook
  invocation was replaced by that call, along with two comments describing the replaced approach.
- `battleReducer.ts:35` `GetBaseCost` — a base-cost lookup with no callers, which could not have
  handled X-cost or the next-program discount anyway. `getEffectiveCardCost` is the one entry point.
- `BattleArena.tsx:59` `LEVEL_UP_OVERLAY_DELAY_MS` — ticket 21 removed levelling; the constant and
  its docblock outlived the overlay they timed.

### Step 3 — the ones the ticket said to treat as defect reports first

**`react-hooks/refs` (7) — one real bug found, fixed for all three sites at once.** Three hover
tooltips positioned their portal by calling `getBoundingClientRect()` **during render**:
`style={ref.current ? (() => { ... })() : {}}`. The render-phase read is what the rule flags, and it
is not a bug *today* (the portal only exists while hovered, and by then the anchor is attached). The
bug is the `: {}` half — on the first render of a newly mounted anchor the ref is null, so the portal
renders with **no positioning at all**, `position: static`, at the top-left of the body.

`ui/hooks/useAnchoredRect.ts` replaces all three: measure in `useLayoutEffect`, keep the rect in
state, and let `rect === null` mean *not measured* so the consumer renders nothing rather than
something misplaced. One hook, three call sites, no render-phase layout reads left.

**`react-refresh/only-export-components` (8) — three new modules, no behaviour change.** The helpers
were never really component-local: `getElementIcon` and `getElementColor` were imported from
`ProgramCard` by two other files, `formatMultiplier` by three. They now live in `cardIcons.ts`,
`cardKeywords.ts` and `elementMatchups.ts`. The payoff is real rather than cosmetic — a module that
mixes a component with plain functions cannot hot-reload as a component, so every edit to a card
chip during development was throwing away component state.

**`no-case-declarations` (3) — braced, and it was not purely stylistic.** `const` in an unbraced
`case` is scoped to the *whole* switch, so `ConditionValidator`'s `op` / `valStr` / `threshold` were
in the temporal dead zone of every case below them. The neighbouring cases were already braced.

**`set-state-in-effect` (5+1) and one `refs` — reviewed, disabled with the reason in the file.** Each
one is a documented `eslint-disable-next-line` rather than a restructure, and each carries the
argument for why:

- `App.tsx` — reacts to a **transition** (in-battle -> not-in-battle) that no render can observe;
  the previous value is in a ref precisely because it is not derivable.
- `BattleArena` turn banner and `BattleStage` death glitch — **timed one-shots** owned by a
  `setTimeout`, not state derived from props.
- `BattleArena` reward bundle — **rolled from a seeded PRNG** and must roll exactly once per victory;
  a render-phase derivation could run twice under StrictMode and hand the player a different drop.
- `BattleStage` art fallback — "reset state when a prop changes"; React's preferred `key` alternative
  would remount animation state that deliberately outlives an art swap.
- `useBattleVfx` — the latest-value ref, **written** (never read) during render, because the event-bus
  listener runs synchronously inside the same commit as a dispatch and an effect-updated ref would
  still hold the previous state when it fires.
- `SaveEditorPanel`'s `exhaustive-deps` — `save` is not read in the memo, it is the **trigger**: the
  memo re-reads what is on disk, and "is the store in sync with storage?" changes exactly when the
  store's save changes.

### What is left

**Step 4: 256 `no-explicit-any`.** 134 are in test files, 19 in `src/debug`, ~103 in engine and UI
source. The ticket's own warning applies to the last group — if typing an engine internal means
changing a public engine type, that is a deck-archetypes concern and this ticket stops.

**Step 5 (drop `continue-on-error` from CI) cannot land until step 4 does**, so lint stays advisory.

## Resolution

**Closed 2026-08-23. The lint gate is BLOCKING.** 510 errors at ticket 03's commit, 452 at the start
of this pass, **0 now** — with two documented exceptions, each disabled in place with the argument
beside it. `npx tsc -b` clean, **1576 tests passing**, build green, `npm run lint` exits 0.

Henry, asked whether to relax the rule inside test files: *"fix them all unless there is a reason not
to."* So all 256 were fixed, tests included, and the two that were not are named below with reasons
rather than hidden behind a rule change.

### Steps 1-3

Landed 2026-08-22 in their own commit; see the Progress section below for the detail. Summary: 452 →
256, `no-unused-vars` / `prefer-const` / `react-refresh` / `react-hooks` all to zero, and three real
findings — a duplicated cost-discount calculation in `battleReducer`, tooltips that rendered
unpositioned on a newly mounted anchor, and a `const` leaking across every arm of a `switch`.

### Step 4: 256 `no-explicit-any` → 2

Worked in eight parallel passes over 40 files, each verified against its own tests before merging.
The rules every pass followed, in order: **name the real type**; where a fixture is deliberately
partial say so with `as unknown as X` rather than `any`; **never change a public engine type to make
a caller compile** — stop and report instead.

**Most of them were noise.** `'Poison' as any` where `'Poison'` is already a `StatusType`;
`const action: any = { type: 'DISCARD', ... }` where `DiscardActionData` exists; seventeen reaches in
`battleReducer` that were already legal through `ProgramAction`'s index signature; three casts in
`BattleArena` that were vestigial. Deleting a cast was the fix more often than writing a type.

**Six wrong annotations were found by typing around them**, which is the part worth keeping:

1. **`PRNG.nextSeed` was `any` in four places, and the truth is two-valued** — `formatSeed` returns a
   string for a string-seeded generator and a number for a number-seeded one, so that feeding the
   seed back reproduces the sequence. Typing it as the bare union broke three call sites that assign
   it into `IBattleState.seed` (a `string`). Rather than paper over those with `String(...)`, `PRNG`
   is now **generic over its seed kind** — `new PRNG(state.seed)` yields `nextSeed: string`. The
   invariant is proved instead of asserted.
2. **`RewardSystem`'s `rollCardFromPool` and `rollForEntity` both declared `nextSeed: number` and
   were wrong.** The PRNG they take is built from `currentSeed: string | number`. The proof was
   already in the file: three lines below one of them, the caller calls `.toString()` on a value the
   signature claims is a number. Corrected to `PrngSeed`.
3. **`HookAction.element` resolved to the DOM's `Element`.** `HookTypes.ts` never imported the game's
   `Element` union and `lib: ["DOM"]` is on, so the global won. Every hook that sets an element was
   type-checked against the wrong thing, and the `(action as any).element` reaches in `HookFactory`
   were hiding it. One import fixed it.
4. **`HookAction['type']` was missing `'HP'`**, which `lib/hooks.json` uses and `HookFactory`
   dispatches on — hence a comparison that needed a cast to compile at all. Added.
5. **`battleReducer`'s `removedStatusQueue` was `{ status: string }`** where the only writer pushes a
   `StatusType`. The widening was what forced a cast at the `onStatusRemoved` dispatch.
6. **`EffectHandler`'s `payload: any` meant the handler registry checked nothing.** Replaced with a
   keyed payload map, so all five call sites are checked against their real shapes.

One deliberate widening went the other way: `ActionExecutor<T>`'s constraint became
`T extends ProgramAction | HookAction`, because `HookFactory` routes a **`HookAction`** through the
same registry and a `HookAction` is not a `ProgramAction` (its type union also carries `LOG`,
`COUNTER`, `DRAW`, `MAX_ENERGY`). The old `ActionExecutor<any>` was hiding a genuinely second caller
shape, not just being lazy.

### The two that remain, and why

Both are **public engine types**, and this ticket says in its own deliverable that a fix needing one
is a deck-archetypes concern. They are disabled at the declaration, once each, with the full argument
in the file:

- **`ProgramAction`'s `readonly [key: string]: any`** (`types.ts`) — the card data model. Every
  action variant extends this interface with its own fields, and ~200 reads across the engine, the
  AI, the balance harness and the UI go through the signature before narrowing. `unknown` is the
  correct type and would break all of them at once. The real fix is making `ProgramAction` a
  discriminated union over `ActionType`, which is a change to **how cards are authored**.
- **`MutationRequest.payload`** (`HookTypes.ts`) — the same problem one level down. Fourteen mutation
  types carry genuinely different payloads (`{amount, isHeal, element}` for HP, `{key, operator,
  amount}` for COUNTER, a whole event for EVENT). Worth doing at the same time as the first, and not
  before.

### Step 5: the gate

`continue-on-error: true` and the "note lint outcome" summary step are gone from
`.github/workflows/ci.yml`; the lint step is a plain blocking `npm run lint`, and the file's header
now says why rather than describing debt that no longer exists. **A new lint error is now a new one
— there is no backlog for it to hide in.**


_(open)_
