# Desktop packaging: wrapper, file-backed saves, icon, Windows + Linux builds (ticket 42)

- Type: wayfinder:task
- Status: closed
- Assignee: legion-42
- Blocked by: [26](26-wrapper-research.md), [23](23-save-v4.md), [36](36-settings-screen.md)
- Phase: Steam

## Deliverable

Per ticket 26's ratified choice: add the wrapper project (`desktop/`), set Vite `base` to `./` for desktop builds (keep Pages working via env), move saves from `localStorage` to a file-backed store in the user-data directory behind the existing `SaveSystem` interface (one JSON per slot, atomic write, the same zod validation) with a one-time import of the localStorage save, app icon set (.ico/.icns/.png — from ticket 34's logo), window defaults + fullscreen (ticket 37), Windows and Linux (Steam Deck) builds, a `npm run desktop:build`. Code signing on Windows is a cost/decision for Henry (SmartScreen warnings without it; Steam itself does not require it) — record the answer.

**PLUS, from [ticket 59](59-run-telemetry.md) (2026-08-24):** a **`run-logs/` directory under `app.getPath('userData')`**, and `ISettings.autoSaveRunLog` writing a run's transcript straight into it instead of triggering a browser download. This is what Henry actually asked for — *"turn this on and then when you're done send me the files from {file location}"* — and the web build cannot do it: `showDirectoryPicker` is Chrome/Edge only and its permission is not reliably persisted between sessions. The download fallback shipped in the meantime and stays for the web build; the wrapper is where the named path becomes real. Name the path in the packaged build's own docs, because the tester instruction quotes it.

## Done when

Both builds launch from a clean machine, load/save a run, and `release-check` passes on the desktop bundle.

## Resolution

**CLOSED 2026-08-28.** Henry's rulings, taken as three answers: **1. Electron**, **2. no code
signing**, **3. Windows and Linux, placeholder icon.** The wrapper is `desktop/`, the game's own
`src/` gained exactly one new module, and both builds were produced and the Linux one driven.

### What Henry ruled, and the two corrections to the ticket

1. **Electron**, ratified from ticket 26. The size (283 MB unpacked) buys the Steam overlay, which
   Tauri cannot host.
2. **No code signing.** SmartScreen will warn on the downloaded installer. It does not warn for a
   game launched through the Steam client, and Steam does not require signing — recorded here as
   the ticket asks.
3. **Windows and Linux only. Placeholder icon.**

**The ticket's icon assumption was wrong and was flagged before building:** it says the icon set
comes *"from ticket 34's logo"*, and **ticket 34 produced no logo** — its art pass was tokens, node
icons and biome backdrops, with the identity art commissioned separately. Henry ruled a placeholder.
`desktop/build/icon.png` (1024x1024) and `icon.ico` (7 sizes, 16-256) are two fanned cards with a
diamond, drawn against `tokens.css`'s own background; all seven `.ico` images were verified present
inside the built `Mingming.exe`.

**`release-check` does not exist.** The Done-when says *"`release-check` passes on the desktop
bundle"*, but there is no such script in `package.json` or in any workflow — it is
**[ticket 40](40-standing-gates.md)'s deliverable**, and 40 is open and blocked behind 16 and 28.
Read here as *the existing gates, on the desktop bundle*, which is what was run. Not invented, and
flagged rather than quietly satisfied.

### What was built

| File | What it is |
| --- | --- |
| `desktop/main.cjs` | Main process. Window, F11 fullscreen, single-instance lock, and the synchronous save / run-log IPC. |
| `desktop/preload.cjs` | The `contextBridge` surface: seven named functions, never `ipcRenderer` itself. |
| `desktop/package.json` | Its own npm project + the `electron-builder` config. |
| `desktop/build/icon.{png,ico}` | Placeholder art. |
| `desktop/README.md` | Where the player's files live, and the four traps. |
| `src/engine/save/desktopStorage.ts` | The whole desktop save port: an adapter, the legacy import, the install. |
| `src/engine/save/desktopStorage.test.ts` | 11 tests, jsdom, a fake bridge — no Electron. |
| `scripts/desktop-build.mjs` | `npm run desktop:build`. |
| `vite.config.ts` | `base: MINGMING_DESKTOP === '1' ? './' : '/Mingming/'`. |

**Ticket 23's seam held exactly as it promised.** Its header said *"ticket 42 implements
`FileSaveStorage` behind this interface; nothing else needs to change when it does"* — and nothing
did. `SaveSystem`, `SaveSlots`, `runLog`, `runTelemetry`, `settings` and `AudioEngine` are untouched;
the swap is one call at the top of `main.tsx`.

### Decisions taken inside the build, and why

- **Synchronous IPC (`sendSync`).** `ISaveStorage` is synchronous by ruling, because an async save
  API leaks into every reducer that touches persistence and into the autosave subscription. The cost
  of keeping that true is paid in a main process doing nothing else, on single JSON files of a few
  KB, on a save and not per frame.
- **Atomic writes** — temp file, then `rename`. `localStorage` commits a value whole; a plain
  `writeFileSync` interrupted by a crash leaves truncated JSON that the zod parse rejects, i.e. the
  run gone at the moment the game was trying hardest to keep it.
- **The legacy import is guarded on the DESTINATION being empty, not on a flag.** A flag can be lost
  with the storage it lives in, and then the guard is gone exactly when it matters. It is for anyone
  who ran an earlier desktop build, where Electron gave `file://` a real `localStorage`; a browser
  origin and a packaged app share nothing, so there is no web player to carry across.
