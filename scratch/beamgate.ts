/**
 * TICKET 127 - re-run the beam's 1v1 identity gate against the CURRENT card pool.
 *
 * `research/3v3-optimisation.md` shipped `AI_BEAM` with a stated gate: `AI_BEAM` of 6, 8, 12 and 16
 * were BIT-IDENTICAL to no beam across 90 grid cells, and 4 moved 7 of them. It also put the caveat
 * on the record rather than burying it:
 *
 *   > that identity is EMPIRICAL, not structural. Re-run the grid gate after any change to the card
 *   > pool. Do not read "bit-identical on 90 cells" as "cannot move".
 *
 * The card pool HAS changed since: ticket 115 moved five control cards to Side scope, 123 rescoped
 * `CARDS_PLAYED` to the caster, 124 made `rimebreaker` pay a stack, 126 moved Burn/Poison/Regen to
 * turn start. Every one of those changes branching, the eval, or both. So the gate is stale and the
 * claim is not currently held up by anything.
 *
 * This runs one deck row at one beam width and prints the cells. Diff two runs to gate the beam.
 *
 * WHY IT LOOKS LIKE THIS. `AI_BEAM` is a module-level constant in `TacticalAI`, read from the
 * environment at import - and under vite-node the environment does not reach module code at all
 * (`vite.config.ts` defines `process.env` to `{}`, and vite-node hands the module an empty bag
 * regardless). So this file WRITES the key onto `globalThis.process.env` through computed
 * properties, which leave no `process.env` token for the define to rewrite, and only THEN imports
 * the engine. Hence the dynamic imports. One process is one beam width, because a module constant
 * is read once.
 *
 * Run: npx vite-node scratch/beamgate.ts -- --deck draugr_v2 --beam 8 --iter 10
 */

function arg(name: string, dflt?: string): string {
    const i = process.argv.indexOf(`--${name}`);
    const v = i === -1 ? undefined : process.argv[i + 1];
    if (v === undefined || v.startsWith('--')) {
        // A silent default is what let a broken run look like a finished one (gridshard's note).
        if (dflt === undefined) throw new Error(`beamgate: --${name} is required`);
        return dflt;
    }
    return v;
}

const DECK = arg('deck');
const BEAM = arg('beam');
const ITER = Number(arg('iter', '10'));
const SEEDBASE = arg('seedbase', 'grid');

const P = 'process', E = 'env';
const penv = ((globalThis as unknown as Record<string, Record<string, Record<string, string>>>)[P] ??= {} as never);
const bag = (penv[E] ??= {} as never);
bag.AI_BEAM = BEAM;
// The census is on so the run can PROVE the beam took. Four arms in this arc "worked", stayed
// green and measured nothing; a beam that silently failed to load would print two identical
// rows and I would report bit-identical when I had actually run the same build twice.
bag.AI_CENSUS = '1';

async function main(): Promise<void> {
    const { census } = await import('../src/engine/ai/TacticalAI');
    const { runPairedBatch } = await import('../src/debug/balance/runBatch');
    const { matchupScenario, BALANCE_SPECIES } = await import('../src/debug/balance/balanceScenarios');
    const { MingmingRegistry } = await import('../src/engine/data/mingmingRegistry');

    const SPECIES = DECK.replace(/_v[12]$/, '');
    const opponents: Array<{ sp: string; deck: string }> = [];
    for (const sp of BALANCE_SPECIES) if (sp !== SPECIES)
        for (const d of MingmingRegistry[sp].availableOS) opponents.push({ sp, deck: d });

    for (let i = 0; i < opponents.length; i++) {
        const o = opponents[i];
        const r = runPairedBatch(matchupScenario({
            player: SPECIES, enemy: o.sp, playerOS: DECK, enemyOS: o.deck,
            seed: `${SEEDBASE}:${DECK}:${o.deck}`,
        }), { iterations: ITER });
        console.log([`CELL`, i, o.deck,
            (r.pooled.decisiveWinRate * 100).toFixed(2),
            r.pooled.averageTurns.toFixed(2)].join(','));
    }

    // ASSERT THE ARM TOOK. `research/3v3-optimisation.md` measured `AI_BEAM=8` pruning candidates
    // even at 1v1, so a beamed row that pruned nothing did not load the beam.
    console.log(`BEAMCHECK,${BEAM},pruned=${census.pruned},enumerated=${census.enumerated}`);
    if (Number(BEAM) > 0 && census.pruned === 0) {
        throw new Error(`beamgate: --beam ${BEAM} pruned NOTHING - the beam did not load, this row measured beam 0`);
    }
    if (Number(BEAM) === 0 && census.pruned > 0) {
        throw new Error('beamgate: --beam 0 pruned candidates - a beam leaked in from somewhere');
    }
}

main().catch(e => { console.error(e); process.exit(1); });
