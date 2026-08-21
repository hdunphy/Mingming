# Error boundary + crash-safe saves (ticket 04)

- Type: wayfinder:task
- Status: open
- Assignee: 
- Blocked by: —
- Phase: Foundations

## Deliverable

There is no `ErrorBoundary` anywhere; any render throw is a white screen, and two screens wipe the save via `window.location.reload()`. Add: (1) a top-level boundary in `main.tsx`/`App.tsx` with a "something broke — your save is safe" screen, a copy-state-to-clipboard button (reuse `debug/snapshotIO.ts` export shape), and a return-to-ranch action; (2) autosave (`store.ts:43-56`) must never write a save that fails `PlayerSaveSchema.parse()` — it already validates, but it fails silently; surface the failure and keep the last good save; (3) a localStorage quota/write-failure path that does not lose the run.

## Done when

A deliberately thrown render error in battle shows the boundary, and the save loaded afterwards is the last good one. Test added.

## Resolution

_(open)_

