import { defineConfig, configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

/*
 * TICKET 42: `base` is the ONE build difference between the web app and the desktop one, and ticket
 * 26's spike found it by producing a blank window.
 *
 * GitHub Pages serves the game from `/Mingming/`, so an absolute base is correct there. Electron
 * loads `index.html` over `file://`, where `/Mingming/assets/index-*.js` resolves against the
 * FILESYSTEM ROOT and 404s — React never mounts and the window is empty with no error a player
 * could report.
 *
 * `'./'` works for both: relative asset URLs resolve under the Pages sub-path and under a file URL.
 * It is nevertheless switched rather than simply changed, because Pages is the live build and this
 * ticket is not the place to move it — `npm run desktop:build` sets the flag, everything else keeps
 * the base it has always had.
 *
 * The config runs in Node, so this `process.env` read is real. The `define` below substitutes
 * `process.env` inside the APP bundle only, which is a different thing entirely — see its comment.
 */
const DESKTOP = process.env.MINGMING_DESKTOP === '1'

/*
 * TICKET 181a: the build label and the commit are baked in at build time so a tester's bug report
 * can name the build it came from. `VITE_BUILD_LABEL` unset reads `dev`; no git (a tarball, a
 * stripped CI checkout) reads `unknown`. The deploy workflow sets the label from `PLAYTEST_LABEL`.
 */
const BUILD_LABEL = process.env.VITE_BUILD_LABEL?.trim() || 'dev'

/*
 * TICKET 181e: the game's version, `major.minor.patch`. `package.json` is the only place it is
 * written; a release bumps it (`npm version minor --no-git-tag-version`) and the deploy publishes
 * only when the tag `v<version>` does not exist yet.
 */
const GAME_VERSION: string = (JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }).version

function buildCommit(): string {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || 'unknown'
  } catch {
    return 'unknown'
  }
}

export default defineConfig({
  base: DESKTOP ? './' : '/Mingming/',
  plugins: [react()],
  test: {
    /*
     * Scratch folders are gitignored working space (tarballs, copied sources, archived scripts) and
     * can hold stale `*.test.ts` copies whose relative imports no longer resolve - `npm test` / `npm run gate`
     * then fail on a file that is not part of the repo. ESLint already ignores `.claude` and
     * `_scratch_balance`; the test runner has to as well.
     */
    exclude: [...configDefaults.exclude, '_scratch_balance/**', '.claude/**'],
  },
  define: {
    // The app bundle has no Node environment. Substituting `{}` keeps a stray `process.env.X` read
    // from throwing in the browser — and is why every debug CLI in this repo takes flags rather
    // than environment variables.
    'process.env': {},
    // Ticket 181a. Read through `src/ui/buildInfo.ts`, which supplies the defaults.
    __BUILD_LABEL__: JSON.stringify(BUILD_LABEL),
    __BUILD_COMMIT__: JSON.stringify(buildCommit()),
    // Ticket 181e. Read through `src/ui/buildInfo.ts` as well.
    __GAME_VERSION__: JSON.stringify(GAME_VERSION),
  },
})
