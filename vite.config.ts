import { defineConfig, configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

/*
 * TICKET 42, then TICKET 181d: `base`.
 *
 * Ticket 42 found that Electron loads `index.html` over `file://`, where an absolute
 * `/Mingming/assets/index-*.js` resolves against the FILESYSTEM ROOT and 404s: React never mounts and
 * the window is empty with no error a player could report. So the desktop build used `'./'`, while
 * the web build kept `/Mingming/`, the GitHub Pages sub-path.
 *
 * Ticket 181d moved the web build to a restricted itch.io page, which serves the game from its own
 * CDN folder, so an absolute base is wrong there too. Every BUILD now uses `'./'`: relative asset
 * URLs resolve under itch's folder, under a file URL and under any sub-path. `MINGMING_DESKTOP` is
 * no longer read here (`npm run desktop:build` still sets it, harmlessly). Anything built from
 * `import.meta.env.BASE_URL` (the sound samples) follows the base and keeps working.
 * `scripts/assert-relative-base.mjs` fails `npm run build` if `dist/index.html` loads anything from
 * an absolute path.
 *
 * The dev server and `vite preview` (command `serve`) keep `/Mingming/`, so the debug sheets' URLs
 * and the screenshot scripts that open `localhost:<port>/Mingming/...` are unchanged.
 *
 * The config runs in Node, so `process.env` reads in this file are real. The `define` below
 * substitutes `process.env` inside the APP bundle only, which is a different thing entirely — see
 * its comment.
 */

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

export default defineConfig(({ command }) => ({
  base: command === 'build' ? './' : '/Mingming/',
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
}))
