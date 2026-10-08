/**
 * THE SAVES FOLDER, PINNED — ticket 188a.
 *
 * Electron keeps a desktop game's saves under `app.getPath('userData')`, and by default that is
 * `<appData>/<app name>`. Until ticket 188 the app name was `Mingming` (`productName` in
 * `desktop/package.json`; Electron prefers `productName` over `name`), so every save and run log
 * written so far lives in:
 *
 *   Windows  %APPDATA%\Mingming          (C:\Users\<you>\AppData\Roaming\Mingming)
 *   Linux    ~/.config/Mingming
 *
 * Ticket 188b renames the product to "Mingming Midgard Circuit". Left alone, Electron would then
 * look in a new, empty `...\Mingming Midgard Circuit` folder and the player's runs and ranch would
 * appear to be gone. So `main.cjs` sets `userData` to this folder explicitly, before anything reads
 * it, and the app can be renamed freely.
 *
 * Kept as a tiny pure module (a function of the app-data directory and nothing else) so the one
 * thing that must never change can be tested without launching Electron. The test is
 * `src/desktop/savesFolder.test.ts`.
 *
 * **Do not "fix" this to follow the product name.** That is exactly the change that orphans saves.
 */

const path = require('node:path');

/** The folder name the app has used since ticket 42. Never change it. */
const LEGACY_APP_FOLDER = 'Mingming';

/** The user-data folder for a given app-data directory (`app.getPath('appData')`). */
function userDataFolder(appDataDir) {
    return path.join(appDataDir, LEGACY_APP_FOLDER);
}

module.exports = { LEGACY_APP_FOLDER, userDataFolder };
