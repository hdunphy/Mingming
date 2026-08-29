/**
 * `npm run balance:snowball` — ticket 70's four numbers, printed.
 *
 * The harness is `snowball.ts`; this file is the argv, the tables and the caveats. Same split as
 * `runRunGate.ts` / `runGate.ts`, for the same reason: what to measure should be importable and
 * testable without a `console.log` in it.
 *
 * Usage:
 *
 *     npm run balance:snowball                      # the reference panel, 3 paired seeds per pair
 *     npm run balance:snowball -- --iterations 6    # more samples
 *     npm run balance:snowball -- --pairs           # add the per-pair table
 *     npm run balance:snowball -- --max-turns 60
 *
 * # COST
 *
 * Six comps round-robin is **30 ordered pairs**, and `runPairedBatch` runs each under both turn
 * orders, so one iteration is 60 battles. These are 3v3s under the full lookahead — the expensive
 * cell. Budget from a measured rate rather than a guess: the run gate's own header prices a 3v3
 * gauntlet battle at roughly 20-25 s on a 2-core box, so `--iterations 3` (180 battles) is an hour
 * or more. Start at 1 to see the shape, then raise it.
 *
 * # REPORT-ONLY, AND IT EXITS 0
 *
 * Ticket 70 asks for measurement *before* a grilling. There is no threshold to fail here because
 * nothing has been ruled yet — that is the entire point of running it first. No file is written and
 * no constant is touched.
 */

import { measureSnowball, SNOWBALL_MAX_TURNS, summarizeSnowball } from './snowball';
import { REFERENCE_PANEL } from './teamComps';

const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
const n1 = (x: number) => x.toFixed(1);

/*
 * Flags, not environment variables, and `runRunGate.ts`'s spelling of them rather than a new
 * shared helper — there is no `argv` module in this folder and one script is not a reason to
 * invent one.
 *
 * `vite.config.ts` substitutes `process.env` to `{}` in everything vite-node loads, so an env-based
 * CLI here would silently run its defaults. `process.argv` is untouched by that define, which is
 * why the whole repo's convention is flags. See `scratch/_env.ts` for the full account.
 */
function flag(name: string, fallback: string): string {
    const i = process.argv.indexOf(`--${name}`);
    const v = i >= 0 ? process.argv[i + 1] : undefined;
    return v === undefined || v.startsWith('--') ? fallback : v;
}

function main(): void {
    const iterations = Number.parseInt(flag('iterations', '3'), 10);
    const maxTurns = Number.parseInt(flag('max-turns', String(SNOWBALL_MAX_TURNS)), 10);
    const showPairs = process.argv.includes('--pairs');

    const pairs = REFERENCE_PANEL.length * (REFERENCE_PANEL.length - 1);
    const battles = pairs * iterations * 2;

    console.log('[balance:snowball] Ticket 70 — the first-KO snowball, measured before the grilling.');
    console.log(`[balance:snowball]   population  REFERENCE_PANEL round-robin, mirrors excluded`);
    console.log(`[balance:snowball]   pairs       ${pairs} ordered  ·  ${iterations} paired seeds  ->  ${battles} battles`);
    console.log(`[balance:snowball]   maxTurns    ${maxTurns}   (standalone 3v3s — NOT a run: no HP carries between fights)`);
    console.log('');

    const started = Date.now();
    const { report, perPair } = measureSnowball({
        iterations,
        maxTurns,
        onPair: (label, done, total) => {
            const elapsed = Math.round((Date.now() - started) / 1000);
            console.log(`[balance:snowball]   ${String(done).padStart(2)}/${total}  ${label.padEnd(32)} ${elapsed}s`);
        },
    });

    console.log('');
    console.log('=========================================================================');
    console.log(`  TICKET 70 — ${report.battles} battles, ${Math.round((Date.now() - started) / 1000)}s`);
    console.log('=========================================================================');
    console.log('');

    console.log('  1. HOW DECISIVE IS THE FIRST KO');
    console.log(`     P(win | scored first KO)      ${pct(report.winAfterScoringFirstKo)}   (n=${report.line1Samples})`);
    console.log(`     P(win | conceded first KO)    ${pct(report.winAfterConcedingFirstKo)}   <- the comeback rate`);
    console.log(`     battles reaching a KO         ${report.decisiveKo} of ${report.battles}`);
    if (report.simultaneousKo > 0) {
        console.log(`     simultaneous first KOs        ${report.simultaneousKo}  (excluded from line 1 — no side scored it)`);
    }
    console.log('');

    console.log('  2. IS THE REST OF THE FIGHT REAL PLAY');
    console.log(`     mean turns after first KO     ${n1(report.meanTurnsAfterFirstKo)}   (median ${n1(report.medianTurnsAfterFirstKo)})`);
    console.log(`     mean battle length            ${n1(report.meanTurnsTotal)} turns`);
    console.log(`     share of the fight after it   ${pct(report.fractionOfFightAfterFirstKo)}`);
    console.log('');

    console.log('  3. THE OVERKILL INCENTIVE');
    console.log(`     mean wasted per battle        ${n1(report.meanOverkillPerBattle)} damage   (median ${n1(report.medianOverkillPerBattle)})`);
    console.log(`     as a share of one side's HP   ${pct(report.overkillAsShareOfStartingHp)}`);
    console.log('');

    console.log('  4. DOES THE BIGGER TEAM STILL WIN');
    console.log(`     P(win | higher starting HP)   ${pct(report.winWithHigherStartingHp)}   (n=${report.line4Samples})`);
    if (report.equalHpBattles > 0) {
        console.log(`     equal-HP battles              ${report.equalHpBattles}  (excluded — line 4 is undefined for them)`);
    }
    console.log('');

    console.log('  DEPTH OF THE SNOWBALL');
    console.log(`     members lost by the loser     ${n1(report.meanLossesLoser)} of 3`);
    console.log(`     members lost by the winner    ${n1(report.meanLossesWinner)} of 3`);
    if (report.truncated > 0) {
        console.log('');
        console.log(`  ${report.truncated} battle(s) never resolved and are counted in every line above.`);
    }

    if (showPairs) {
        console.log('');
        console.log('  --- per pair ---');
        for (const { label, runs } of perPair) {
            const r = summarizeSnowball(runs);
            console.log(`    ${label.padEnd(34)} P(win|first KO) ${pct(r.winAfterScoringFirstKo).padStart(6)}`
                + `   after-KO ${n1(r.meanTurnsAfterFirstKo).padStart(4)}t`
                + `   overkill ${n1(r.meanOverkillPerBattle).padStart(6)}`);
        }
    }

    console.log('');
    console.log('  Report-only. Nothing here rules anything — ticket 70 § "The grilling" is Henry\'s.');
}

main();
