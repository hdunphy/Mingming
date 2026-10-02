/**
 * Entry point for `npm run balance:walk` — ticket 157.
 *
 * `vite-node` strips the script path from `process.argv`, so a module cannot detect being the entry
 * and nothing may run at module scope; the convention in this folder is that `X.ts` holds the logic
 * and `runX.ts` is the one line that calls it.
 *
 *   npm run balance:walk -- --seeds 30 --starter fenrir_v1
 *   npm run balance:walk -- --seeds 10                 # every one of the EA twelve
 *   npm run balance:walk -- --seeds 200 --fight 1      # 157-r1's fight-one read, and nothing else
 *
 * `--fight N` truncates every walk after N fights and prints `printFightOneReport` instead of the
 * run report. It is the answer to *"report fight one only"*: a full walk spends almost all of its
 * time on fights that read does not look at, which is what capped the first one at five seeds a
 * starter — and at five seeds, 60% and 80% are the same measurement.
 */
import {
    walkStarter, summarise, printWalkReport, eaStarters, type WalkSummary,
    walkStarterTruncated, summariseFightOne, printFightOneReport, type FightOneRow,
} from './runWalker';
import { RUN_GATE_TARGETS } from './runGate';

function main(): void {
    const argv = process.argv.slice(2);
    const get = (flag: string): string | undefined => {
        const i = argv.indexOf(flag);
        return i >= 0 ? argv[i + 1] : undefined;
    };
    const seeds = Number(get('--seeds') ?? 30);
    const starters = get('--starter')?.split(',').map((s) => s.trim()).filter(Boolean) ?? eaStarters();
    const label = get('--label') ?? 'walk';
    // TICKET 163e's arm. `--upgrades both` runs the pair — same seeds, same graphs, same offers,
    // one spending policy apart — which is the only shape in which ten seeds says anything.
    const arm = get('--upgrades') ?? 'off';
    // 163e: sweep the shop's patch price without editing the shipped constant.
    const patchPrice = get('--patch-price') === undefined ? undefined : Number(get('--patch-price'));

    const run = (upgrades: boolean, title: string): void => {
        const summaries: WalkSummary[] = [];
        for (const starter of starters) {
            const started = Date.now();
            const results = walkStarter(starter, seeds, label, upgrades, patchPrice);
            summaries.push(summarise(starter, results));
            console.error(`  [${title}] ${starter}: ${seeds} runs in ${((Date.now() - started) / 1000).toFixed(0)} s`);
        }
        console.log(`\n########## ARM: ${title}${patchPrice === undefined ? '' : ` · patch ${patchPrice} scrap`} ##########`);
        printWalkReport(summaries);
    };

    // TICKET 157-r1: the truncated read comes first and returns, because none of the run-report
    // flags above mean anything to it — an upgrade arm on a walk that stops at fight one is a
    // spending policy with nothing to spend on.
    const fightIndex = get('--fight') === undefined ? undefined : Number(get('--fight'));
    if (fightIndex !== undefined) {
        const rows: FightOneRow[] = [];
        for (const starter of starters) {
            const started = Date.now();
            rows.push(summariseFightOne(starter, walkStarterTruncated(starter, seeds, fightIndex, label), fightIndex));
            console.error(`  [fight ${fightIndex}] ${starter}: ${seeds} runs in ${((Date.now() - started) / 1000).toFixed(0)} s`);
        }
        // The target is READ FROM THE GATE rather than written here — which is exactly why this
        // line needed no edit when Henry moved the wild band from 95 to 90 on 2026-09-25. A copy
        // in this file would have been a second opinion, still printing the old number.
        // ×100: the gate stores its targets as FRACTIONS (`wild: 0.90`) and prints them scaled at
        // the edge. Caught by the first smoke run, which cheerfully reported every starter as
        // beating a target of 0.90%.
        printFightOneReport(rows, 100 * RUN_GATE_TARGETS.wild, fightIndex);
        return;
    }

    if (arm === 'both') { run(false, 'no upgrades'); run(true, 'upgrades'); }
    else run(arm === 'on', arm === 'on' ? 'upgrades' : 'no upgrades');
}

main();
