# Ticket 188: Rename the installer, the shortcut and the window, and keep the saves where they are

**Type:** desktop packaging, plus one small guard on the saves folder. **Status:** **CLOSED 2026-10-08** (all three rows built and merged; `appId` stays as it is, Henry: no change; the one check left is Henry's own launch of the renamed build, row E4 of [ticket 206](206-open-decisions-2026-10-08.md)). RULED (Henry, 2026-10-02: *"Yes rename everywhere"*). **BUILT 2026-10-07 (188a, 188b, 188c).** Henry still owes one launch of the renamed build to confirm his runs and ranch show (the saves folder should still be `Mingming` under `AppData\Roaming`), and the `appId` answer. Small, and independent of everything else on this map (it touches `desktop/` only, no `src/`).

**Where it comes from.** The game is now called **Mingming: Midgard Circuit**. Commit `2d30f54` changed only the words a player reads inside the game (the page title, the credits line, the Steam Input template, the desktop description). The installer, the Start-menu shortcut and the desktop app's own name still say "Mingming". Henry was asked whether those should follow, and said yes.

## What changes, and what stays

| Thing | Today | After |
|---|---|---|
| Desktop app name (`desktop/package.json`: `productName` and `build.productName`) | `Mingming` | `Mingming Midgard Circuit` |
| Windows shortcut (`nsis.shortcutName`) and the installer's file name | `Mingming` | `Mingming Midgard Circuit` |
| Linux executable (`linux.executableName`) | `mingming` | `mingming-midgard-circuit` |
| The desktop window title | whatever the page title says | `Mingming: Midgard Circuit` (it already follows `index.html`) |
| Words in docs and store text that name the game | mixed | the full name where the game is named, plain "Mingming" where a creature is meant |

**Why no colon in the file names.** Windows does not allow a colon in a file or shortcut name, so the names above drop it. Everything a player reads on screen keeps the colon.

**What stays the same, on purpose** (none of it is read by a player, and changing it breaks things):

- The save keys (`mingming_*`) and the IPC channel names. Changing them would make every existing save read as "no save".
- The word **Mingming** for the creatures.
- **`appId` (`com.hdunphy.mingming`)** stays by default: it is the installer's identity, so changing it makes Windows treat a new version as a different app. Nobody outside Henry has installed a release yet, so this is cheap to change now if he wants it changed. One line to rule on, below.

## The one real risk: the saves folder

Electron keeps a desktop game's saves in a folder named after the app. Rename the app and the game would look in a new, empty folder, so Henry's existing runs and ranch would **appear to be gone**. They would not be deleted, only not found.

**Default fix (recommended): pin the saves folder to the name it has today.** In `desktop/main.cjs`, before the app starts, set the user-data folder to the current `Mingming` folder explicitly. The app can then be renamed freely and the saves never move. The alternative, copying the old folder to a new one on first launch, works too, but it leaves two copies and a chance of losing one.

## Rows

| Row | What | Depends on |
|---|---|---|
| 188a | Pin the saves folder: a tiny module that returns the folder, used by `main.cjs`, and a test that it is still the `Mingming` folder under the app-data directory on Windows and Linux | none |
| 188b | The rename in `desktop/package.json` (the table above), then a packaging run on Henry's machine (`npm run pack:dir` is the quick check) to see the new names | 188a |
| 188c | A sweep of the places that name the game: the docs, the itch.io page text in ticket 181's steps, and the store notes in steam-release 45. Report what was changed | 188b |

**Done when:** the installer file, the Start-menu shortcut and the window all say Mingming: Midgard Circuit (without the colon in file names), and **Henry's existing runs and ranch are still there** after launching the renamed build. That second check is Henry's: launch it and look.

**To rule on (small): should `appId` change too?** Default: no. Say yes and 188b changes it as well.

## How to work this ticket

1. **Read the whole row first.** Search for the names quoted in it; line numbers drift.
2. **Test first** where there is code to test (188a). `desktop/` has no test runner of its own, so the small module goes in a place the main vitest run can reach.
3. **Commits** authored as Henry (`git -c user.name='Henry Dunphy' -c user.email='hdunphy15@gmail.com' commit ...`), no `Co-Authored-By`, last line `HANDOFF: <one sentence>`. **Do not push.** One commit per row, stage explicit paths only.
4. **Line endings:** CRLF in `docs/wayfinder`, LF in `src` and `desktop` files you create.
5. **Report** in plain English, ending with what Henry owes.

## Resolution

Built 2026-10-07 as three commits (188a `b6645df7` pins the saves folder to `Mingming` with a test, 188b `fd1e2093` renames the app, shortcut and Linux executable, 188c `e813335d` sweeps the docs), merged 2026-10-08. `savesFolder.cjs` also had to be added to the packaged file list, or the packaged app would crash on start. Installer, shortcut and executable names come from electron-builder defaults and were not seen, because no packaging build was run. **Closed 2026-10-08** with that launch check handed to Henry (ticket 206, E4).