- **`electron` is NOT a root dependency.** It is ~250 MB of binary that `tsc`, `vitest` and `eslint`
  never touch, so `desktop/` is its own npm project, installed on demand by the build script.
- **The build script is Node, not shell.** `MINGMING_DESKTOP=1 vite build && cp -r` does not run on
  Windows, which is the machine that has to run it.
- **The script refuses a web `dist/`.** `base` comes from an environment variable, so a stale
  Pages build is indistinguishable at the directory level and produces a **blank window with no
  error** — ticket 26 lost time to exactly this. The built `index.html` is checked for absolute
  `/Mingming/` asset paths.

### Ticket 59's other half, finished

`autoSaveRunLog` and `exportRunLogs` now both go through one `writeRunLogFile`, which takes the
bridge when it is there and falls back to the browser download when it is not — **including when a
desktop write fails**, because a transcript in the player's Downloads beats one lost to a read-only
`userData`. `SettingsScreen` prints the real path instead of "your downloads folder" and grows an
*Open the folder* button. Henry's ask — *"turn this on and then when you're done send me the files
from {file location}"* — is now literally true, and the path is in `desktop/README.md` because the
tester instruction quotes it.

### Verified, on the packaged build

`npx tsc -b`, `eslint .` at **0**, `vitest run` **133 files / 1863 tests green**, `vite build` +
`assert-no-debug`. Then, against `release/linux-unpacked/` driven over CDP under Xvfb:

- The renderer **mounts** (`#root` populated, starter picker rendered) and assets resolve — the
  built `index.html` requests `./assets/index-*.js` under `file://`.
- `window.mingmingDesktop.isDesktop === true`; `paths()` returns `~/.config/Mingming/{saves,run-logs}`.
- **`localStorage.length === 0`** after boot — the backend swap took, and nothing fell back.
- The game wrote **`saves/mingming_saves.json`** (the slot index) on its own, through its own save
  path, before anything was poked.
- Picking a starter wrote **`saves/mingming_ranch__slot_1.json`** = `{"version":4,"ranch":{...
  "blueprints":{"kraken":1} ...}}`.
- **Killed and relaunched: the app opened at the ranch, not the starter picker**, with the blueprint
  intact. Load and save both proven on a real packaged binary.
- `writeRunLog` landed a file in `run-logs/`.

**Windows was built but NOT run** — no Windows machine here, and Henry was told so before the build
started. `release/win-unpacked/Mingming.exe` is a real PE32+ x86-64 GUI binary with all seven icon
images embedded, and `Mingming-0.1.0-win.zip` (146 MB) is complete. The **NSIS installer needs Wine
to cross-build from Linux** and fails with `wine process failed ENOENT`, leaving a truncated
`Setup .exe` that was deleted. Running `npm run desktop:build -- --win` on Henry's own Windows
machine produces the installer with no such caveat, and that is the recommended route — the zip is
146 MB, far past what can be handed over through this session.

**Sizes:** `linux-unpacked` 283 MB, `win-unpacked` 368 MB, win zip 146 MB. The game itself is
`app.asar` at **1.18 MB** — ticket 26's ~314 MB estimate was close.

### Post-close fix, 2026-08-29 — the build script did not run on Windows

The one thing that could not be tested here, and it was broken. `npm run desktop:build -- --win` on
Henry's machine died with **`spawnSync npx.cmd EINVAL`**.

The script called `npx`/`npm`, spelled `npx.cmd` on Windows because they are batch shims there. That
is necessary and **not sufficient**: since the fix for CVE-2024-27980, **Node 20+ refuses to
`execFile` a `.bat`/`.cmd` at all** without `shell: true`, because arguments could otherwise break
out of a batch shim into the command line.

`shell: true` would have worked and was not taken — it reintroduces quoting problems the moment a
path contains a space, and this repo lives under `C:\Users\hdunp\Documents\...`. Instead the
script no longer uses the shims: `vite` and `electron-builder` are plain Node CLIs, so they run as
`process.execPath node_modules/…/bin.js`, which skips the shim, the shell and the PATH lookup and
behaves the same on both platforms. `npm install` has no such file to point at, so it uses
**`npm_execpath`** — npm's own `npm-cli.js`, which npm sets for every script it runs.

Also added, because npm sets this trap rather than the script: `npm run desktop:build --win`
(no `--`) is eaten by npm as one of its own config options and runs with **no arguments**, silently
building both targets. The script now says so when no target flag arrives.

Verified again end to end (`--dir`) after the change; lint 0.

### Windows VERIFIED, 2026-09-01 (Henry)

Henry ran `npm run desktop:build -- --win` on his own Windows machine and ran the result: **it
builds and it runs.** That closes the one outstanding verification on this ticket ("Windows was
built but NOT run", above). Recorded late — the run happened before this note and nobody updated
the ticket. Nothing else on 42 is open; the icon is still the placeholder by ruling 3.

### Left for other tickets

- **Ticket 43 (steamworks.js).** Noted in `main.cjs` where it bites: `electron-builder` does not pick
  up `steamworks.js`'s `dist/{win64,linux64}/` redistributables by default.
- **Ticket 43 also gets the Auto-Cloud path for free**: `userData/saves/` is one JSON per slot, so it
  is a path rule and no code.
- **Ticket 40** owns `release-check`.
- **The icon is a placeholder** and should be replaced when the commissioned art lands.

