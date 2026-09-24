/**
 * Entry point for `npm run balance:walk` — ticket 157.
 *
 * `vite-node` strips the script path from `process.argv`, so a module cannot detect being the entry
 * and nothing may run at module scope; the convention in this folder is that `X.ts` holds the logic
 * and `runX.ts` is the one line that calls it.
 *
 *   npm run balance:walk -- --seeds 30 --starter fenrir_v1
 *   npm run balance:walk -- --seeds 10                 # every one of the EA twelve
 */
import { walkStarter, summarise, printWalkReport, eaStarters, type WalkSummary } from './runWalker';

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

    if (arm === 'both') { run(false, 'no upgrades'); run(true, 'upgrades'); }
    else run(arm === 'on', arm === 'on' ? 'upgrades' : 'no upgrades');
}

main();
