#!/usr/bin/env node
/**
 * Post-build gate for the debug toolkit.
 *
 * `src/debug/DebugRoot.tsx` is the single import edge between the game and the toolkit, and
 * App.tsx reaches it only through `import.meta.env.DEV ? lazy(() => import('./debug/DebugRoot')) : null`.
 * In a production build Vite replaces the flag with `false`, the ternary folds to `null`, the
 * dynamic import becomes unreachable, and Rollup never emits the chunk.
 *
 * This script proves that actually happened: DebugRoot exports a marker string, and if that
 * marker turns up anywhere under `dist/` then some non-gated import edge dragged the toolkit
 * into the shipped bundle. Exits non-zero so `npm run build` fails.
 *
 * The marker is assembled from fragments so this file never contains the literal itself —
 * otherwise the script would flag itself if it were ever copied into the output directory.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MARKER = ['__DEBUG', 'TOOLKIT__'].join('_');

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '..');
const distDir = resolve(projectRoot, 'dist');

function walk(dir) {
    const out = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
            out.push(...walk(full));
        } else if (entry.isFile()) {
            out.push(full);
        }
    }
    return out;
}

let distStat;
try {
    distStat = statSync(distDir);
} catch {
    console.error(`[assert-no-debug] FAIL: no build output at ${distDir}. Run \`vite build\` first.`);
    process.exit(1);
}

if (!distStat.isDirectory()) {
    console.error(`[assert-no-debug] FAIL: ${distDir} is not a directory.`);
    process.exit(1);
}

const files = walk(distDir);
const offenders = [];

for (const file of files) {
    // Read as a buffer so binary assets are scanned too without decoding cost.
    if (readFileSync(file).includes(MARKER)) {
        offenders.push(relative(projectRoot, file));
    }
}

if (offenders.length > 0) {
    console.error(`[assert-no-debug] FAIL: debug toolkit marker "${MARKER}" found in the build output.`);
    console.error('Something outside src/debug/ imports into it without the import.meta.env.DEV gate.');
    for (const offender of offenders) {
        console.error(`  - ${offender}`);
    }
    process.exit(1);
}

console.log(`[assert-no-debug] OK: ${files.length} file(s) in dist/, no debug toolkit marker.`);
