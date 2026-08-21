# Error boundary + crash-safe saves (ticket 04)

- Type: wayfinder:task
- Status: closed
- Assignee: legion-02 (2026-08-21)
- Blocked by: —
- Phase: Foundations

## Deliverable

There is no `ErrorBoundary` anywhere; any render throw is a white screen, and two screens wipe the save via `window.location.reload()`. Add: (1) a top-level boundary in `main.tsx`/`App.tsx` with a "something broke — your save is safe" screen, a copy-state-to-clipboard button (reuse `debug/snapshotIO.ts` export shape), and a return-to-ranch action; (2) autosave (`store.ts:43-56`) must never write a save that fails `PlayerSaveSchema.parse()` — it already validates, but it fails silently; surface the failure and keep the last good save; (3) a localStorage quota/write-failure path that does not lose the run.

## Done when

A deliberately thrown render error in battle shows the boundary, and the save loaded afterwards is the last good one. Test added.

## Resolution

Closed 2026-08-21. **43 new tests across 5 files, all green; suite 868 → 902.** `tsc -b` clean, `npm run build` clean, and the lint count is **unchanged at 510** — this ticket added no lint debt.

### (1) The boundary

`src/ui/components/ErrorBoundary.tsx` — a class component (no hook equivalent for `getDerivedStateFromError` / `componentDidCatch`), wired in `src/main.tsx` **inside** the Provider so it can dispatch and **outside** `App` so it covers both of `App`'s early returns as well as the tab content.

The screen leads with `SOMETHING BROKE` / *"Your save is safe. Nothing was written over."* and offers three actions:

- **RETURN TO RANCH** — `main.tsx` wires it to `dispatch(setBattleState(null))`. `battle` is the only slice that is not persisted, so clearing it costs the run in progress and never the save; `App` then falls out of its `isInBattle` early return on its own.
- **COPY CRASH REPORT** — the error, its stack, React's `componentStack`, and the whole Redux state as pretty-printed JSON. The button reports the outcome honestly (`COPIED ✓` / `COPY FAILED — SELECT ABOVE`) instead of assuming the write worked.
- **RELOAD** — a plain reload, safe now that it is named as such. Worth noting *why* this needed saying: the two existing `window.location.reload()` calls (`BattleArena.handleDefeatReset`, `HubScreen.handleRestart`) fire immediately after a deliberate `deleteSave()`, so "reload to fix it" was muscle memory pointing at a data-loss button.

Everything the boundary needs from outside arrives as a prop (`onReturnToRanch`, `snapshotState`, `copy`, `reload`), so it imports no store singleton and needs no Provider in tests.

**One ticket instruction had to be read narrowly.** "Reuse `debug/snapshotIO.ts` export shape" cannot mean *import* that module: `src/debug/` is DEV-only, nothing outside it may import it, and `scripts/assert-no-debug.mjs` fails the build if the toolkit reaches `dist/` — an import would drag the whole toolkit into every shipped bundle. So `src/ui/utils/crashReport.ts` mirrors the *convention* (stamped envelope, generated `name`, `version`, `createdAt`, payload beneath; the same pure-builder / thin-IO split) and shares no code. Names come out as `crash-20260821033000-battlesc`, the same spirit as `snapshot-t14-a3f9c02b`.

`buildCrashReport` never throws, whatever it is handed — a crash handler that can itself crash is worse than no crash handler. Covered for: thrown strings, thrown non-`Error` objects, circular Redux state (degrades to a `stateError` field), a `snapshotState` thunk that throws, and a clock that throws.

`copyCrashReport` tries `navigator.clipboard` and falls back to `document.execCommand('copy')` — the Clipboard API needs a secure context, and the environments where a crash is most likely to be reported from (`file://`, an old Electron shell, plain http on a LAN) are exactly the ones that do not have one. That matters for [ticket 26](26-wrapper-research.md)'s desktop build.

### (2) and (3) Crash-safe saves

The guarantee turned out to be an **ordering** property, so `saveGame` was restructured to make the ordering explicit and each stage separately classifiable: **validate → serialize → write**. A state that fails `PlayerSaveSchema` never reaches `setItem`, and a `setItem` that throws leaves the previous value intact per the Web Storage spec. On every failure path the bytes in storage are still the last save that was known good — no backup copy needed.

`saveGame` now returns a `SaveResult` with a `kind`:

| kind | when | player-facing meaning |
|---|---|---|
| `validation` | `PlayerSaveSchema.parse` or `JSON.stringify` failed | a bug; nothing written |
| `quota` | `setItem` threw a quota error | recoverable — free space |
| `storage` | `setItem` threw anything else | private mode / storage disabled |

Quota detection covers Chrome/Safari (`QuotaExceededError`, legacy code 22), Firefox (`NS_ERROR_DOM_QUOTA_REACHED`, code 1014) and older WebKit builds whose only clue is the message.

**Surfacing it** is the part that did not exist. `store.ts`'s autosave handled failure with `console.error` — invisible in a packaged desktop build, where there is no console. A player could keep going for an hour on a save that stopped updating an hour ago and only find out on relaunch. Added:

- `src/ui/store/saveHealth.ts` — a plain observable (`subscribeSaveHealth` / `getSaveHealth` / `reportSaveResult`). Deliberately **not** a Redux slice: the autosave callback runs *inside* `store.subscribe`, so dispatching from it would re-enter the store on every save. It returns a stable snapshot reference across repeated successes, or `useSyncExternalStore` would re-render the banner on every single autosave.
- `src/ui/components/SaveHealthBanner.tsx` — a non-modal top-of-viewport strip, with wording per `kind`, a consecutive-failure count, and a collapsed details block. Non-modal on purpose: the run is still playable and interrupting it would be worse than the problem. It is a **sibling** of the boundary rather than a child, so a second unrelated render fault cannot take the warning down with it.

### Files

| File | |
|---|---|
| `src/ui/components/ErrorBoundary.tsx` | new — the boundary |
| `src/ui/components/SaveHealthBanner.tsx` | new — the surfacing |
| `src/ui/utils/crashReport.ts` | new — pure report builder + clipboard half |
| `src/ui/store/saveHealth.ts` | new — save-failure observable |
| `src/engine/SaveSystem.ts` | `SaveResult` / `SaveFailureKind`, explicit validate→serialize→write, quota classification |
| `src/ui/store/store.ts` | autosave reports every outcome to `saveHealth` |
| `src/main.tsx` | boundary + banner wired |
| `src/ui/components/ErrorBoundary.test.tsx` | new — 8 tests |
| `src/App.errorBoundary.test.tsx` | new — 3 tests, the acceptance criterion |
| `src/engine/SaveSystem.crashSafe.test.ts` | new — 6 tests |
| `src/ui/store/saveHealth.test.ts` | new — 8 tests |
| `src/ui/utils/crashReport.test.ts` | new — 9 tests |

### Tests — the "done when", literally

`src/App.errorBoundary.test.tsx` wires the boundary exactly as `main.tsx` does, mocks `BattleArena` to throw, and asserts: the boundary renders instead of a white screen; `localStorage` still holds the byte-identical last good save; RETURN TO RANCH nulls `state.battle.battle` and gets a screen rendering again with the save still untouched; and the crash report carries the live Redux state.

The repo has no `@testing-library/react` and adding one would mean committing a `package-lock.json` change, which this repo does not do — so these mount with `createRoot` + React 19's `act` under a per-file `// @vitest-environment jsdom` docblock. `onUncaughtError` / `onCaughtError` are stubbed on the root because React 19 re-reports caught errors to the console by design and the noise buries the assertions. **This is the repo's first DOM-mounting test**; everything before it used `renderToStaticMarkup`, which cannot exercise an error boundary at all. Future component tests can copy the shape.

### Gates (sandbox container, 2 cores)

| Gate | Result | Wall |
|---|---|---|
| `npx tsc -b` | pass | 6 s |
| `npx vitest run` | **pass — 74 files / 902 tests** (was 69 / 868) | 46 s |
| `npm run lint` | 510 errors, 2 warnings — **identical to before this ticket** | 17 s |
| `npm run build` | pass, `assert-no-debug` OK | 5 s |

### Left for later, deliberately

- The two `window.location.reload()` calls after `deleteSave()` are **untouched**. They are correct for what they do (a deliberate wipe), and rewriting the defeat and restart flows is run-structure work that belongs to [ticket 19](19-run-end.md), not here.
- No telemetry. The crash report is a copy-to-clipboard affordance, nothing is transmitted; [ticket 53](53-post-launch.md) owns the opt-in question.
- `SaveHealthBanner` styles inline like the rest of `HubScreen`/`MainMenuView` rather than adding to `index.css`; the UI art pass ([ticket 34](34-ui-art-pass.md)) can fold it into the design system.
