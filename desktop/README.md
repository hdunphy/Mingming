# The desktop build

Ticket 42. An Electron wrapper around the same web build, so the game can ship on Steam, write real
save **files** (Steam Cloud syncs files; `localStorage` is not one), and put run logs in a folder a
tester can be pointed at.

## Building it

From the **repo root**, not from here:

```
npm run desktop:build              # Windows + Linux
npm run desktop:build -- --linux   # Linux only
npm run desktop:build -- --win     # Windows only
npm run desktop:build -- --dir     # unpacked Linux directory; fastest, for checking it runs
```

The first run installs `desktop/node_modules`, which downloads Electron (~250 MB). That is why
Electron is **not** in the root `package.json`: `tsc`, `vitest` and `eslint` never touch it, and CI
should not pay for it on every run.

Artefacts land in `desktop/release/`.

**Build the Windows installer on Windows.** `--win` produces two things: a `zip` (which works
anywhere) and an **NSIS installer** (`Mingming Setup <version>.exe`), and NSIS needs Wine when it is
cross-built from Linux. Without Wine `electron-builder` still writes `win-unpacked/` and the zip —
those are complete and the `.exe` inside them is a real, icon-stamped Windows binary — and then
fails on the installer step with `wine process failed ENOENT`, leaving a truncated `Setup .exe`
behind. **Delete that file if you see it; it is not an installer.** Running the same command on
Henry's Windows machine produces the installer with no such caveat.

## Where the player's files are

`app.getPath('userData')`, which is:

| OS      | Path                                                     |
| ------- | -------------------------------------------------------- |
| Windows | `%APPDATA%\Mingming` (`C:\Users\<you>\AppData\Roaming\Mingming`) |
| Linux   | `~/.config/Mingming`                                      |

and inside it:

- **`saves/`** — one JSON per storage key, which is one per slot. Written atomically (temp file,
  then `rename`), so a crash mid-save leaves the previous save intact rather than truncated JSON
  that the loader would reject. This is the directory ticket 43 points Steam **Auto-Cloud** at.
- **`run-logs/`** — one JSON per finished run, when *Settings → Playtest → Auto-save every run* is
  on. **This is the folder to send.** The settings screen prints this path and has an *Open the
  folder* button, so the tester instruction can be one sentence.

A player who ran an earlier desktop build has a save in Electron's `localStorage` instead. It is
imported into `saves/` on first boot, once, and only when `saves/` is empty — see
`src/engine/save/desktopStorage.ts`.

## What is in here

| File               | What it is                                                                 |
| ------------------ | -------------------------------------------------------------------------- |
| `main.cjs`         | Main process: the window, and the synchronous save / run-log IPC.           |
| `preload.cjs`      | The `contextBridge` surface. A closed set of seven functions — never `ipcRenderer` itself. |
| `package.json`     | Its own npm project, and the `electron-builder` config.                     |
| `build/icon.*`     | **Placeholder art** (Henry, 2026-08-28), until the commissioned logo lands. |
| `app/`             | Generated — a copy of the root `dist/`. Not committed.                      |
| `release/`         | Generated — the packaged builds. Not committed.                             |

## Things worth knowing before touching it

- **The window is 1280×800 and cannot be made smaller.** That is the Steam Deck panel and the
  smallest layout the UI is designed for; below it the battle console clips the hand.
- **F11 toggles fullscreen**, bound in the main process rather than the renderer, because the
  game's keybind layer is a battle control surface.
- **`base` must be `'./'`.** `npm run desktop:build` sets `MINGMING_DESKTOP=1` to get it. A `dist/`
  built for GitHub Pages has absolute `/Mingming/…` asset paths, which resolve against the
  filesystem root under `file://` and open a **blank window with no error**. The build script
  checks the built `index.html` for this and refuses.
- **No Steam API here.** `steamworks.js` is ticket 43. When it lands, note that `electron-builder`
  does not pick up its `dist/{win64,linux64}/` redistributables by default — they have to be copied
  into the build root explicitly.
- **No code signing** (Henry, 2026-08-28). Windows SmartScreen will warn on the downloaded
  installer; Steam itself does not require signing, and the warning does not appear for a game
  launched through the Steam client.
