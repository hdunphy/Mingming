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
 *     npm run balance:snowball -- --iterations 1    # fewer samples; ~1 hour, the shape
 *     npm run balance:snowball -- --pairs           # add the per-pair table
 *     npm run balance:snowball -- --out snowball.txt   # ALSO write the report to a file
 *     npm run balance:snowball -- --max-turns 60
 *
 * EXPERIMENTAL ARM — ticket 70 Q2b (Henry, 2026-08-29: *"if an ally dies that side gets a stack of
 * energized, see if that allows more comebacks"*). Compare against a baseline run of the same
 * `--iterations`; the arms are seeded identically, so the only difference is the grant.
 *
 *     npm run balance:snowball -- --iterations 1 --energized once      # the literal ask
 *     npm run balance:snowball -- --iterations 1 --energized standing  # the cliff actually repaired
 *     npm run balance:snowball -- --iterations 1 --energized once --energized-stacks 2
 *
 * THE CARD HALF (Henry, 2026-08-29): `--draw once|standing`, default 2 cards, which is the FULL
 * card cliff (7 -> 5 on a death). Composes with `--energized`, so the four-cell matrix is:
 *
 *     --draw once                        --draw standing
 *     --energized once --draw once       --energized once --draw standing
 *
 * # COST — THIS IS AN HOUR, NOT A MINUTE
 *
 * Six comps round-robin is **30 ordered pairs**, and `runPairedBatch` runs each under both turn
 * orders, so one iteration is 60 battles. These are 3v3s under the full lookahead — the expensive
 * cell. Measured on a 2-core box: **~120 s per pair**, so `--iterations 1` is about an hour and
 * `--iterations 3` is most of a morning.
 *
 * # WHY `--out` EXISTS
 *
 * An hour of measurement that only ever reached a terminal scrollback is an hour that has to be
 * spent again. Node line-buffers to a TTY but BLOCK-buffers to a pipe, so `> file.txt` shows
 * nothing for minutes at a time and a run killed part-way leaves an empty file — the progress
 * lines are in a 64 KB buffer that never flushed. `--out` writes the finished report directly,
 * independently of stdout, so the numbers survive a closed terminal either way.
 *
 * Nothing is written unless `--out` is passed, and the path is the caller's to choose: this is not
 * a committed artifact like `docs/balance/deck_report.json`, and dropping an unrequested file into
 * a tracked directory is how a report-only tool starts showing up in diffs.
 *
 * # REPORT-ONLY, AND IT EXITS 0
 *
 * Ticket 70 asks for measurement *before* a grilling. There is no threshold to fail here because
 * nothing has been ruled yet — that is the entire point of running it first. No constant is
 * touched and no ruling is implied by any number below.
 */

import fs from 'node:fs';

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
    const out = flag('out', '');

    /*
     * The experimental arm. Absent = baseline, which is what every other caller gets.
     *
     * `BOTH` sides, deliberately: granting it only to the player would measure "does a handicap
     * produce comebacks" rather than "does this rule produce comebacks", and the AI plays both
     * seats here.
     */
    const energizedMode = flag('energized', '');
    if (energizedMode && energizedMode !== 'once' && energizedMode !== 'standing') {
        console.error(`--energized takes 'once' or 'standing', not '${energizedMode}'`);
        process.exit(1);
    }
    const drawMode = flag('draw', '');
    if (drawMode && drawMode !== 'once' && drawMode !== 'standing') {
        console.error(`--draw takes 'once' or 'standing', not '${drawMode}'`);
        process.exit(1);
    }
    const bereavementDraw = drawMode
        ? {
            mode: drawMode as 'once' | 'standing',
            cards: Number.parseInt(flag('draw-cards', '2'), 10),
            side: 'BOTH' as const,
        }
        : undefined;

    const bereavementEnergy = energizedMode
        ? {
            mode: energizedMode as 'once' | 'standing',
            stacks: Number.parseInt(flag('energized-stacks', '1'), 10),
            side: 'BOTH' as const,
        }
        : undefined;

    /*
     * Every line goes to stdout AND, when `--out` is set, straight to the file with an immediate
     * `appendFileSync`. Appending per line rather than buffering the report and writing it at the
     * end is the whole point: a run killed at pair 18 of 30 then still leaves eighteen pairs of
     * evidence on disk instead of an empty file. This measurement takes an hour, and an hour of
     * work that only existed in a doomed process is an hour spent twice — which is exactly how
     * this flag came to be written.
     */
    if (out) fs.writeFileSync(out, '');
    const say = (line = ''): void => {
        console.log(line);
        if (out) fs.appendFileSync(out, `${line}\n`);
    };

    const pairs = REFERENCE_PANEL.length * (REFERENCE_PANEL.length - 1);
    const battles = pairs * iterations * 2;

    say('[balance:snowball] Ticket 70 — the first-KO snowball, measured before the grilling.');
    say(`[balance:snowball]   population  REFERENCE_PANEL round-robin, mirrors excluded`);
    say(`[balance:snowball]   pairs       ${pairs} ordered  ·  ${iterations} paired seeds  ->  ${battles} battles`);
    say(`[balance:snowball]   maxTurns    ${maxTurns}   (standalone 3v3s — NOT a run: no HP carries between fights)`);
    if (!bereavementEnergy && !bereavementDraw) {
        say(`[balance:snowball]   arm         baseline (no experimental rule)`);
    } else {
        say(`[balance:snowball]   ARM         EXPERIMENTAL, both sides:`);
        if (bereavementEnergy) {
            say(`[balance:snowball]     energy    on a death, each surviving member gains`
                + ` ${bereavementEnergy.stacks} Energized (${bereavementEnergy.mode})`);
        }
        if (bereavementDraw) {
            say(`[balance:snowball]     draw      the bereaved side draws +${bereavementDraw.cards}`
                + ` at its turn start (${bereavementDraw.mode})`);
        }
    }
    say();

    const started = Date.now();
    const { report, perPair } = measureSnowball({
        iterations,
        maxTurns,
        bereavementEnergy,
        bereavementDraw,
        onPair: (label, done, total) => {
            const elapsed = Math.round((Date.now() - started) / 1000);
            say(`[balance:snowball]   ${String(done).padStart(2)}/${total}  ${label.padEnd(32)} ${elapsed}s`);
        },
    });

    say();
    say('=========================================================================');
    say(`  TICKET 70 — ${report.battles} battles, ${Math.round((Date.now() - started) / 1000)}s`);
    say('=========================================================================');
    say();

    say('  1. HOW DECISIVE IS THE FIRST KO');
    say(`     P(win | scored first KO)      ${pct(report.winAfterScoringFirstKo)}   (n=${report.line1Samples})`);
    say(`     P(win | conceded first KO)    ${pct(report.winAfterConcedingFirstKo)}   <- the comeback rate`);
    say(`     battles reaching a KO         ${report.decisiveKo} of ${report.battles}`);
    if (report.simultaneousKo > 0) {
        say(`     simultaneous first KOs        ${report.simultaneousKo}  (excluded from line 1 — no side scored it)`);
    }
    say();

    say('  2. IS THE REST OF THE FIGHT REAL PLAY');
    say(`     mean turns after first KO     ${n1(report.meanTurnsAfterFirstKo)}   (median ${n1(report.medianTurnsAfterFirstKo)})`);
    say(`     mean battle length            ${n1(report.meanTurnsTotal)} turns`);
    say(`     share of the fight after it   ${pct(report.fractionOfFightAfterFirstKo)}`);
    say();

    say('  3. THE OVERKILL INCENTIVE');
    say(`     mean wasted per battle        ${n1(report.meanOverkillPerBattle)} damage   (median ${n1(report.medianOverkillPerBattle)})`);
    say(`     as a share of one side's HP   ${pct(report.overkillAsShareOfStartingHp)}`);
    say();

    say('  4. DOES THE BIGGER TEAM STILL WIN');
    say(`     P(win | higher starting HP)   ${pct(report.winWithHigherStartingHp)}   (n=${report.line4Samples})`);
    if (report.equalHpBattles > 0) {
        say(`     equal-HP battles              ${report.equalHpBattles}  (excluded — line 4 is undefined for them)`);
    }
    say();

    say('  DEPTH OF THE SNOWBALL');
    say(`     members lost by the loser     ${n1(report.meanLossesLoser)} of 3`);
    say(`     members lost by the winner    ${n1(report.meanLossesWinner)} of 3`);
    if (report.truncated > 0) {
        say();
        say(`  ${report.truncated} battle(s) never resolved and are counted in every line above.`);
    }

    if (showPairs) {
        say();
        say('  --- per pair ---');
        for (const { label, runs } of perPair) {
            const r = summarizeSnowball(runs);
            say(`    ${label.padEnd(34)} P(win|first KO) ${pct(r.winAfterScoringFirstKo).padStart(6)}`
                + `   after-KO ${n1(r.meanTurnsAfterFirstKo).padStart(4)}t`
                + `   overkill ${n1(r.meanOverkillPerBattle).padStart(6)}`);
        }
    }

    say();
    if (bereavementEnergy || bereavementDraw) {
        /*
         * THE ARM-LIVENESS CHECK, printed next to the result and not buried.
         *
         * The merge report's costliest lesson: *"a dead arm reads exactly like a null result."* Four
         * measurements in one arc stayed green and measured nothing. An experiment that cannot prove
         * it did something is not evidence of no effect — it is not evidence at all.
         */
        say('  ARM LIVENESS');
        const dead: string[] = [];
        if (bereavementEnergy) {
            say(`     Energized stacks granted      ${report.energizedGranted}`
                + ` (${(report.energizedGranted / Math.max(1, report.battles)).toFixed(1)}/battle)`);
            if (report.energizedGranted === 0) dead.push('energy');
        }
        if (bereavementDraw) {
            say(`     Extra cards drawn             ${report.cardsGranted}`
                + ` (${(report.cardsGranted / Math.max(1, report.battles)).toFixed(1)}/battle)`);
            if (report.cardsGranted === 0) dead.push('draw');
        }
        say(dead.length > 0
            ? `     *** ZERO on: ${dead.join(', ')}. THAT ARM DID NOTHING — VOID, not a null result. ***`
            : '     Every declared arm fired.');
        say();
        say('  Compare line 1 against the baseline run at the same --iterations. Both arms are');
        say('  seeded identically, so the comeback rate is the only thing that moved.');
        say();
    }
    say('  Report-only. Nothing here rules anything — ticket 70 § "The grilling" is Henry\'s.');
    if (out) console.log(`\n  Written to ${out}`);
}

main();
