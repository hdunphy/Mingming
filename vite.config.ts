import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

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

export default defineConfig({
  base: DESKTOP ? './' : '/Mingming/',
  plugins: [react()],
  define: {
    // The app bundle has no Node environment. Substituting `{}` keeps a stray `process.env.X` read
    // from throwing in the browser — and is why every debug CLI in this repo takes flags rather
    // than environment variables.
    'process.env': {},
  },
})
