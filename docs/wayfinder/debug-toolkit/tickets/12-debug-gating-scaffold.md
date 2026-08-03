# Debug gating scaffold & DebugRoot shell

- Type: wayfinder:task
- Status: open
- Assignee:
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
