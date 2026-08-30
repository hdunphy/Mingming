/**
 * THE DESKTOP MAIN PROCESS — ticket 42.
 *
 * Henry ratified ticket 26's recommendation on 2026-08-28: **Electron**, no code signing to start
 * with, **Windows and Linux only**, placeholder icon until the commissioned art lands.
 *
 * # WHY ELECTRON, GIVEN THE SIZE
 *
 * It is ~250 MB of runtime around a 1 MB game, and it is still the right answer for one reason:
 * **the Steam overlay only works here.** Tauri hands rendering to the OS webview and the overlay
 * hooks graphics-device initialisation, so it cannot make the bargain Electron makes — their issue
 * is closed as "not planned". The overlay is how a player takes a screenshot, opens a guide, or
 * writes the review this map's success metric counts.
 *
 * # WHAT THIS PROCESS IS FOR, AND WHAT IT DELIBERATELY IS NOT
 *
 * It does three things: open a window on the built game, and answer two synchronous questions from
 * the renderer — *where do saves live* and *where do run logs go*. That is all. There is no Steam
 * API here: `steamworks.js` binding is [ticket 43](../docs/wayfinder/steam-release/tickets/43-steamworks-integration.md),
 * and mixing it in would mean this ticket could not be verified without a Steam client running.
 *
 * **One packaging trap ticket 26 found, recorded here because it bites in 43 rather than now:**
 * `electron-builder` does not pick up `steamworks.js`'s `dist/{win64,linux64,osx}/` redistributables
 * by default. They have to be copied into the build root explicitly.
 *
 * # THE SECURITY POSTURE IS THE DEFAULT ONE, ON PURPOSE
 *
 * `contextIsolation: true`, `nodeIntegration: false`, and a preload that exposes four named
 * functions through `contextBridge`. The renderer is a game that loads no remote content, so this
 * costs nothing and means a future embedded page (a patch note, a link) cannot reach the filesystem.
 */

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

/*
 * WINDOW DEFAULTS.
 *
 * 1280x800 rather than 1280x720: that is the **Steam Deck's** panel (ticket 37 rules it as a target,
 * and ticket 34's screenshots are taken at it), so the default window is the smallest supported
 * layout. A game that opens at its tightest size is one whose first impression is the one that had
 * to be designed most carefully.
 *
 * The minimum is the same number. Below it the battle console starts clipping the hand, which
 * `SettingsScreen`'s own text warns about for the text-scale steps; letting a player drag the
 * window there would produce the same damage with no warning at all.
 */
const WINDOW = { width: 1280, height: 800, minWidth: 1280, minHeight: 800 };

/** `userData/saves/<key>.json` — one file per key, which is one file per slot. See `readSave`. */
const savesDir = () => path.join(app.getPath('userData'), 'saves');

/**
 * `userData/run-logs/` — ticket 59's named directory.
 *
 * Henry's ask was literally *"turn this on and then when you're done send me the files from {file
 * location}"*, and the web build cannot honour it: `showDirectoryPicker` is Chrome/Edge only and its
 * permission does not reliably survive a session, so the browser build downloads instead. This is
 * where the named path becomes real. The path is printed in `desktop/README.md` because the tester
 * instruction quotes it.
 */
const runLogsDir = () => path.join(app.getPath('userData'), 'run-logs');

/**
 * A storage key as a file name.
 *
 * Every key the game uses is already `mingming_*` and safe, so this is a guard rather than a
 * translation — but a key reaching the filesystem is exactly the place not to assume that. `..` and
 * separators are what it exists to stop; anything else unusual becomes an underscore rather than
 * being rejected, because a save that refuses to write is worse than one with an odd file name.
 */
function fileFor(key) {
    const safe = String(key).replace(/[^a-zA-Z0-9_.-]/g, '_').replace(/^\.+/, '_');
    return path.join(savesDir(), `${safe}.json`);
}

function ensureDir(dir) {
    fs.mkdirSync(dir, { recursive: true });
}

/**
 * ATOMIC WRITE: a temp file in the same directory, then `rename`.
 *
 * `rename` within one filesystem is atomic on both targets, so a save is either the old one or the
 * new one and never a half-written file. That matters more here than in the browser: `localStorage`
 * commits a value whole, and a plain `writeFileSync` interrupted by a crash or a power cut leaves
 * truncated JSON that `SaveSystem`'s zod parse would reject — the player's run, gone, at exactly the
 * moment the game was trying hardest to keep it.
 *
 * The temp name carries the pid so two processes cannot collide on it.
 */
function writeAtomic(file, contents) {
    ensureDir(path.dirname(file));
    const temp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(temp, contents, 'utf8');
    fs.renameSync(temp, file);
}

// -------------------------------------------------------------------------------------------
// The synchronous bridge
// -------------------------------------------------------------------------------------------

/*
 * `sendSync`, and that is a deliberate choice rather than laziness.
 *
 * `engine/save/storage.ts` types the save backend as SYNCHRONOUS, and its header says why: an async
 * save API would leak into every reducer that touches persistence, and the autosave subscription in
 * `ui/store/store.ts` would have to become async with it. Node's `fs` has sync calls and Electron
 * has a sync channel, so the cost of keeping the seam sync is paid here — in a main process that is
 * doing nothing else — instead of in the game's state layer.
 *
 * The blocking is real and it is small: these are single JSON files of a few KB, written on a
 * save, not per frame.
 */
