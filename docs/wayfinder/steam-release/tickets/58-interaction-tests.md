# Interaction tests: a click-level harness over the core loop (ticket 58)

- Type: wayfinder:task
- Status: closed
- Assignee: 58-interaction (2026-09-08)
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

**Closed 2026-09-08 (session 58-interaction). Built exactly as specified; every one of the seven tests fails when its subject is reverted; suite +3.3 s.**

### What shipped

1. **`src/testing/interaction.tsx`** — the shared harness, ~80 lines of code. `makeStore()` (the production reducer map without `store.ts`'s autosave subscriber), `mount(store, tree, options)`, `mountApp(store, options)`, `flush()`, `fire(el, type)`, `click(el)`, `findText(host, text, selector)`, `clickText(host, text, selector)`. It registers its own `afterEach` (unmount every root it created, restore spies) so a test file needs no lifecycle boilerplate — the three existing files lost 30–40 lines each. Test files carry `// @vitest-environment jsdom` themselves; the harness is a plain module.
2. **The `console.error` trap.** `mount` spies `console.error` and the harness's `afterEach` fails the test with the captured messages if it was called, unless the test passed `allowConsoleError: true`. `App.errorBoundary.test.tsx` is the one opt-out (it throws on purpose). Unhandled rejections already fail a vitest run, so nothing was added for them. **Verified against bug 2:** restoring the synchronous `dispatch` in `useCodexRecorder.ts:100` makes the card test fail twice — once on its own assertion and once on the trap, which quotes Henry's console error verbatim: *"You may not call store.getState() while the reducer is executing."*
3. **`src/App.loop.test.tsx`** — seven click-level tests over the spine, each asserting a store change. They walk to their screen through the real clicks of the earlier steps rather than a fixture (the loop is the fixture), and the run seed is pinned by mocking `rollSeed` so the offer, graph and opening hand are identical every run. Wall time 4.5 s for all seven; three consecutive runs green.

   | Test | Click path | Store assertion | Reverted line that makes it FAIL |
   |---|---|---|---|
   | starter picked | the KRAKEN `motion.div` | `blueprints.kraken === 1`, picker gone, Assembly bay up | `App.tsx:178` gate back to `rosterSize === 0` (the original soft-lock) |
   | blueprint spent | Assemble (1 blueprint) → Spend blueprint | `roster.length 0 → 1`, blueprint consumed | `RanchScreen.tsx:232` drop `dispatch(assembleMingming)` |
   | run started | Expedition → first offer → first roster card → Begin run | `run.run` exists, `partyIds` = the member, `phase 'map'` | `RunStart.tsx:88` drop `dispatch(startRun(...))` |
   | node entered | first `.rm-travel-button` | `battle.battle` exists with the party, `phase 'encounter'` | `RunScreen.tsx:246` drop `dispatch(enterNode)` |
   | card played | click caster → pointerdown card → pointerup enemy | played id gone from hand, enemy HP down, selection cleared | `useCodexRecorder.ts:100` synchronous dispatch (bug 2) — fails AND trips the trap |
   | END TURN | END TURN, then fake timers advanced until the side returns | `activeSide 'PLAYER'`, `turn + 1`, player HP down or log grew | `BattleArena.tsx:499` drop the AI's `dispatch(endTurn())` |
   | fight won | enemy set to 1 HP → card → VIEW REWARDS → SKIP → CONTINUE SYNCHRONIZATION | `battle null`, `phase 'map'`, `fightsResolved + 1`, map on screen | `BattleArena.tsx:960` drop `dispatch(resolveEncounter())` |

4. **The three existing files collapse onto the harness**, as the ticket asked: `App.errorBoundary.test.tsx` (now `mount(...)` with `allowConsoleError` + `keepStorage`), `App.starterPicker.test.tsx` (keeps the four gate tests; the transition test is folded into the loop), `useCodexRecorder.test.tsx` (`mount(store, <Recorder />)` — and now runs under the trap).
5. **The repo rule** is written into HANDOFF § Repo rules and map § Notes: *a ticket that adds or changes a screen the player clicks adds one interaction test for the click — one, not a suite.*

### Gates

`npx tsc -b` clean, `eslint .` 0 errors, `vite build` + `assert-no-debug` OK, `npx vitest run` **168 files / 2247 tests** green (was 167 / 2240). **CI time: 161.4 s before → 164.7 s after, +3.3 s** against the +15 s gate (same jsdom worker, the loop file is 4.5 s of it).

### Two things learned building it, worth keeping

- **The card-play gesture needs the caster selected first.** `startBattle` leaves `selectedSourceId` null and `handlePlay` refuses without one, so a pointerup on the enemy with a card selected but no caster does nothing — silently. That is the shipped behaviour and the test does what a player does (click your unit first); it is noted here because it is the kind of inert-control the MacroRack convention (*"never inert without a sentence"*) would normally flag, and nothing on the battle screen says why the drop was refused.
- **A first fight's hand is not always four cards after one play.** The kraken v1 kit cantrips, so the first assertion draft (*"hand is one shorter"*) was wrong; the test asserts the played instance id is gone, which is what the 2026-08-24 defect actually violated.

Out of scope, untouched: the ~40 `renderToStaticMarkup` files, `@testing-library/react` (still not installed, still not needed), any second browser runtime.
