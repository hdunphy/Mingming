#!/usr/bin/env node
/**
 * `npm run balance:77` — ticket 77 Tracks B + C, the n=60 arms, as one RESUMABLE batch.
 *
 * # WHY A RUNNER AND NOT A LIST OF LINES
 *
 * Research/77 §B.2 printed the seventeen `balance:run-gate` lines and their cost (~18 h on Henry's
 * machine). A list that long is run over several evenings, and the two things that go wrong with
 * a hand-run list are the two things this script exists for: an arm re-run by accident (an hour
 * spent measuring a number already on disk), and an arm forgotten (the report has a hole). So each
 * arm writes to a fixed file under `research/77-runs/`, and an arm whose file already carries the
 * closing `wall clock` line is skipped. Kill it, restart it, it continues.
 *
 * Node rather than shell for the reason `desktop-build.mjs` gives: Henry is on Windows.
 *
 * # THE ORDER IS THE REVIEW'S ORDER (research/77-what-the-player-side-asks-of-the-design.md, REVIEW)
 *
 * 1. the day's bare rows, both gyms — every arm below is paired against these and nothing else;
 * 2. the A3 re-take (bare + 3 blanks), both gyms — Track A's deck-size tax predates ~50 commits;
 * 3. C1 and C3, the Rootfall boss cell, with the Driver-off boss cell as the far bound;
 * 4. B2 — antivenom / tenth_strike / the favourable arm's element Driver, both gyms;
 * 5. B1a / B1b — the macro rack, both gyms. **The rack is per CELL** (three per fight, not three per
 *    gauntlet), so B1's compound is a CEILING; the boss cell alone reads as "three macros brought to
 *    the boss", which is the per-run number for a player who saved them. See `macroPolicy.ts`.
 *
 * Usage:
 *   npm run balance:77                 everything, in order, skipping finished arms
 *   npm run balance:77 -- --only C1,C3   a comma list of arm names (see ARMS below)
 *   npm run balance:77 -- --list         print the arms and whether each is done
 *   npm run balance:77 -- --lanes 2      run two arms at once (one per core you can spare)
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// A3's re-take is suffixed so Track A's original 2026-09-02 reports (same names) survive beside it.
const OUT_DIR = path.join('docs', 'wayfinder', 'steam-release', 'research', '77-runs');
const COMMON = ['--bands', 'gauntlet', '--matchup', 'favourable', '--iterations', '60'];
const BOSS = ['--cells', 'gauntlet:fight2', '--gym', 'gym_rootfall'];

/** name -> the flags that make the arm. `BC-` prefixes the bare rows this batch is paired against. */
const ARMS = [
    ['BC-BARE-rootfall', ['--gym', 'gym_rootfall']],
    ['BC-BARE-emberfall', ['--gym', 'gym_emberfall']],
    ['A3-rootfall-blanks.retake-n60', ['--gym', 'gym_rootfall', '--deck', 'bare-plus-generics']],
    ['A3-emberfall-blanks.retake-n60', ['--gym', 'gym_emberfall', '--deck', 'bare-plus-generics']],
    ['C1-rootfall-boss', [...BOSS, '--tweak', 'root-rot-c1']],
    ['C3-rootfall-boss', [...BOSS, '--tweak', 'root-rot-c3']],
    ['C-OFF-rootfall-boss', [...BOSS, '--boss-driver', 'off']],
    ['B2-rootfall-antivenom', ['--gym', 'gym_rootfall', '--player-driver', 'driver_antivenom']],
    ['B2-emberfall-antivenom', ['--gym', 'gym_emberfall', '--player-driver', 'driver_antivenom']],
    ['B2-rootfall-tenth', ['--gym', 'gym_rootfall', '--player-driver', 'driver_tenth_strike']],
    ['B2-emberfall-tenth', ['--gym', 'gym_emberfall', '--player-driver', 'driver_tenth_strike']],
    ['B2-rootfall-fire', ['--gym', 'gym_rootfall', '--player-driver', 'driver_element_fire']],
    ['B2-emberfall-water', ['--gym', 'gym_emberfall', '--player-driver', 'driver_element_water']],
    ['B1a-rootfall-surge3', ['--gym', 'gym_rootfall', '--macros', 'surge3']],
    ['B1b-rootfall-mixed', ['--gym', 'gym_rootfall', '--macros', 'mixed']],
    ['B1a-emberfall-surge3', ['--gym', 'gym_emberfall', '--macros', 'surge3']],
    ['B1b-emberfall-mixed', ['--gym', 'gym_emberfall', '--macros', 'mixed']],
];

const argv = process.argv.slice(2);
const flag = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const only = flag('--only')?.split(',').map((s) => s.trim()).filter(Boolean);
const lanes = Math.max(1, Number(flag('--lanes') ?? 1));

const outFile = (name) => path.join(OUT_DIR, `${name}.txt`);
const isDone = (name) => fs.existsSync(outFile(name)) && fs.readFileSync(outFile(name), 'utf8').includes('wall clock');

if (argv.includes('--list')) {
    for (const [name] of ARMS) console.log(`${isDone(name) ? 'DONE   ' : 'pending'}  ${name}`);
    process.exit(0);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const queue = ARMS.filter(([name]) => (only ? only.includes(name) : true));
for (const wanted of only ?? []) {
    if (!ARMS.some(([name]) => name === wanted)) {
        console.error(`[balance:77] unknown arm "${wanted}". Known: ${ARMS.map(([n]) => n).join(', ')}`);
        process.exit(1);
    }
}

const runOne = ([name, args]) => new Promise((resolve) => {
    if (isDone(name)) { console.log(`[balance:77] skip ${name} — already finished`); resolve(0); return; }
    console.log(`[balance:77] ${new Date().toISOString()} start ${name}`);
    const child = spawn(
        process.platform === 'win32' ? 'npx.cmd' : 'npx',
        ['vite-node', 'src/debug/balance/runRunGate.ts', ...COMMON, ...args, '--out', outFile(name)],
        { stdio: ['ignore', 'ignore', 'inherit'], shell: process.platform === 'win32' },
    );
    child.on('exit', (code) => {
        console.log(`[balance:77] ${new Date().toISOString()} end   ${name} exit=${code}`);
        resolve(code ?? 1);
    });
});

let failures = 0;
const workers = Array.from({ length: lanes }, async () => {
    for (;;) {
        const next = queue.shift();
        if (!next) return;
        if ((await runOne(next)) !== 0) failures += 1;
    }
});
await Promise.all(workers);
console.log(`[balance:77] batch complete${failures ? ` — ${failures} arm(s) exited non-zero, re-run to resume` : ''}.`);
process.exitCode = failures ? 1 : 0;
