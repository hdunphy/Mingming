/**
 * TICKET 113 side-check: `ascension` is in BOTH valkyrie decks, so the D0 change touches v1 as well.
 * `0-DECK-NOT-CARD` warns that a shared card cannot be priced right for two decks at once - so before
 * recommending "drop exhaust from ascension", measure what it does to `valkyrie_v1`, which never had
 * the loop and therefore gets the change as a pure buff or nothing.
 */
import { runPairedBatch } from '../src/debug/balance/runBatch';
import { teamScenario } from '../src/debug/balance/balanceScenarios';
import { ProgramRegistry } from '../src/engine/data/programRegistry';

const OPPS: Array<[string, string]> = [['huldra', 'huldra_v1'], ['gullinbursti', 'gullinbursti_v1'],
['draugr', 'draugr_v2'], ['kraken', 'kraken_v1'], ['skoll', 'skoll_v1']];

function setAsc(power: number, exhaust: boolean) {
    const c = ProgramRegistry['ascension'] as unknown as Record<string, unknown>;
    c.exhaust = exhaust;
    for (const a of (c.actions as Array<Record<string, unknown>>)) if (a.type === 'ATTACK') a.power = power;
}

// The power dial measured FLAT on valkyrie_v2 (D0 35.3 / D1 32.0 / D2 34.7, all inside noise), so if
// it moves v1 it is the compensator that lets the exhaust removal ship without buffing her sibling.
const ARMS: Array<[string, number, boolean]> = [
    ['BASE', 50, true], ['D0-noexh-50', 50, false], ['D1-noexh-45', 45, false], ['D2-noexh-40', 40, false],
];

for (const [arm, power, exhaust] of ARMS) {
    setAsc(power, exhaust);
    let tot = 0;
    for (const [sp, os] of OPPS) {
        const r = runPairedBatch(teamScenario({
            player: [['valkyrie', 'valkyrie_v1']], enemy: [[sp, os]], seed: `valkv1:${arm}:${os}`,
        }), { iterations: 30 });
        tot += r.pooled.decisiveWinRate;
        console.error(`  valkyrie_v1 ${arm.padEnd(13)} vs ${os.padEnd(16)} ${(r.pooled.decisiveWinRate * 100).toFixed(1)}%  ` +
            `decided ${r.pooled.iterations - r.pooled.truncatedCount}/${r.pooled.iterations}`);
    }
    console.error(`  ${arm} MEAN ${(tot / OPPS.length * 100).toFixed(1)}%\n`);
}
setAsc(50, true);
