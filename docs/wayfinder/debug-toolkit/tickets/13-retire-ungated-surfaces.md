# Retire the ungated surfaces

- Type: wayfinder:task
- Status: open
- Assignee:
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
