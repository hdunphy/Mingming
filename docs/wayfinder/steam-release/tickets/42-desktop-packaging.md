# Desktop packaging: wrapper, file-backed saves, icon, Windows + Linux builds (ticket 42)

- Type: wayfinder:task
- Status: open
- Assignee: 
- Blocked by: [26](26-wrapper-research.md), [23](23-save-v4.md), [36](36-settings-screen.md)
- Phase: Steam

## Deliverable

Per ticket 26's ratified choice: add the wrapper project (`desktop/`), set Vite `base` to `./` for desktop builds (keep Pages working via env), move saves from `localStorage` to a file-backed store in the user-data directory behind the existing `SaveSystem` interface (one JSON per slot, atomic write, the same zod validation) with a one-time import of the localStorage save, app icon set (.ico/.icns/.png — from ticket 34's logo), window defaults + fullscreen (ticket 37), Windows and Linux (Steam Deck) builds, a `npm run desktop:build`. Code signing on Windows is a cost/decision for Henry (SmartScreen warnings without it; Steam itself does not require it) — record the answer.

**PLUS, from [ticket 59](59-run-telemetry.md) (2026-08-24):** a **`run-logs/` directory under `app.getPath('userData')`**, and `ISettings.autoSaveRunLog` writing a run's transcript straight into it instead of triggering a browser download. This is what Henry actually asked for — *"turn this on and then when you're done send me the files from {file location}"* — and the web build cannot do it: `showDirectoryPicker` is Chrome/Edge only and its permission is not reliably persisted between sessions. The download fallback shipped in the meantime and stays for the web build; the wrapper is where the named path becomes real. Name the path in the packaged build's own docs, because the tester instruction quotes it.

## Done when

Both builds launch from a clean machine, load/save a run, and `release-check` passes on the desktop bundle.

## Resolution

_(open)_

