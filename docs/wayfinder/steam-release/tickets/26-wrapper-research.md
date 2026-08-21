# Desktop wrapper research: Electron + steamworks.js vs Tauri, with a spike (ticket 26)

- Type: wayfinder:research
- Status: open
- Assignee: 
- Blocked by: —
- Phase: Foundations

## Question

The build is pure web (`vite build`, GitHub Pages, `base: '/Mingming/'`). Steam needs a desktop executable with Steamworks bindings (achievements, overlay, Steam Cloud, Steam Deck). Investigate and SPIKE (a branch that boots the current `dist/` in a wrapper): Electron + `steamworks.js` (the webgamedev.com recommendation — Chromium graphics, the only wrappers the Steam libraries officially support) vs Tauri (small binary, OS webview, weaker graphics + no first-class Steamworks binding) vs NW.js. Measure: bundle size, cold-start time, RAM, Steam overlay working, Linux build for Steam Deck, how `localStorage` should move to a file-backed store (Steam Cloud syncs files), code-signing needs on Windows, and what `base` must become (`./`).

## Done when

`research/26-wrapper.md` with the comparison table, the spike branch name, and a recommendation Henry ratifies in ticket 42.

## Resolution

_(open)_

