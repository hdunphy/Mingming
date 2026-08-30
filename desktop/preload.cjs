/**
 * THE PRELOAD BRIDGE — ticket 42.
 *
 * The renderer runs with `contextIsolation: true` and `nodeIntegration: false`, so it cannot see
 * `fs`, `path` or `ipcRenderer`. This file is the only thing that can, and it hands the game a
 * **named, closed set of functions** — not a channel, not `ipcRenderer` itself.
 *
 * That distinction is the whole point of the file. Exposing `ipcRenderer` would let any code in the
 * renderer send any message on any channel, which is the same as having no isolation at all; a
 * fixed surface means the worst a compromised renderer can do is what the game itself can do —
 * read and write its own save files.
 *
 * # THE SHAPE IS `engine/save/storage.ts`'s, ON PURPOSE
 *
 * `read` / `write` / `remove` / `keys` are that module's `ISaveStorage` interface exactly, so the
 * desktop backend on the other side is a thin adapter rather than a translation layer. Ticket 23
 * cut that seam ahead of time for this reason: the whole desktop save port is one small class.
 *
 * # WHY `sendSync`
 *
 * `ISaveStorage` is synchronous and its header explains why — an async save API would leak into
 * every reducer that touches persistence. Sync IPC is what lets that stay true. It blocks the
 * renderer for the length of one small file read, on a save rather than per frame.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mingmingDesktop', {
    /** Marks the build. `installDesktopSaveStorage` tests for this and nothing else. */
    isDesktop: true,

    // --- saves, mirroring ISaveStorage -------------------------------------------------------
    read: (key) => ipcRenderer.sendSync('mingming:save-read', key),
    /** Returns `{ ok }` rather than throwing across the bridge — the adapter turns it into a throw. */
    write: (key, value) => ipcRenderer.sendSync('mingming:save-write', key, value),
    remove: (key) => ipcRenderer.sendSync('mingming:save-remove', key),
    keys: () => ipcRenderer.sendSync('mingming:save-keys'),

    // --- ticket 59's run logs ----------------------------------------------------------------
    writeRunLog: (fileName, contents) => ipcRenderer.sendSync('mingming:write-run-log', fileName, contents),
    /** So the settings screen can show the player the real path, and open it. */
    paths: () => ipcRenderer.sendSync('mingming:paths'),
    revealRunLogs: () => ipcRenderer.sendSync('mingming:reveal-run-logs'),

    // --- ticket 42 follow-up (2026-08-30 playtest): the way out ------------------------------
    /**
     * Quit the game. `send`, not `sendSync` — nothing comes back from a process that is exiting,
     * and blocking the renderer on it would be waiting for an answer that cannot arrive.
     *
     * Adding a verb to this surface is the thing the header warns about, so it is worth saying why
     * this one is safe: quitting is something the player can already do from the window chrome at
     * any moment, and the save is written on every state change rather than at exit. This makes an
     * existing, always-available action reachable from inside the game; it grants no new power.
     */
    quit: () => ipcRenderer.send('mingming:quit'),
});
