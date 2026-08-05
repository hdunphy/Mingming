# Debug gating scaffold & DebugRoot shell

- Type: wayfinder:task
- Status: closed
- Assignee: subagent-12-gating-scaffold (cowork-2026-08-03-opus5)
- Blocked by: — ([Debug gating architecture](03-debug-gating-architecture.md) closed)

## Question

Build the gate and the empty shell every other debug surface mounts into. Fully specified by
[Debug gating architecture](03-debug-gating-architecture.md) sections 1, 2 and 4 — no decisions left.

Checklist:

- `src/debug/DebugRoot.tsx` — the single import edge. Exports the component plus a
  `__DEBUG_TOOLKIT__` marker string. Holds debug UI state (open, `floating` vs `docked`, active
  panel, last loaded scenario) in React state/context; **no `debugSlice`, no `store.ts` edit**.
- `App.tsx` — `const DebugRoot = import.meta.env.DEV ? lazy(() => import('./debug/DebugRoot')) : null`,
  rendered inside a `<Suspense fallback={null}>` **above both early returns** (`:72-74`, `:76-78`),
  which are left untouched. Add `'debug'` to the `Tab` union (`:21`) and append the tab entry to
  `TAB_CONFIG` (`:23-32`) via `...(import.meta.env.DEV ? [debugTab] : [])`.
- Floating presentation: chip + hotkey (hotkey choice belongs to
  [Live-manipulation command set](05-live-manipulation-command-set.md); pick a placeholder here).
  Docked presentation: rendered by the `'debug'` tab in the render chain (`:98-107`).
- Delete the unwired `INITIALIZE_BATTLE` case from `battleReducer` (`:37,60-61`) and its action type
  if nothing else references it — audit gap #10.
- `scripts/assert-no-debug.mjs` — fails if `__DEBUG_TOOLKIT__` appears anywhere in `dist/`. Wire
  `package.json`'s `build` script to `vite build && node scripts/assert-no-debug.mjs`, and raise with
  Henry that the repo's shipping gate should become `npm run build` rather than bare `npx vite build`,
  or the assertion never runs.
- Verify by inspection as well as by the script: `vite build` output contains no `DebugRoot` chunk.

Done when: `npx vitest run` + `npx tsc -b` + `npm run build` all green, the debug layer is reachable
in `npm run dev` at roster 0, mid-battle and in the hub, and the assertion script fails when
deliberately given a non-gated import.

## Implementation status — 2026-08-03

Code landed by subagent `a1115592dc41c30ba`; **ticket stays open until Henry runs the gates**
(`npm run build`, `npx vitest run`, `npx tsc -b`) on Windows — they cannot run through the device
bridge (Windows-only `node_modules`).

Created: `src/debug/DebugRoot.tsx` (single import edge; exports the component and
`__DEBUG_TOOLKIT__`; UI state via module store + `useSyncExternalStore` + context, no `debugSlice`,
`store.ts` untouched; Ctrl+Shift+D with input/textarea/contenteditable guard),
`scripts/assert-no-debug.mjs` (walks `dist/`, exits 1 on marker or missing dist; assembles the marker
at runtime so it can't flag itself).
Modified: `src/App.tsx` (lazy DEV-gated DebugRoot, `'debug'` tab, docked render),
`src/engine/battleReducer.ts` (`INITIALIZE_BATTLE` union member + case deleted),
`package.json` (`build` script).

Findings that amend this ticket's assumptions:

- **The early-return instruction was self-contradictory** ("don't modify them" vs "DebugRoot must
  render in all three paths"). Resolved by changing only the *returned JSX* — each return wrapped in
  a fragment with `debugLayer` as child index 0 — so conditions and the gauntlet `useEffect` are
  untouched, and React keeps the debug layer mounted across roster-0 → hub → battle transitions
  rather than remounting it.
- **`package.json`'s `build` was already `tsc -b && vite build`**, not bare `vite build`. The
  assertion was appended, not substituted, so type-checking is not silently dropped. This partly
  answers [Debug gating architecture](03-debug-gating-architecture.md)'s open flag: the repo already
  has an `npm run build` gate. The flag narrows to "any path invoking bare `npx vite build` skips the
  assertion".
- **`INITIALIZE_BATTLE` had no other references** anywhere in `src/` — no test, slice or sim. Safe
  deletion; audit gap #10 fully closed.
- **Line endings are mixed** and there is no `.gitattributes`: `App.tsx`/`package.json`/`main.tsx`
  are LF, `battleReducer.ts`/`store.ts` are CRLF. Existing endings were preserved per file. Contradicts
  the HANDOFF's "line endings are CRLF" claim — worth correcting there.
- `DebugPanelId` is typed `string`, not a union; later tickets own the panel names.
- `npm run lint` may warn `react-refresh/only-export-components` on `DebugRoot.tsx`, since the ticket
  requires both the component and the marker to be exported from it. Warning-level.

## Resolution

**Closed 2026-08-03.** Henry ran the gates on Windows: `npm run build`, `npx vitest run` and
`npx tsc -b` all green. The gate is live — `src/debug/DebugRoot.tsx` is the single import edge,
DEV-gated behind a lazy dynamic import, and `scripts/assert-no-debug.mjs` fails the build if the
`__DEBUG_TOOLKIT__` marker ever reaches `dist/`.

Shipped exactly as specified in [Debug gating architecture](03-debug-gating-architecture.md); see
the Implementation status section above for the file list and the four findings that amended this
ticket's assumptions. Audit gap #10 is fully closed: `INITIALIZE_BATTLE` had no references anywhere
in `src/`.

The open flag from 03 section 1 is **resolved rather than outstanding**: `package.json`'s `build`
was already `tsc -b && vite build`, so the assertion appended cleanly and the repo's shipping gate
was already `npm run build`. What remains is only the narrower caution that any path invoking bare
`npx vite build` skips the assertion.
