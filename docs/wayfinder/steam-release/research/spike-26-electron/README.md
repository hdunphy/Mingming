# Ticket 26 spike — Mingming's `dist/` inside Electron

Throwaway measurement rig, kept in-tree because it is three files and it is the thing anyone will
want to re-run. **Not** the packaging setup — that is [ticket 42](../../tickets/42-desktop-packaging.md).

It lives here rather than on a spike branch because Henry's device mount cannot `unlink`, so
`git checkout` cannot switch branches on the machine that would need to run it (see
[ticket 02](../../tickets/02-repo-hygiene.md)). Nothing here is imported by the app or reachable
from `npm run build`.

## Run it

From the repo root:

```bash
npm run build                                  # produces dist/
cd docs/wayfinder/steam-release/research/spike-26-electron
npm install
cp -r ../../../../../dist ./app                # the real built game, unmodified
sed -i 's#="/Mingming/#="./#g' app/index.html  # see below — this is the `base` finding
npm start                                      # on a headless box: xvfb-run -a npx electron . --no-sandbox
```

It opens one hidden `BrowserWindow`, `loadFile`s `app/index.html`, waits for `did-finish-load`,
prints a JSON line of measurements and quits. Nothing is left running.

## The `sed` line is the finding, not a workaround

`vite.config.ts` sets `base: '/Mingming/'` for GitHub Pages, so the built HTML asks for
`/Mingming/assets/index-*.js`. Under `file://` that absolute path resolves to the filesystem root
and 404s — a blank window. Rewriting it to `./` is what makes the app load, which is why
`research/26-wrapper.md` says **`base` must become `'./'`** for the desktop build. Relative paths
work for Pages too, so it is one config edit rather than a fork.

## What it printed (2026-08-21, 2-core sandbox, xvfb, software rendering, no dbus)

```
{"coldStartMs":409,"rootInnerHtmlChars":3278,"totalWorkingSetKB":572836,
 "electron":"43.4.1","chrome":"150.0.7871.224","node":"24.18.1"}
```

`rootInnerHtmlChars` is the assertion that matters: 3,278 characters inside `#root` means React
mounted and drew the main menu, not that a window opened over a blank page.

Cold start across four runs: **4,309 ms** (first ever launch, cold page cache) then **631 / 417 /
409 ms**. Packaged with `npm run package`: **314 MB** unpacked, **121 MB** gzipped, of which
`resources/app.asar` — the whole game — is **1.0 MB**. Trimming `locales/` to `en-US` and deleting
`LICENSES.chromium.html` gives **249 MB / 107 MB**.

Sandbox numbers. Re-measure on real hardware before quoting them.
