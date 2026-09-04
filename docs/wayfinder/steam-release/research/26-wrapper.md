# Desktop wrapper: Electron vs Tauri vs NW.js, with a working spike (ticket 26)

*Measured 2026-08-21 in a 2-core Linux sandbox against `steam-release-prep` @ `b785f65`. Wall-clock and RAM numbers here are **sandbox** numbers — software rendering under `xvfb`, no GPU, no dbus. They are useful for comparison and as an upper bound; they are not what Henry's machine or a Steam Deck will do. Re-measure on real hardware before quoting them at anyone.*

## Headline

**Electron + `steamworks.js`.** It is the only option of the three that has a working Steam overlay, and the spike proves Mingming's current `dist/` boots in it essentially unchanged. The price is size: ~250–314 MB on disk against a 1 MB game.

The spike is real and reproducible: `docs/wayfinder/steam-release/research/spike-26-electron/` holds the whole wrapper (a 30-line `main.cjs` and a `package.json`) plus a README with the exact commands. **It is not a branch**, which the ticket asked for — Henry's device mount cannot `unlink`, so `git checkout` cannot switch branches there at all (see [ticket 02](../tickets/02-repo-hygiene.md)); a spike branch would have been uncheckoutable on the machine that needs to check it out. Three files in-tree, ignored by the build, cost nothing and can actually be run.

## Comparison

