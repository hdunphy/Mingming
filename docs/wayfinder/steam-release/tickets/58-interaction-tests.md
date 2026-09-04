# Interaction tests: a click-level harness over the core loop (ticket 58)

- Type: wayfinder:task
- Status: open
- Assignee: 
- Blocked by: [03](03-ci-gate.md)
- Phase: Foundations

## Why this exists

Two blockers landed on Henry within an hour of each other on 2026-08-24, both in code that had shipped through a green suite, `tsc -b`, a blocking lint gate and a build:

1. **The starter picker was a soft-lock.** `App` chose it on `roster.length === 0`; `MainMenuView` grants a *blueprint*, and only `assembleMingming` writes `roster`. Picking a starter changed nothing on screen and stacked another blueprint on every press. Fixed in `9181ae7`.
2. **No card could be played at all.** `useCodexRecorder` (ticket 31) dispatched from a `globalBattleEventBus` listener, which is emitted synchronously from `resolutionEngine.applyMutations` **inside the reducer**. Redux threw, the throw unwound back through the engine, and `state.battle` was never reassigned — while `useBattleVfx`, on the same bus and called first, had already played the hit animation. Fixed in `7491acf`.

**Neither was reachable by any test in the repo, and not by accident.** Every UI test here uses `renderToStaticMarkup`, which runs no effects, has no event loop and cannot click. Both defects are invisible to it *by construction*: the single frame it renders is correct in both cases. The first bug is a state transition that never happens; the second is an exception thrown from an effect-installed listener during a dispatch. A static render sees neither.

The gap is not "we should have written more tests". It is that the suite has no way to express *"the player did a thing, and then the game was different."* 1585 tests, and the first two things a player touches were both broken.

## What already exists to build on

The harness is not new work — it was already in the tree, used once, for exactly this reason:

- `src/App.errorBoundary.test.tsx` — jsdom + `createRoot` + `act` + dispatched `MouseEvent`s, wired the way `main.tsx` wires it. Predates both bugs.
- `src/App.starterPicker.test.tsx` (`9181ae7`) — clicks a starter card and asserts the screen changed.
- `src/ui/hooks/useCodexRecorder.test.tsx` (`7491acf`) — mounts the hook over a live fight, dispatches a play, asserts the card left the hand and the target lost HP. Fails with the exact reported console error when the fix is removed.

`@testing-library/react` remains forbidden (lockfile change). It is also not needed: `createRoot` + `act` + `dispatchEvent` is the whole harness, and the three files above prove it reaches everything.

## Deliverable

A small, deliberately shallow set of interaction tests over the core loop — the path a player walks in their first five minutes — plus the convention that keeps them cheap.

1. **A shared harness module** (suggested `src/testing/interaction.tsx`, non-`src/debug` so production tests may import it): `mountApp(store)`, `clickText(host, text)`, `flush()`. The three existing files collapse onto it. Keep it under ~80 lines; a harness that grows features is a harness that needs its own tests.
2. **The loop, in one click-level test each.** Each asserts a *state change*, not a rendered string, wherever a store assertion is available:
   - starter picked → picker gone, blueprint held *(exists, fold in)*
   - blueprint spent at the Assembly bay → roster gains a member
   - a gym offer picked, a party picked, "Begin run" → `state.run.run` exists with the chosen party
   - a node clicked on the region map → a battle exists in `state.battle`
   - a card played → it leaves the hand and the target loses HP *(exists, fold in)*
   - END TURN → the enemy acts and the turn returns to the player
   - a fight won → the reward screen appears and the run advances
3. **A no-throw assertion in the harness itself.** Both bugs surfaced first as a console error. `mountApp` should fail the test on any `console.error` or unhandled rejection unless the test opts out (`App.errorBoundary.test.tsx` must opt out — it throws on purpose). This is the cheapest half of the ticket and would have caught bug 2 on its own.
4. **A line in the repo rules** (HANDOFF § Repo rules, and map § Notes if it earns it): *a ticket that adds or changes a screen the player clicks adds one interaction test for the click.* One, not a suite.

## Explicitly out of scope

- Retrofitting the existing `renderToStaticMarkup` tests. They are fine at what they do — cheap assertions about markup — and rewriting ~40 files buys nothing.
- Visual/snapshot testing, screenshots, Playwright, or any second browser runtime. jsdom already runs in the existing vitest config at no extra install.
- Exhaustive coverage. Seven tests over the spine, not a test per control. The value is in the *class* of bug caught, and one test per screen catches it.

## Done when

`npx vitest run` is green with the new tests present; each new test is verified to **fail** when its subject is reverted (state the reverted line in the resolution — the two existing files did this and it is what makes them worth their runtime); the harness is used by all of them and by the three existing files; the repo rule is written down; CI time is reported before and after (gate: under +15 s, since these run in the same jsdom worker).

## Resolution

_(open)_
