/**
 * TICKET 135 — the 3v3 panel. Henry: *"give me the 3v3 numbers"*.
 *
 * Every balance number in tickets 131-134 is 1v1, and the game ships 3v3. The mechanism ticket 134
 * identified is three times stronger there: `sum(cardDraw) - aliveUnits + 1` means +1 cardDraw is
 * +1 card a turn at 1v1 and +3 at 3v3, so the shift from a card-limited game to an energy-limited
 * one — the whole reason cheap decks took off — lands three times harder. This measures whether
 * the 1v1 ordering survives, and by how much it widens.
 *
 * A DECK IS THREE COPIES OF ITSELF. At 3v3 the pile is shared across the party, so a mixed trio
 * measures its partners as much as its subject: one deck in three is one third of the pile and one
 * third of the cost profile. Three copies of one firmware keeps the pile's average cost exactly
 * equal to that deck's average cost while expressing the full three-body draw, which is the only
 * construction that isolates the thing under test. `scratch/trioprobe.ts` confirmed it runs.
 *
 * IT IS BEAMED, AND THAT IS NOT OPTIONAL. Ticket 108's rule is "confirm anything you intend to act
 * on at full, BEAMLESS", and every 1v1 number on record obeys it. Beamless 3v3 is no longer
 * affordable: `trioprobe` at `--beam 0` did not finish two paired iterations in ten minutes,
 * because branching is roughly casters x hand x targets at MAX_DEPTH 3 and ticket 131 took the
 * hand cap from 9 to 15. At `GAME_BEAM_WIDTH` (8) a battle costs 60s — measured, 241s for four —
 * which is what sizes this panel.
 *
 * So these numbers are the search a PLAYER actually plays against, and they are NOT comparable
 * cell-for-cell with the beamless 1v1 grid. Read them for ORDERING and SPREAD, not against 1v1
 * absolutes. The census assertion below proves the beam actually loaded rather than assuming it —
 * four arms in this arc "worked", stayed green, and measured nothing.
 *
 * ROUND ROBIN, NOT A FIELD. The ten decks are ticket 134's panel (the five biggest gainers and the
 * five biggest losers of the re-baseline), so the rows line up with that ticket's table. They play
 * only each other: at 60s a battle a full 32-deck field is out of reach, and a self-contained
 * round robin still gives every deck a comparable score.
 *
 * Resumable per PAIR — each result is appended as it lands, and a rerun skips what is on disk.
 *
 * Run: npx vite-node scratch/trio3v3.ts -- --iter 2 [--shard 0 --shards 2]
 */
function arg(name: string, dflt: string): string {
    const i = process.argv.indexOf(`--${name}`);
    const v = i === -1 ? undefined : process.argv[i + 1];
    return v === undefined || v.startsWith('--') ? dflt : v;
}
const ITER = Number(arg('iter', '2'));
const BEAM = arg('beam', '8');
const SHARD = Number(arg('shard', '0'));
const SHARDS = Number(arg('shards', '1'));
const OUT = arg('out', 'results/trio3v3');

const P = 'process', E = 'env';
const penv = ((globalThis as unknown as Record<string, Record<string, Record<string, string>>>)[P] ??= {} as never);
const bag = (penv[E] ??= {} as never);
bag.AI_BEAM = BEAM;
bag.AI_CENSUS = '1';

/**
 * SIX DECKS, NOT TICKET 134's TEN, and the reason is measured rather than chosen.
 *
 * The first pair off this harness — `ratatoskr_v1` vs `huldra_v1` — took **17.8 minutes** for four
 * battles (266s each, against `trioprobe`'s 60s, the difference being CPU contention plus deck
 * branching: ratatoskr is a six-free-card pile, so it has far more castable combinations per turn
 * than the probe's pair did). Ten decks is 45 unordered pairs, which is thirteen hours. Six is 15
 * pairs, which fits.
 *
 * The six keep the contrast the question is about: the three cheapest winners against the two
 * bottom decks plus `ymir_v2`, which at 1.50 average cost is the most EXPENSIVE deck on the panel
 * and therefore the cleanest read on whether cost is still the axis at three bodies.
 * `ratatoskr_v1` stays ahead of `huldra_v1` in this list so the pair already measured is reused
 * rather than re-run.
 */
const PANEL = [
    'ratatoskr_v1',   // 75.3 at 1v1, 0.73 avg cost, 6 free cards of 11
    'huldra_v1',      // 91.8, 0.67 avg cost — the roster's top deck
    'sleipnir_v1',    // 72.4, 0.67 avg cost
    'ymir_v2',        // 42.1, 1.50 avg cost — the expensive control
    'fafnir_v2',      // 17.8 — bottom of the roster
    'fafnir_v1',      // 19.0
] as const;

const speciesOf = (deck: string): string => deck.replace(/_v[12]$/, '');

async function main(): Promise<void> {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const { census } = await import('../src/engine/ai/TacticalAI');
    const { runPairedBatch } = await import('../src/debug/balance/runBatch');
    const { teamScenario } = await import('../src/debug/balance/balanceScenarios');

    fs.mkdirSync(OUT, { recursive: true });
    const trio = (deck: string): Array<readonly [string, string]> => {
        const sp = speciesOf(deck);
        return [[sp, deck], [sp, deck], [sp, deck]];
    };

    // Unordered pairs only: `runPairedBatch` already runs both turn orders, so running (a,b) and
    // (b,a) as separate cells would double the cost to measure the same thing twice.
    const pairs: Array<[string, string]> = [];
    for (let i = 0; i < PANEL.length; i++)
        for (let j = i + 1; j < PANEL.length; j++) pairs.push([PANEL[i], PANEL[j]]);

    for (let k = SHARD; k < pairs.length; k += SHARDS) {
        const [a, b] = pairs[k];
        const file = path.join(OUT, `${a}__${b}.csv`);
        if (fs.existsSync(file)) { console.log(`SKIP,${a},${b}`); continue; }

        const t0 = Date.now();
        const r = runPairedBatch(teamScenario({
            player: trio(a), enemy: trio(b), seed: `trio:${a}:${b}`,
        }), { iterations: ITER });
        const ms = Date.now() - t0;

        // `decisiveWinRate` is from A's perspective; B's score is its complement, and the merger
        // relies on that rather than running the mirror as a second cell.
        const line = [a, b, (r.pooled.decisiveWinRate * 100).toFixed(2),
            r.pooled.iterations, r.pooled.decisive, r.pooled.averageTurns.toFixed(2),
            r.pooled.truncatedCount, r.pooled.ftkCount, ms].join(',');
        fs.writeFileSync(file, line + '\n');
        console.log(`PAIR,${line}`);
    }

    console.log(`BEAMCHECK,${BEAM},pruned=${census.pruned},enumerated=${census.enumerated}`);
    if (Number(BEAM) > 0 && census.pruned === 0) {
        throw new Error(`trio3v3: --beam ${BEAM} pruned NOTHING - the beam did not load`);
    }
}
main().catch(e => { console.error(e); process.exit(1); });
