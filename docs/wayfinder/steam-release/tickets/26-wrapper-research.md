# Desktop wrapper research: Electron + steamworks.js vs Tauri, with a spike (ticket 26)

- Type: wayfinder:research
- Status: closed
- Assignee: legion-02 (2026-08-21)
- Blocked by: —
- Phase: Foundations

## Question

The build is pure web (`vite build`, GitHub Pages, `base: '/Mingming/'`). Steam needs a desktop executable with Steamworks bindings (achievements, overlay, Steam Cloud, Steam Deck). Investigate and SPIKE (a branch that boots the current `dist/` in a wrapper): Electron + `steamworks.js` (the webgamedev.com recommendation — Chromium graphics, the only wrappers the Steam libraries officially support) vs Tauri (small binary, OS webview, weaker graphics + no first-class Steamworks binding) vs NW.js. Measure: bundle size, cold-start time, RAM, Steam overlay working, Linux build for Steam Deck, how `localStorage` should move to a file-backed store (Steam Cloud syncs files), code-signing needs on Windows, and what `base` must become (`./`).

## Done when

`research/26-wrapper.md` with the comparison table, the spike branch name, and a recommendation Henry ratifies in ticket 42.

## Resolution

Closed 2026-08-21. Findings and the full comparison table in **[research/26-wrapper.md](../research/26-wrapper.md)**. Spike in **[research/spike-26-electron/](../research/spike-26-electron/)**.

### Recommendation for Henry to ratify in [ticket 42](42-desktop-packaging.md)

**Electron + `steamworks.js`.** Not because it is elegant — it is 250–314 MB of runtime around a 1 MB game — but because **it is the only one of the three where the Steam overlay works**. Tauri's overlay issue ([tauri#6196](https://github.com/tauri-apps/tauri/issues/6196)) is **closed as "not planned"**: the overlay hooks graphics-device initialization, and Tauri hands rendering to the OS webview, so it cannot make the bargain Electron makes. The overlay is how a Steam player takes a screenshot, opens a guide, or writes the review this map's success metric counts.

NW.js is a viable fallback (same binding, same Chromium) with no advantage and a smaller community.

### The spike works, and it found the thing the ticket predicted

Mingming's **real, unmodified `dist/`** boots in Electron 43.4.1 / Chromium 150 and renders: `#root` came back with 3,278 characters of HTML — React mounted and drew the main menu, not a blank shell.

**Exactly one change was needed: `base: '/Mingming/'` → `'./'`.** Under `file://`, `/Mingming/assets/index-*.js` resolves to the filesystem root and 404s into a blank window. Relative paths work for GitHub Pages too, so this is one config edit, not a fork. The ticket guessed right.

### Measurements (2-core sandbox, xvfb, software rendering — an upper bound, not Henry's machine)

| | |
|---|---|
| Cold start | **4,309 ms** first-ever launch, then **631 / 417 / 409 ms** |
| RAM | ~**570 MB** working set summed across all processes |
| Packaged, unpacked | **314 MB** (executable 211, `locales/` 47, chromium licence HTML 20, `icudtl.dat` 11) |
| Packaged, gzipped | **121 MB** |
| After trimming locales to `en-US` + dropping the licence HTML | **249 MB / 107 MB** |
| The game itself (`app.asar`) | **1.0 MB** |

`steamworks.js` 0.4.0 `require()`s successfully with no Steam client present; prebuilt natives ship for **win32-x64, linux-x64-gnu, darwin-x64, darwin-arm64** — no node-gyp. Namespaces available: `achievement, apps, auth, callback, cloud, input, localplayer, matchmaking, networking, overlay, stats, utils, workshop`.

Packaging trap found for ticket 42: `electron-builder` does **not** pick up `steamworks.js`'s `dist/{win64,linux64,osx}/` redistributables by default; they must be copied into the build root explicitly.

### Saves — smaller job than feared

Steam Cloud syncs files, so `localStorage` has to become one. **Steam Auto-Cloud** (path-based, zero code, 100 MB per write) is right for the first release; the `ISteamRemoteStorage` API is there if save slots later need conflict resolution.

Production code touches `localStorage` at **six call sites in three files** — `SaveSystem.ts` (4), `SaveSlots.ts` (1, already a `storage(): Storage | null` accessor), `AudioEngine.ts` (1, same shape). So: one adapter behind that accessor shape, a JSON file under `app.getPath('userData')` in Electron, `localStorage` on the web, Auto-Cloud pointed at that directory. **[Ticket 23](23-save-v4.md) should introduce the adapter seam** so ticket 42 only writes the Electron backend — otherwise the save layer gets edited twice.

### Code signing

Steam does not require it; Windows SmartScreen effectively does. OV ~$129–499/yr (warning fades as reputation accrues), EV ~$299–699/yr (bypasses SmartScreen immediately, needs a hardware token that complicates CI), Apple $99/yr plus a D-U-N-S number to notarize. Against Henry's budget the reasonable read is **Windows + Linux only, no macOS**, starting with OV or nothing and upgrading only if SmartScreen shows up in player feedback. His call in ticket 42; the numbers are in the research doc.

### Deviation from the ticket: no spike *branch*

The ticket asked for a branch. There is no branch, and there should not be one: Henry's device mount cannot `unlink`, so **`git checkout` cannot switch branches there at all** (established in [ticket 02](02-repo-hygiene.md)) — a spike branch would have been uncheckoutable on the one machine that needs to run it. The spike is instead three files committed on `steam-release-prep` at `research/spike-26-electron/` (`main.cjs`, `package.json`, `README.md` with the exact repro commands). Nothing in the app imports them and nothing in `npm run build` reaches them. If ticket 42 later wants a branch on a machine that can check one out, `git switch -c spike/electron-wrapper` from any commit after this one has everything already in the tree.
