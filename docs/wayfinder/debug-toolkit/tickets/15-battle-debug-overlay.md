# Battle debug overlay

- Type: wayfinder:task
- Status: closed
- Assignee: subagent-15-god-tools (cowork-2026-08-03-opus5)
- Blocked by: [Debug gating scaffold](12-debug-gating-scaffold.md), [Engine state actions](14-engine-state-actions.md)

## Question

Build the god-tools panel inside `DebugRoot`. Specified by
[Live-manipulation command set](05-live-manipulation-command-set.md).

Checklist:

- Verb wrappers under `src/debug/` — pure `(state, args) => IBattleState`, each delegating to
  `battleReducer(state, action)` and appending a `[DEBUG] ...` line to `state.logs`. No new
  `battleSlice` action; the panel dispatches `setBattleState(verb(current, args))`.
- The ten v1 verbs from 05 section 1. Mark in the UI which ride pre-existing engine actions
  (`APPLY_STATUS`, `END_TURN`, `EXECUTE_INTENT`) versus the new ones — it changes what a repro proves.
- Source picker on every damage-ish verb, pre-filled from live battle state (the opposing party's
  active unit relative to the target) and directly overridable. Never self-attribute by default.
  `KILL_ENTITY` requires a source — `calculateDeathXp` needs a real receiver to award XP.
- **Ctrl+Shift+D** toggles the floating overlay; the handler no-ops when focus is in an `input`,
  `textarea` or contenteditable (CardForm and deck naming are real text fields).
- Overlay must not occlude battle UI it is being used to inspect.
- Tests: the verb wrappers are pure functions, so test them headlessly with no React — assert each
  produces the expected state delta and the expected `[DEBUG]` log line.

Done when: `npx vitest run` + `npx tsc -b` + `npm run build` all green, and the overlay can stage a
board mid-battle in `npm run dev`.

## Resolution

**Closed 2026-08-03.** Gates green (run in the cloud sandbox on Linux while Henry was AFK; `tsc -b`, `vitest run` 47 files / 542 tests, `npm run build` incl. `assert-no-debug`, all exit 0).

`src/debug/verbs/` holds the ten v1 verbs as pure `(state, args) => IBattleState` functions, each
delegating to `battleReducer` and appending one `[DEBUG]` line; `GodToolsPanel` dispatches
`setBattleState(verb(current, args))`. 25 headless tests, no React.

Notes from implementation:

- **Source default:** the selected source if it is a living opposing-party member, else the opposing
  party's first living member, else any other living unit, else `null` — the target is excluded at
  every step, so it never self-attributes. When it resolves to `null` the panel *disables* Set-HP and
  Insta-kill rather than falling back to something wrong.
- `SET_VITALS` validates `sourceId` and rejects the whole action if it does not resolve, so
  `setEnergy`/`setTempHp` carry one too even though they fire no hooks. Catalogued as `source: 'inert'`.
- `EXECUTE_INTENT` only resolves for enemy-party units holding an intent in ACTION phase, so "act
  now" is disabled for player-side targets.
- Verbs detect engine rejection by identity (`next === state`) and log `— no-op (engine rejected it)`
  rather than claiming a change that never happened.
