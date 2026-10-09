/**
 * TICKET 188a: the desktop saves folder is pinned to the name it has had since ticket 42.
 *
 * `desktop/` has no test runner of its own, so this lives where the main vitest run reaches it and
 * loads the CommonJS module through `createRequire`.
 *
 * The folder was `<appData>/Mingming` because Electron derives it from the app name, and the app
 * name came from `productName: "Mingming"`. Ticket 188b renames the product, which would silently
 * move the folder (and make Henry's runs and ranch look gone). These tests hold the folder still.
 */
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

interface SavesFolderModule {
    LEGACY_APP_FOLDER: string;
    userDataFolder: (appDataDir: string) => string;
}

const require = createRequire(import.meta.url);
const { LEGACY_APP_FOLDER, userDataFolder } = require('../../desktop/savesFolder.cjs') as SavesFolderModule;

describe('desktop saves folder (ticket 188a)', () => {
    it('the pinned name is the one the app has today, Mingming', () => {
        expect(LEGACY_APP_FOLDER).toBe('Mingming');
    });

    it('on Windows-style app data it ends in the Mingming folder under Roaming', () => {
        const folder = userDataFolder('C:\\Users\\x\\AppData\\Roaming');
        expect(folder.replace(/\\/g, '/')).toMatch(/AppData\/Roaming\/Mingming$/);
    });

    it('on Linux-style app data it ends in the Mingming folder under .config', () => {
        expect(userDataFolder('/home/x/.config').replace(/\\/g, '/')).toMatch(/\.config\/Mingming$/);
    });

    it('never contains Midgard, so the rename cannot move it', () => {
        expect(userDataFolder('C:\\Users\\x\\AppData\\Roaming')).not.toContain('Midgard');
        expect(userDataFolder('/home/x/.config')).not.toContain('Midgard');
    });

    it('is a function of the app-data directory alone, so productName cannot reach it', () => {
        // One argument and no other input: nothing here can read package.json or the app name.
        expect(userDataFolder.length).toBe(1);
    });
});