ipcMain.on('mingming:save-read', (event, key) => {
    try {
        event.returnValue = fs.readFileSync(fileFor(key), 'utf8');
    } catch {
        // Absent and unreadable are the same answer to "is there a save?" — the browser backend
        // makes the same choice, and `SaveSystem` is written against it.
        event.returnValue = null;
    }
});

ipcMain.on('mingming:save-write', (event, key, value) => {
    try {
        writeAtomic(fileFor(key), value);
        event.returnValue = { ok: true };
    } catch (error) {
        // Reported rather than swallowed: `SaveSystem` distinguishes a full disk from an
        // unavailable store, and ticket 04's failure banner depends on that distinction.
        event.returnValue = { ok: false, error: String(error && error.message ? error.message : error) };
    }
});

ipcMain.on('mingming:save-remove', (event, key) => {
    try {
        fs.rmSync(fileFor(key), { force: true });
    } catch {
        // Nothing to remove either way.
    }
    event.returnValue = { ok: true };
});

ipcMain.on('mingming:save-keys', (event) => {
    try {
        event.returnValue = fs.readdirSync(savesDir())
            .filter((name) => name.endsWith('.json'))
            .map((name) => name.slice(0, -'.json'.length));
    } catch {
        event.returnValue = [];
    }
});

/** Ticket 59: one transcript per run, written where the tester was told to look. */
ipcMain.on('mingming:write-run-log', (event, fileName, contents) => {
    try {
        const safe = String(fileName).replace(/[^a-zA-Z0-9_.-]/g, '_').replace(/^\.+/, '_');
        const dir = runLogsDir();
        ensureDir(dir);
        fs.writeFileSync(path.join(dir, safe), contents, 'utf8');
        event.returnValue = { ok: true, path: path.join(dir, safe) };
    } catch (error) {
        event.returnValue = { ok: false, error: String(error && error.message ? error.message : error) };
    }
});

/** So the settings screen can say "your run logs are HERE" with a path the player can open. */
ipcMain.on('mingming:paths', (event) => {
    event.returnValue = { userData: app.getPath('userData'), saves: savesDir(), runLogs: runLogsDir() };
});

/*
 * QUIT — the 2026-08-30 playtest. Henry: *"Only way to exit is the window X button."*
 *
 * It was: `autoHideMenuBar` hides the Electron menu that would otherwise carry File > Quit, and the
 * renderer had no way to ask. So the game had no exit of its own, which is the one control every
 * fullscreen game is expected to have — and on a Steam Deck, where F11 fullscreen is the normal way
 * to play, "close the window" is not a gesture the player has.
 *
 * `on` rather than a `handle`/`sendSync` pair like the save bridge above: there is no answer to
 * wait for. The renderer is not asking whether it may quit — the save is already on disk (every
 * `runSlice`/`gameSlice` change writes through `store.subscribe`), so there is nothing left to
 * flush and nothing this could usefully report back to a window that is about to stop existing.
 *
 * `app.quit()` rather than `win.close()`: closing the last window already quits (see
 * `window-all-closed`), but going through `app.quit()` means the same path runs whether the player
 * clicks this or the X, instead of two exits that could drift.
 */
ipcMain.on('mingming:quit', () => {
    app.quit();
});

ipcMain.on('mingming:reveal-run-logs', (event) => {
    ensureDir(runLogsDir());
    shell.openPath(runLogsDir());
    event.returnValue = { ok: true };
});

// -------------------------------------------------------------------------------------------
// The window
// -------------------------------------------------------------------------------------------

function createWindow() {
    const win = new BrowserWindow({
        ...WINDOW,
        show: false,
        backgroundColor: '#050508', // The app's own background, so the first frame is not white.
        autoHideMenuBar: true,      // It is a game; the Edit/View menu is noise.
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false, // The preload needs `require('electron')`; it reaches nothing else.
        },
    });

    // Shown on `ready-to-show` rather than immediately: otherwise the player watches an empty
    // frame for the ~400 ms the renderer takes to mount.
    win.once('ready-to-show', () => win.show());

    /*
     * F11 toggles fullscreen (ticket 37's requirement). Bound here rather than in the renderer
     * because the game's own keybind layer is a battle control surface — `ui/keybinds.ts` owns
     * 1-9, WER, ASD, Tab, Enter, Space — and a window-level control does not belong in it.
     */
    win.webContents.on('before-input-event', (event, input) => {
        if (input.type === 'keyDown' && input.key === 'F11') {
            win.setFullScreen(!win.isFullScreen());
            event.preventDefault();
        }
    });

    // A game that loads no remote content. Anything trying to open a new window is either a bug or
    // something unwelcome; send real links to the player's own browser instead.
    win.webContents.setWindowOpenHandler(({ url }) => {
        if (/^https?:/.test(url)) shell.openExternal(url);
        return { action: 'deny' };
    });

    win.loadFile(path.join(__dirname, 'app', 'index.html'));
    return win;
}

// One instance. A second copy of a game with file-backed saves is two processes writing the same
// slot, and the loser's run disappears without anything reporting it.
if (!app.requestSingleInstanceLock()) {
    app.quit();
} else {
    app.on('second-instance', () => {
        const [win] = BrowserWindow.getAllWindows();
        if (win) {
            if (win.isMinimized()) win.restore();
            win.focus();
        }
    });

    app.whenReady().then(() => {
        ensureDir(savesDir());
        createWindow();
        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) createWindow();
        });
    });

    // Windows and Linux only (Henry, 2026-08-28), so there is no macOS "stay alive with no windows"
    // case to honour.
    app.on('window-all-closed', () => app.quit());
}
