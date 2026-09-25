#!/usr/bin/env node
/**
 * `npm run release-check` — the one command ticket 52's launch checklist calls.
 *
 * Ticket 40's deliverable: *"a `npm run release-check` script that runs everything plus
 * `assert-no-debug`, prints asset weight, and fails on any `console.error` during a scripted smoke
 * run."*
 *
 * # IT ORCHESTRATES, IT DOES NOT RE-IMPLEMENT
 *
 * Every gate below already exists and already runs somewhere. What did not exist was a single
 * entry point that runs all of them in the order a release needs and reports what shipped, so this
 * file is deliberately thin: it shells out to the same commands CI runs, in the same order, and
 * adds exactly two things CI does not have — **the asset-weight report** and **a single verdict**.
 *
 * Two of the ticket's four asks turned out to be already met, and re-implementing them would have
 * been the wrong move:
 *
 *  - **`assert-no-debug`** is the tail of `npm run build` (with `assert-sfx`), so it is covered by
 *    running the build rather than by a second call.
 *  - **The console.error smoke gate is already standing.** `src/testing/interaction.tsx` spies on
 *    `console.error` and fails any test that triggers one unless it opts out, and
 *    `src/App.loop.test.tsx` drives the whole loop click by click through that harness — starter
 *    pick, assembly, gym offer, region map, a card played, END TURN, rewards, an elite and its
 *    Driver. That IS the scripted smoke run, it is in `vitest run`, and it therefore already runs
 *    on every push. Writing a second one here would have been a worse copy that drifts.
 *
 * So what this adds is the asset weight and the verdict. A release-checklist script whose value is
 * "it exists and returns one number" is the right size for this job.
 *
 * # WHY THE LONG BALANCE RUN IS NOT HERE
 *
 * `npm run balance` is ~11 minutes and `npm run balance:drivers` is **~2.7 hours** (measured: 91
 * seconds for a single 3v3 battle at beam 8 with `AI_LITE`, and the default scope is 108 of them).
 * Ticket 40 rules those manual/nightly, and the measurement is why. `npm run canary:short` is the
 * cheap structural gate that CI runs instead — see its own note in `package.json`.
 *
 * Exit code is the point: 0 only if every gate passed.
 */

import { execSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** The gates, in the order a release needs them: cheapest signal first, build last. */
const GATES = [
    { name: 'typecheck', cmd: 'npx tsc -b' },
    { name: 'tests (incl. preview-parity + the console.error smoke walk)', cmd: 'npx vitest run' },
    { name: 'lint', cmd: 'npm run lint' },
    { name: 'build (ends in assert-no-debug + assert-sfx)', cmd: 'npm run build' },
];

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

/** Every file under a directory, recursively, as [path, bytes]. */
function walk(dir) {
    const out = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) out.push(...walk(full));
        else if (entry.isFile()) out.push([full, statSync(full).size]);
    }
    return out;
}

/**
 * What actually ships, by extension and then the ten heaviest files.
 *
 * Printed rather than gated. A budget would be a number nobody has ruled on, and ticket 40 asks for
 * the report; ticket 39 owns the performance targets. `assert-sfx` already gates the one asset
 * class that HAS a ruled budget (60 KB per cue).
 */
function assetWeight() {
    const dist = join(root, 'dist');
    if (!existsSync(dist)) {
        console.error('[release-check] no dist/ to weigh — the build gate should have produced one.');
        return false;
    }
    const files = walk(dist);
    const total = files.reduce((n, [, size]) => n + size, 0);

    const byExt = new Map();
    for (const [path, size] of files) {
        const ext = extname(path) || '(none)';
        const row = byExt.get(ext) ?? { n: 0, bytes: 0 };
        row.n += 1;
        row.bytes += size;
        byExt.set(ext, row);
    }

    console.log(`\n  ASSET WEIGHT — ${files.length} files, ${kb(total)} total\n`);
    console.log(`    ${'ext'.padEnd(10)}${'files'.padStart(6)}${'bytes'.padStart(12)}   share`);
    for (const [ext, row] of [...byExt].sort((a, b) => b[1].bytes - a[1].bytes)) {
        console.log(`    ${ext.padEnd(10)}${String(row.n).padStart(6)}${kb(row.bytes).padStart(12)}   ${((100 * row.bytes) / total).toFixed(1)}%`);
    }
    console.log('\n    heaviest files');
    for (const [path, size] of files.sort((a, b) => b[1] - a[1]).slice(0, 10)) {
        console.log(`      ${kb(size).padStart(10)}  ${path.slice(root.length + 1)}`);
    }
    return true;
}

console.log('[release-check] ticket 40 — every standing gate, then what ships.\n');
const failures = [];
for (const gate of GATES) {
    const started = Date.now();
    process.stdout.write(`[release-check] ${gate.name} ... `);
    try {
        execSync(gate.cmd, { cwd: root, stdio: 'pipe' });
        console.log(`PASS  ${((Date.now() - started) / 1000).toFixed(0)}s`);
    } catch (error) {
        console.log(`FAIL  ${((Date.now() - started) / 1000).toFixed(0)}s`);
        // The gate's own output is the diagnosis, so it is printed rather than summarised.
        const out = `${error.stdout ?? ''}${error.stderr ?? ''}`;
        console.error(out.toString().split('\n').slice(-40).join('\n'));
        failures.push(gate.name);
    }
}

if (!assetWeight()) failures.push('asset weight');

console.log('');
if (failures.length > 0) {
    console.error(`[release-check] FAILED — ${failures.length} gate(s): ${failures.join(', ')}`);
    process.exit(1);
}
console.log('[release-check] all gates PASSED. `npm run balance` and `npm run balance:drivers` are the nightly pair and are NOT in this run.');