| | **Electron + steamworks.js** | **Tauri** | **NW.js + steamworks.js** |
|---|---|---|---|
| **Steam overlay** | ✅ works — `electronEnableSteamOverlay()` ships in the binding | ❌ **[tauri#6196](https://github.com/tauri-apps/tauri/issues/6196) closed as "not planned"** — the overlay hooks graphics-device init, which the webview owns | ✅ same binding, same support |
| **Steamworks binding** | `steamworks.js` 0.4.0, prebuilt natives, TS types | community only (`steamworks-rs`, `tauri-plugin-hal-steamworks`); no first-party path | `steamworks.js`, same package |
| **Renderer** | bundled Chromium 150 — identical everywhere | **OS webview**: WebView2 on Windows, WebKitGTK on Linux/Deck | bundled Chromium |
| **Disk (measured)** | **314 MB** unpacked / **121 MB** gzipped; **249 MB / 107 MB** after trimming locales | ~10–40 MB (not measured here) | comparable to Electron |
| **Game payload** | `app.asar` = **1.0 MB** | same | same |
| **Cold start (measured)** | **409 / 417 / 631 ms** warm; **4,309 ms** on the very first launch | not measured | not measured |
| **RAM (measured)** | **~570 MB** working set summed across all processes, software rendering | lower | comparable to Electron |
| **Steam Deck / Linux** | native x64 build; `steamworks.js` ships `linux-x64-gnu` | WebKitGTK on Deck is the weakest renderer of the three | native x64 build |
| **Maintenance risk** | the web-game community default | fast-moving; a third party owns the Steam story | shrinking community |

Sizes for Tauri are from its own docs rather than measurement — spiking it needs a Rust toolchain and, more to the point, the overlay verdict settles the question before size gets a vote.

## Why the overlay decides it

Steam's overlay works by injecting itself into the game's graphics device at `SteamAPI_Init`, before rendering starts. Electron can be made to cooperate — `steamworks.js`'s `electronEnableSteamOverlay()` is exactly that accommodation, and it is blunt: it appends `--in-process-gpu` and `--disable-direct-composition`, then force-invalidates each `BrowserWindow` at 60 Hz so Chromium keeps repainting for the overlay to composite over. Tauri hands rendering to the OS webview and cannot make that bargain; the issue asking for it was closed as not planned, with no maintainer path offered.

The overlay is not a nice-to-have here. It is how a Steam player takes a screenshot, opens a guide, or writes the review that this whole map's success metric counts. Shipping without it reads as "not really a Steam game."

Two other things point the same way. [webgamedev.com's desktop guide](https://www.webgamedev.com/publishing/desktop) notes Electron and NW.js are **the only frameworks the two main Steam distribution libraries officially support**, and that WebKit webviews (what Tauri gets on Mac and Linux) are not as performant as Chromium for graphics. Mingming leans on framer-motion in 16 of 24 components and an SVG drag-line layer, so renderer quality is not academic.

NW.js is a real third option — same binding, same Chromium — but it has no advantage over Electron and a smaller community. It stays as a fallback only if Electron hits something specific.

## The spike, and what it proved

`main.cjs` opens one `BrowserWindow` and `loadFile`s the real `dist/index.html` — no shims, no dev server. The page rendered: `document.getElementById('root').innerHTML` came back at **3,278 characters**, i.e. React mounted and drew the main menu, not a blank shell.

```
{"coldStartMs":409,"rootInnerHtmlChars":3278,"totalWorkingSetKB":572836,
 "electron":"43.4.1","chrome":"150.0.7871.224","node":"24.18.1"}
```

**One change was needed, and it is the one the ticket predicted.** `vite.config.ts` sets `base: '/Mingming/'` for GitHub Pages, so the built `index.html` asks for `/Mingming/assets/index-*.js` — an absolute path that resolves to the filesystem root under `file://` and 404s. Rewriting it to `./` made the app load. **`base` must become `'./'` for the desktop build** — relative paths work for both Pages and `file://`, so this is not a fork, just a config edit in [ticket 42](../tickets/42-desktop-packaging.md).

`steamworks.js` 0.4.0 was installed and `require()`d successfully in a bare Node process (no Steam client running), which proves the native module resolves. Prebuilt binaries ship for **win32-x64-msvc, linux-x64-gnu, darwin-x64 and darwin-arm64** — no node-gyp, no build step. The API namespaces are `achievement, apps, auth, callback, cloud, input, localplayer, matchmaking, networking, overlay, stats, utils, workshop` — everything ticket 43 needs and more.

**Packaging caveat found:** `electron-builder` must be told to copy `steamworks.js`'s `dist/{win64,linux64,osx}/` redistributables into the build root; the native `.node` and `libsteam_api` files are not picked up by the default `files` traversal. That is the known trap in the package's own README (its issue #75 for electron-forge users) and it is where ticket 42 will lose an afternoon if nobody writes it down.

## Size, honestly

314 MB unpacked breaks down as: the Electron executable 211 MB, `locales/` 47 MB, `LICENSES.chromium.html` 20 MB, `icudtl.dat` 11 MB, `resources.pak` 7 MB, GL/Vulkan/ffmpeg libs ~16 MB — and `app.asar`, the actual game, **1.0 MB**.

Dropping every locale but `en-US` and the Chromium license HTML takes it to **249 MB unpacked / 107 MB gzipped**. Steam's depot compression is in that ballpark, so a first-time download of roughly **100–130 MB** is the number to plan the store page around. For a 2D card game that is fat but unremarkable — it is what every Electron game on Steam weighs, and players do not read install size as a quality signal at this scale.

## Saves: localStorage must become a file

Steam Cloud syncs **files**, and localStorage is not one. Two routes:

- **Steam Auto-Cloud** — configure root paths in the Steamworks partner site and Steam syncs them on launch and exit. **Zero code.** Limits: 100 MB per write, degraded performance past 256 MB — Mingming's saves are kilobytes.
- **`ISteamRemoteStorage`** (exposed as `steamworks.js`'s `cloud` namespace) — read/write/enumerate under program control. More code, finer control over conflicts.

**Auto-Cloud is almost certainly right for the first release** and ticket 42 should say so; the API is there if save slots later need conflict resolution.

The port is small. Production code touches `localStorage` at **six call sites in three files**: `SaveSystem.ts` (4 — `setItem`/`getItem`/`removeItem`/`getItem`), `SaveSlots.ts` (1 — a `storage()` accessor that already returns `Storage | null`), `AudioEngine.ts` (1 — the same accessor shape). Everything else in the tree is comments or tests. So the desktop path is: introduce one storage adapter behind that `storage()` shape, back it with a JSON file under `app.getPath('userData')` in Electron and with `localStorage` on the web, and point Auto-Cloud at that directory. **Ticket 23 (save v4) should land the adapter seam**, so ticket 42 only has to write the Electron implementation behind it — doing it the other way round means editing the save layer twice.

## Code signing

Steam does not itself require signed binaries, but Windows SmartScreen will warn on an unsigned download and that warning is a wishlist-to-install killer.

| | Cost/yr | Effect |
|---|---|---|
| **OV certificate** | ~$129 (SSL.com) – $499 (DigiCert) | SmartScreen still warns; the warning fades as install reputation accrues |
| **EV certificate** | ~$299 (SSL.com) – $699 (DigiCert) | bypasses SmartScreen immediately; **requires a hardware token**, which complicates any CI-based release |
| **Apple Developer** | $99 | required to notarize a macOS build; org accounts also need a D-U-N-S number |

Against Henry's ≤ $500 *art* budget and "only if recoupable", the reasonable read is: **ship Windows + Linux first and skip macOS entirely** (no $99, no D-U-N-S, no notarization, and macOS is a small slice of Steam), and start with an **OV certificate or none at all**, upgrading only if the SmartScreen warning shows up in player feedback. That is a call for Henry in **[ticket 42](../tickets/42-desktop-packaging.md)** and the numbers above are what it should be made on; ticket 54 owns the licence side.

## What ticket 42 inherits

1. `vite.config.ts` `base: '/Mingming/'` → `'./'` (verified necessary; verified sufficient).
2. Electron + `electron-builder`, `linux` and `win` targets, **no macOS** unless Henry says otherwise.
3. Trim `locales/` to `en-US` and drop `LICENSES.chromium.html` — 65 MB for two lines of config.
4. Copy `steamworks.js/dist/<platform>/` redistributables into the build root explicitly.
5. Call `electronEnableSteamOverlay()` in the main process, and re-measure frame pacing afterwards: it forces `--in-process-gpu` and a 60 Hz forced invalidation, which is not free.
6. Storage adapter behind `SaveSlots.storage()` — **ask ticket 23 to introduce the seam**, implement the file backend here, point Steam Auto-Cloud at `userData`.
7. Code-signing decision (table above), and a real cold-start / RAM measurement on Henry's machine and on a Deck, because every number in this document is a sandbox number.

## Sources

- [webgamedev.com — Desktop publishing](https://www.webgamedev.com/publishing/desktop)
- [ceifa/steamworks.js](https://github.com/ceifa/steamworks.js/)
- [tauri-apps/tauri#6196 — Steam Overlay with Tauri](https://github.com/tauri-apps/tauri/issues/6196)
- [Steamworks — Steam Cloud](https://partner.steamgames.com/doc/features/cloud)
- [Signing binaries and getting on Steam](https://gist.github.com/TrueBrain/d8ec26316a4c4b9f5d6e0b4e84d96db7)
- [Porting a browser-based game to Steam (part 2)](https://log.schemescape.com/posts/game-development/browser-based-game-on-steam-2.html) — a developer who picked WebView2 over both; useful counterweight, but they shipped Windows-only and had no overlay requirement.
