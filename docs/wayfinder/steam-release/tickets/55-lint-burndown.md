# Lint burndown: clear 510 pre-existing errors and make the lint gate blocking (ticket 55)

- Type: wayfinder:task
- Status: open
- Assignee: 
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

## Resolution

_(open)_
