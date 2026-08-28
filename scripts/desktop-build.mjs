#!/usr/bin/env node
/**
 * `npm run desktop:build` — ticket 42.
 *
 * # WHY THIS IS A NODE SCRIPT AND NOT A LINE OF SHELL
 *
 * The obvious spelling is `MINGMING_DESKTOP=1 vite build && cp -r dist desktop/app && ...`, and it
 * does not run on the machine that has to run it: Henry develops on **Windows**, where
 * `VAR=1 cmd` is a syntax error in both cmd.exe and PowerShell and `cp -r` does not exist. The
 * repo already keeps its build helpers as `scripts/*.mjs` (`assert-no-debug`, `screenshots`) for
 * the same reason, so this follows that convention rather than adding a `cross-env` dependency for
 * one variable.
 *
 * # THE THREE STEPS
 *
 * 1. `vite build` with `MINGMING_DESKTOP=1`, which is the ONLY thing that flag changes: `base`
 *    becomes `'./'` so assets resolve under `file://`. See `vite.config.ts`.
 * 2. Copy `dist/` to `desktop/app/`, replacing it. Copied rather than symlinked or configured as
 *    an out-dir because `electron-builder`'s `files` globs are rooted at `desktop/` and a build
 *    that reaches outside its own package root is one that breaks the first time it is run from
 *    somewhere else.
 * 3. `electron-builder` in `desktop/`, installing its dev dependencies first if they are missing.
 *
 * # WHY `electron` IS NOT IN THE ROOT `package.json`
 *
 * It is ~250 MB of downloaded binary. Every CI run of `tsc`/`vitest`/`eslint` would pay for it,
 * and none of them touch it. `desktop/` is its own npm project, installed on demand by step 3 and
 * only by people building the desktop app.
 *
 * Usage:
 *   npm run desktop:build            both targets (Windows + Linux)
 *   npm run desktop:build -- --linux Linux only
 *   npm run desktop:build -- --win   Windows only
 *   npm run desktop:build -- --dir   unpacked Linux directory (fastest; what CI-style checks use)
 *   npm run desktop:build -- --skip-web   reuse the dist/ that is already there
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DESKTOP = path.join(ROOT, 'desktop');
const APP_DIR = path.join(DESKTOP, 'app');
const DIST = path.join(ROOT, 'dist');

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);

/** `npm`/`npx` are `.cmd` shims on Windows, which `execFile` will not run without the extension. */
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function run(cmd, cmdArgs, options = {}) {
    console.log(`\n> ${cmd} ${cmdArgs.join(' ')}`);
    execFileSync(cmd, cmdArgs, { stdio: 'inherit', cwd: ROOT, ...options });
}

// --- 1. the web build, with the desktop base ------------------------------------------------
if (!has('--skip-web')) {
    run(npxCmd, ['vite', 'build'], { env: { ...process.env, MINGMING_DESKTOP: '1' } });
} else {
    console.log('\n> skipping vite build (--skip-web)');
}

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    console.error(`\nNo build at ${DIST}. Run without --skip-web.`);
    process.exit(1);
}

/*
 * A guard, not a formality. `base` is set from an environment variable, so a `dist/` left over from
 * `npm run build` looks identical to a desktop one at the directory level and produces a window
 * that opens BLANK with nothing in any log — ticket 26 lost time to exactly this. The built
 * `index.html` records the answer: `./assets/...` is a desktop build, `/Mingming/assets/...` is not.
 */
const indexHtml = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
if (indexHtml.includes('"/Mingming/')) {
    console.error(`\n${path.join(DIST, 'index.html')} has absolute /Mingming/ asset paths — that is the`);
    console.error('WEB build, and it renders an empty window under file://. Rebuild without --skip-web.');
    process.exit(1);
}

// --- 2. dist -> desktop/app ------------------------------------------------------------------
fs.rmSync(APP_DIR, { recursive: true, force: true });
fs.cpSync(DIST, APP_DIR, { recursive: true });
console.log(`\n> copied dist/ -> desktop/app/`);

// --- 3. package ------------------------------------------------------------------------------
if (!fs.existsSync(path.join(DESKTOP, 'node_modules', 'electron-builder'))) {
    console.log('\n> desktop/node_modules is missing electron-builder; installing (this downloads Electron)');
    run(npmCmd, ['install'], { cwd: DESKTOP });
}

const targets = has('--dir')
    ? ['--linux', 'dir']
    : has('--linux')
      ? ['--linux']
      : has('--win')
        ? ['--win']
        : ['--win', '--linux'];

run(npxCmd, ['electron-builder', ...targets], { cwd: DESKTOP });

console.log(`\nDone. Artefacts are in ${path.join(DESKTOP, 'release')}`);
