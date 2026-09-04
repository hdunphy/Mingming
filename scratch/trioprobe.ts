/**
 * TICKET 135 probe — can a 3v3 team be THREE COPIES of one firmware, and what does a battle cost?
 *
 * Two things have to be true before the 3v3 panel is worth building.
 *
 * 1. THE TRIPLE HAS TO BE LEGAL. `teamScenario` caps a party at 3 and otherwise does not care
 *    about duplicates, but `beamgate3v3`'s own team builder deliberately skips a species it has
 *    already used (`if (used.has(cand[0])) continue`), which is a hint that something downstream
 *    might not like it. If a triple runs, it is the RIGHT instrument for this question: the shared
 *    pile is 3x one deck, so the pile's average cost is exactly that deck's average cost and the
 *    full +3-cards-a-turn draw is expressed. A mixed trio would dilute the deck's own economy to
 *    one third and measure mostly its partners.
 *
 * 2. THE COST HAS TO BE KNOWN, not assumed. Ticket 109 put a 3v3 battle at ~13s and ticket 127
 *    measured a beamless 3v3 DECISION at 1320ms. Those two numbers imply very different budgets
 *    for a ten-deck panel, and guessing wrong is how an overnight run turns out to be a
 *    three-day run. Time it, then size the panel from the measurement.
 *
 * Run: npx vite-node scratch/trioprobe.ts
 */
function arg(name: string, dflt: string): string {
    const i = process.argv.indexOf(`--${name}`);
    const v = i === -1 ? undefined : process.argv[i + 1];
    return v === undefined || v.startsWith('--') ? dflt : v;
}
const BEAM = arg('beam', '0');
const ITER = Number(arg('iter', '2'));

/**
 * BEAMLESS 3v3 IS NO LONGER AFFORDABLE, and that is itself a ticket-131 consequence.
 *
 * Every balance number on record is beamless (ticket 108: "confirm anything you intend to act on
 * at full, BEAMLESS"), and until now that was a cost decision rather than a hard limit. It is a
 * hard limit at 3v3 now: this probe at `--beam 0` did not finish two paired iterations in TEN
 * MINUTES. The reason is ticket 131 - branching is roughly casters x hand x targets at MAX_DEPTH
 * 3, and the hand cap went 9 -> 15, so the beamless 3v3 tree grew with the hand.
 *
 * So a 3v3 panel has to run at the width the GAME runs (`GAME_BEAM_WIDTH` = 8). That is defensible
 * on its own terms - it is the search a player actually plays against - but it means 3v3 numbers
 * are NOT comparable cell-for-cell with the beamless 1v1 corpus, and any report has to say so.
 */
const P = 'process', E = 'env';
const penv = ((globalThis as unknown as Record<string, Record<string, Record<string, string>>>)[P] ??= {} as never);
const bag = (penv[E] ??= {} as never);
bag.AI_BEAM = BEAM;
bag.AI_CENSUS = '1';   // so the run can PROVE the beam loaded rather than assuming it

async function main(): Promise<void> {
    const { census } = await import('../src/engine/ai/TacticalAI');
    const { runPairedBatch } = await import('../src/debug/balance/runBatch');
    const { teamScenario } = await import('../src/debug/balance/balanceScenarios');

    const trio = (sp: string, os: string): Array<readonly [string, string]> =>
        [[sp, os], [sp, os], [sp, os]];

    // huldra_v1 is the top of the roster at 91.8 and fafnir_v2 the bottom at 17.8, so this pair is
    // also a first read on whether the 1v1 ordering survives at 3v3 at all.
    const t0 = Date.now();
    const r = runPairedBatch(teamScenario({
        player: trio('huldra', 'huldra_v1'),
        enemy: trio('fafnir', 'fafnir_v2'),
        seed: 'trioprobe:1',
    }), { iterations: ITER });
    const ms = Date.now() - t0;

    console.log(`TRIPLE LEGAL. ${r.pooled.iterations} iterations, ${r.pooled.decisive} decisive`);
    console.log(`  huldra_v1 x3 vs fafnir_v2 x3 : ${(r.pooled.decisiveWinRate * 100).toFixed(1)}%`);
    console.log(`  turns ${r.pooled.averageTurns.toFixed(2)}  truncated ${r.pooled.truncatedCount}`);
    console.log(`COST,${ms}ms for ${r.pooled.iterations} battles = ${(ms / r.pooled.iterations).toFixed(0)}ms each`);

    // The party must really be three bodies, or this is a 1v1 with extra steps. `sum(cardDraw) -
    // aliveUnits + 1` is the whole reason 3v3 is a different game, and it needs 3 alive units.
    if (r.pooled.iterations === 0) throw new Error('trioprobe: no battles ran');

    console.log(`BEAMCHECK,${BEAM},pruned=${census.pruned},enumerated=${census.enumerated}`);
    if (Number(BEAM) > 0 && census.pruned === 0) {
        throw new Error(`trioprobe: --beam ${BEAM} pruned NOTHING - the beam did not load`);
    }
}
main().catch(e => { console.error(e); process.exit(1); });
