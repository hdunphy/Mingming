/**
 * `npm run balance:drivers` — the Driver compounding canary, steam-release ticket 16.
 *
 *     npm run balance:drivers                                  # every arm, the six-matchup ring, n=12/arm
 *     npm run balance:drivers -- --arms driver_static_field    # one arm (comma-separated for several)
 *     npm run balance:drivers -- --iterations 3                # more seeds per matchup
 *     npm run balance:drivers -- --full                        # the thirty-pair round-robin (hours)
 *     npm run balance:drivers -- --beam 8 --out canary.txt     # screening beam; append the report per line
 *
 * Screening fidelity is `AI_LITE=1` in the environment plus `--beam 8` — ticket 109's own
 * screening opt-ins, set per run and never globally. Anything reported as a FINDING confirms at
 * full, beamless lookahead, which is the binding 108 rule and is Henry's machine's job.
 *
 * REPORT-ONLY, exits 0. The canary flags; Henry rules.
 *
 * `--out` appends per line, for ticket 70's reason: Node block-buffers stdout to a pipe, so a run
 * killed at battle 80 of 108 with `> file.txt` leaves an empty file. With `--out` it leaves 80 lines.
 */

import fs from 'node:fs';

import { CANARY_ARMS, CANARY_MAX_TURNS, armName, measureDriverCanary, type ArmSummary } from './driverCanary';
import { REFERENCE_PANEL } from './teamComps';

function flag(name: string, fallback: string): string {
    const i = process.argv.indexOf(`--${name}`);
    const v = i >= 0 ? process.argv[i + 1] : undefined;
    return v === undefined || v.startsWith('--') ? fallback : v;
}

const pct = (x: number) => `${(100 * x).toFixed(1)}%`;

function main(): void {
    const iterations = Number.parseInt(flag('iterations', '1'), 10);
    const maxTurns = Number.parseInt(flag('max-turns', String(CANARY_MAX_TURNS)), 10);
    const full = process.argv.includes('--full');
    const beam = flag('beam', '');
    const aiBeam = beam === '' ? undefined : Number.parseInt(beam, 10);
    const armsFlag = flag('arms', '');
    const arms = armsFlag ? armsFlag.split(',').map(s => s.trim()).filter(Boolean) : [...CANARY_ARMS];
    const out = flag('out', '');
    const unknown = arms.filter(a => !CANARY_ARMS.includes(a));
    if (unknown.length) {
        console.error(`unknown arm(s): ${unknown.join(', ')} — pick from ${CANARY_ARMS.join(', ')}`);
        process.exit(1);
    }

    if (out) fs.writeFileSync(out, '');
    const say = (line = ''): void => {
        console.log(line);
        if (out) fs.appendFileSync(out, `${line}\n`);
    };

    const matchups = full ? REFERENCE_PANEL.length * (REFERENCE_PANEL.length - 1) : REFERENCE_PANEL.length;
    const perArm = matchups * iterations * 2;
    say('[balance:drivers] Ticket 16 — the Driver compounding canary. Report-only.');
    say(`[balance:drivers]   population  ${full ? 'REFERENCE_PANEL round-robin' : 'REFERENCE_PANEL ring (each comp vs the next)'}: ${matchups} matchups x ${iterations} seeds x 2 orders = ${perArm} battles/arm`);
    say(`[balance:drivers]   arms        bare + ${arms.length}: ${arms.join(', ')}`);
    say(`[balance:drivers]   fidelity    beam ${aiBeam ?? 'off (process default)'}; AI_LITE is read from the environment`);
    say(`[balance:drivers]   maxTurns    ${maxTurns}   (standalone 3v3s — NOT a run)`);
    say();

    const started = Date.now();
    const report = measureDriverCanary({
        arms, iterations, maxTurns, full, aiBeam,
        onBattle: (arm, label, done, total) => {
            const elapsed = Math.round((Date.now() - started) / 1000);
            say(`[balance:drivers]   ${arm.padEnd(26)} ${String(done).padStart(3)}/${total}  ${label.padEnd(34)} ${elapsed}s`);
        },
    });

    say();
    say('[balance:drivers] ARM                                  n  win%   flips(+/-)  procs/battle  silent  turns  ftk  stall  sweeps');
    const row = (s: ArmSummary) =>
        `[balance:drivers] ${armName(s.arm).padEnd(36)} ${String(s.battles).padStart(2)}  ${pct(s.winRate).padStart(6)}`
        + `  ${String(s.flipsToWin).padStart(3)}/${String(s.flipsToLoss).padEnd(3)}     ${s.procsPerBattle.toFixed(2).padStart(6)}`
        + `        ${String(s.silentBattles).padStart(2)}    ${s.meanTurns.toFixed(1).padStart(4)}  ${String(s.ftk).padStart(3)}  ${String(s.truncated).padStart(5)}  ${s.sweeps.join(',') || '-'}`;
    say(row(report.bare));
    for (const arm of report.arms) say(row(arm));
    say();
    /*
     * Per-battle rows, always. The table above is the summary; the rows are the evidence, and the
     * question the canary was built for — *"STORMSPARK, flagged for zoo compounding"* — is a
     * per-COMP question the summary cannot answer. Cheap to print, expensive to re-run.
     */
    say('[balance:drivers] arm                       matchup                            order   winner  turns  procs');
    for (const b of report.battles) {
        say(`[balance:drivers] ${b.arm.padEnd(25)} ${b.matchup.padEnd(34)} ${b.startingSide.padEnd(7)} ${String(b.winner).padEnd(7)} ${String(b.turns).padStart(5)}  ${String(b.procs).padStart(5)}`);
    }
    say();
    say('[balance:drivers] READ: procs/battle is the rate census; silent = battles the Driver never fired in');
    say('[balance:drivers]       (silent == n means the arm is VOID, not null). flips are paired against the bare');
    say('[balance:drivers]       arm on (matchup, seed, order). sweeps = comps at 100% on this sample — a flag,');
    say('[balance:drivers]       never a verdict at this n. Findings confirm at full, beamless lookahead.');
    say(`[balance:drivers] done in ${Math.round((Date.now() - started) / 1000)}s`);
}

main();
