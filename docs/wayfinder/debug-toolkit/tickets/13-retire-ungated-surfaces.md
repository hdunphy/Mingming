# Retire the ungated surfaces

- Type: wayfinder:task
- Status: closed
- Assignee: subagent-13-retire-ungated (cowork-2026-08-03-opus5)
- Blocked by: [Debug gating scaffold](12-debug-gating-scaffold.md)

## Question

Move the three surfaces that ship to players today behind the gate. Fully specified by
[Debug gating architecture](03-debug-gating-architecture.md) section 3.

Checklist:

- Delete `'balance'` and `'studio'` from the `Tab` union (`App.tsx:21`), from `TAB_CONFIG` (`:30-31`),
  from the render chain (`:105-106`), and drop the `BalanceTester` / `CardStudio` imports (`:10,:12`).
- Re-mount `BalanceTester` and `CardStudio` as panels inside `DebugRoot`. Move the files under
  `src/debug/` too, so the "nothing outside `src/debug/` imports the toolkit" invariant is checkable
  by path alone — but check first whether anything else imports them.
- `main.tsx:5` becomes `if (import.meta.env.DEV) { import('./engine/SimRunner'); }`, keeping
  `window.runSim` available from boot in dev and absent from production.
- Drop SimRunner's unconditional module-scope `console.log` (`SimRunner.ts:104`).
- Remove the now-satisfied `window.runSim` bullet from
  [Determinism groundwork](09-determinism-groundwork.md) if it is still open when this lands.

Done when: `npx vitest run` + `npx tsc -b` + `npm run build` all green, a production build contains
no `runSim` global and no Balance/Studio code, and both panels still work inside the debug layer.

## Implementation status — 2026-08-03

Code landed by subagent `a4a28df38d5d992c9`; **open until Henry's gates pass.**

`App.tsx` loses the Balance/Studio imports, tab-union members, `TAB_CONFIG` entries and render
lines. `main.tsx`'s side-effect import becomes `if (import.meta.env.DEV) { import('./engine/SimRunner'); }`.
SimRunner's module-scope `console.log` is gone. `BalanceTester` and `CardStudio` (plus their CSS)
moved to `src/debug/panels/`. **No other importers existed** — the only references anywhere were the
two imports and two render lines in `App.tsx`.

`DebugRoot.tsx` was rewritten to own chrome only; shared state lifted to `src/debug/debugUI.ts`; new
`src/debug/panels/{types.ts,index.ts}`.

### Panel registration pattern — tickets 15, 16, 17 and 19 MUST follow this

**Adding a panel is two steps and never touches `DebugRoot.tsx`.**

1. Create `src/debug/panels/MyPanel.tsx` with a **default-exported** component taking
   `DebugPanelProps` (`{ presentation: 'floating' | 'docked' }`) or no props at all. Use
   `presentation` to render compactly in the narrow floating layer vs the full-width docked tab.
2. Add **one entry** to the array in `src/debug/panels/index.ts`:
   `{ id: 'mypanel', label: 'My Panel', Component: MyPanel }`. Keep the
   `as const satisfies readonly DebugPanel[]` — `as const` preserves the id literals, `satisfies`
   checks the shape without widening. Array order is display order.

Properties to rely on:

- `DebugPanelId` is **derived** (`(typeof DEBUG_PANELS)[number]['id']`), so adding an entry widens it
  automatically and a typo is a compile error rather than a silently dead panel. Never hand-maintain
  a separate id union.
- **Shared debug state lives in `src/debug/debugUI.ts`, not `DebugRoot.tsx`.** Panels call
  `useDebugUI()` from `'../debugUI'`. **Never import from `./DebugRoot` inside a panel** —
  `DebugRoot → panels/index → panel → DebugRoot` is a runtime cycle. That split is precisely why
  `debugUI.ts` exists.
- `resolveActivePanel()` falls back to `DEBUG_PANELS[0]`, so a stale stored id degrades gracefully.
- Panels are **eagerly** imported into the registry, deliberately: the whole registry rides inside the
  single lazy `DebugRoot` chunk, which only exists in a dev build. Do **not** add per-panel `lazy()`.
- Redux: `useSelector` to read, `useDispatch` to write, from inside the panel. No `debugSlice`,
  `store.ts` untouched (except ticket 17's general-purpose tap point).
- New *shared* state goes in `DebugUIState` + a setter in `debugUI.ts` — still no `DebugRoot` edit.

### Environment findings

- **`rm` does not work on this mount** — `unlink` returns `EPERM` for every file, even
  just-created ones. Files were moved with `fs.renameSync`, which does work as a true move.
- **Two files need deleting on the Windows side:** `_to_delete/__probe.txt` (a stray probe) and the
  whole `_to_delete/` directory of swept git locks.
- The floating panel was widened (360px/60vh → 720px/70vh) and the docked panel given
  `height: 100%; overflow: auto`, because Balance and Studio are full screens rather than tooltips.
  Not specified by the ticket — trivially revertible if Henry dislikes it.


## Resolution

Shipped in `3b042ca`; the ticket was left open by the session that did the work.
Closed during a bookkeeping sync on 2026-08-03 after verifying the code is present and the
full suite, `tsc -b` and `npm run build` (including `assert-no-debug`) are green.

Landed: Balance/Studio moved to src/debug/panels/, main.tsx runSim import DEV-gated, assert-no-debug green.
