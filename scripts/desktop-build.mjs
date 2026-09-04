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

/*
 * EVERY CHILD PROCESS HERE IS `node <a .js file>`, AND THAT IS THE FIX FOR A REAL BUG.
 *
 * The first version of this script called `npx`/`npm`, spelled `npx.cmd` on Windows because they
 * are batch shims there. That is not enough, and it failed on Henry's machine with:
 *
 *     Error: spawnSync npx.cmd EINVAL
 *
 * **Node 20+ refuses to `execFile` a `.bat`/`.cmd` file at all** unless `shell: true` is passed —
 * the fix for CVE-2024-27980, where arguments could break out of a batch shim into the command
 * line. So the two ways forward are `shell: true` (which reintroduces quoting problems the moment
 * a path contains a space, and Henry's repo lives under `C:\Users\...\GitHub\Mingming`) or not
 * using the shims at all.
 *
 * Not using them is strictly better. `vite` and `electron-builder` are both plain Node CLIs
 * sitting in `node_modules`; running them as `process.execPath <bin.js>` skips the shim, the shell
 * and the PATH lookup in one go, and behaves identically on both platforms. For `npm install`
 * there is no such file to point at — but npm sets **`npm_execpath`** to its own `npm-cli.js` when
 * it runs a script, and this script is only ever run through `npm run desktop:build`.
 */
function nodeRun(script, scriptArgs, options = {}) {
    console.log(`\n> node ${path.relative(ROOT, script)} ${scriptArgs.join(' ')}`);
    execFileSync(process.execPath, [script, ...scriptArgs], { stdio: 'inherit', cwd: ROOT, ...options });
}

/** A CLI's entry script inside a `node_modules`, or a clear failure naming what to install. */
function binOf(packageDir, relative, hint) {
    const file = path.join(packageDir, relative);
    if (!fs.existsSync(file)) {
        console.error(`\nMissing ${file}\n${hint}`);
        process.exit(1);
    }
    return file;
}

// --- 1. the web build, with the desktop base ------------------------------------------------
if (!has('--skip-web')) {
    const vite = binOf(path.join(ROOT, 'node_modules', 'vite'), 'bin/vite.js', 'Run `npm install` in the repo root.');
    nodeRun(vite, ['build'], { env: { ...process.env, MINGMING_DESKTOP: '1' } });
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
const builderDir = path.join(DESKTOP, 'node_modules', 'electron-builder');
if (!fs.existsSync(builderDir)) {
    console.log('\n> desktop/node_modules is missing electron-builder; installing (this downloads Electron)');
    // `npm_execpath` is npm's own `npm-cli.js`, set by npm for every script it runs — so this is
    // the same npm that launched us, invoked as a plain Node script rather than through the shim.
    const npmCli = process.env.npm_execpath;
    if (!npmCli || !npmCli.endsWith('.js')) {
        console.error('\nCannot locate npm. Run this through `npm run desktop:build`, or install the');
        console.error(`desktop dependencies yourself:  cd ${DESKTOP} && npm install`);
        process.exit(1);
    }
    nodeRun(npmCli, ['install'], { cwd: DESKTOP });
}

/*
 * A word on the `--`, because it is a trap npm sets rather than one this script sets.
 *
 * `npm run desktop:build -- --win` passes the flag. `npm run desktop:build --win` does NOT: npm
 * eats `--win` as one of its own config options, warns about it in a line that scrolls past, and
 * runs this script with **no arguments at all** — which silently builds both targets instead of
 * the one that was asked for. So when no target flag arrives, say what is about to happen and how
 * to have asked for less, rather than quietly doing the expensive thing.
 */
const targets = has('--dir')
    ? ['--linux', 'dir']
    : has('--linux')
      ? ['--linux']
      : has('--win')
        ? ['--win']
        : ['--win', '--linux'];

if (targets.length === 2 && targets[0] === '--win') {
    console.log('\n> no target given — building BOTH Windows and Linux.');
    console.log('  For one, note the `--`:  npm run desktop:build -- --win');
}

const builder = binOf(builderDir, 'cli.js', `Run \`npm install\` in ${DESKTOP}.`);
nodeRun(builder, targets, { cwd: DESKTOP });

console.log(`\nDone. Artefacts are in ${path.join(DESKTOP, 'release')}`);
