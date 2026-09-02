/**
 * TICKET 135 — +1 energy to the UNDERPERFORMING decks only, one lane of the grid.
 *
 * Henry: *"can you see what happens if you give 1e extra to all of the decks that are under
 * performing"*.
 *
 * This is NOT ticket 134's `ENERGY` arm. That one gave +1 to every unit on the roster and made the
 * losing decks WORSE (ymir_v2 42.1 -> 19.9), because the cheap winners had more cards in hand to
 * spend the extra energy on and simply converted it into more plays. This gives the energy ONLY to
 * the nine decks that came out of the promoted grid below the band, which is a completely different
 * question: not "does more energy help the game" but "can the losers be bought back into band
 * one deck at a time".
 *
 * ENERGY IS A SPECIES STAT, AND THE DECKS ARE NOT. `initializeBattleEntity` reads
 * `definition.baseStats.energy`, so there is no per-firmware energy anywhere in the engine. That
 * matters here because FIVE of the nine underperformers have a healthy sibling on the same
 * species — fenrir_v1 is 26.8 while fenrir_v2 is 70.0, jormungandr_v2 is 33.0 while jormungandr_v1
 * is 74.6 — so patching the species would buff decks that need no help and the arm would measure
 * the wrong thing.
 *
 * THE PER-CELL PATCH IS EXACT, NOT AN APPROXIMATION, and the reason is worth stating because it
 * looks like a hack. `gridshard` builds its opponent list with `if (sp !== SPECIES)`, so within any
 * single cell the two sides are ALWAYS different species and each side carries exactly one
 * firmware. Setting each species' energy from that side's firmware immediately before the cell
 * runs therefore expresses per-deck energy exactly. The pristine value is restored from a snapshot
 * taken before anything is touched, so a cell can never inherit the previous cell's patch.
 *
 * THE SHIPPABLE FORM OF THIS, if the arm works, is not a stat change: it is a firmware hook.
 * `resolutionEngine` and `HookFactory` already raise `maxEnergy` by an amount, and
 * `driverRegistry`'s `ENERGY_CAP_BONUS` does exactly +1/+1 — so the nine firmwares would each gain
 * an on-battle-start +1. Nothing here is proposing a new mechanic.
 *
 * The row emits the two energies it actually used as extra columns, so the CSV proves the arm took
 * on a per-cell basis rather than the run asserting it once and hoping.
 *
 * env: none. Flags only — see `gridshard.ts` for why (vite-node cannot see env vars).
 * Run via `scratch/energygrid.mjs`, not directly.
 */
function arg(name: string, dflt?: string): string {
    const i = process.argv.indexOf(`--${name}`);
    const v = i === -1 ? undefined : process.argv[i + 1];
    if (v === undefined || v.startsWith('--')) {
        if (dflt === undefined) throw new Error(`energyshard: --${name} is required`);
        return dflt;
    }
    return v;
}

const DECK = arg('deck');
const SPECIES = DECK.replace(/_v[12]$/, '');
const ITER = Number(arg('iter', '30'));
const SEEDBASE = arg('seedbase', 'grid');
const SHARD = Number(arg('shard', '0'));
const SHARDS = Number(arg('shards', '1'));

const P = 'process', E = 'env';
const penv = ((globalThis as unknown as Record<string, Record<string, Record<string, string>>>)[P] ??= {} as never);
((penv[E] ??= {} as never)).AI_BEAM = '0';   // beamless, matching every 1v1 number on record

/**
 * The nine decks below the 35-80 band in `docs/balance/deck_grid.json` after the ticket-132
 * promotion. huldra_v1 is the tenth out-of-band deck and is NOT here: it is out the TOP at 91.8,
 * and handing it energy is the opposite of the intent.
 */
const UNDERPERFORMERS = new Set([
    'jormungandr_v2',   // 33.0
    'hel_v2',           // 31.7
    'kraken_v1',        // 29.4
    'draugr_v1',        // 29.3
    'kraken_v2',        // 29.1
    'gullinbursti_v2',  // 27.3
    'fenrir_v1',        // 26.8
    'fafnir_v1',        // 19.0
    'fafnir_v2',        // 17.8
]);

import { runPairedBatch } from '../src/debug/balance/runBatch';
import { matchupScenario, BALANCE_SPECIES } from '../src/debug/balance/balanceScenarios';
import { MingmingRegistry } from '../src/engine/data/mingmingRegistry';

/** Pristine energies, snapshotted before a single byte is patched. */
const PRISTINE = new Map<string, number>();
for (const sp of Object.keys(MingmingRegistry)) {
    const e = (MingmingRegistry as Record<string, { baseStats?: { energy?: number } }>)[sp]?.baseStats?.energy;
    if (typeof e === 'number') PRISTINE.set(sp, e);
}
if (!PRISTINE.has(SPECIES)) throw new Error(`energyshard: no baseStats.energy for '${SPECIES}'`);

/** Set one species' energy from the firmware that side is running, and return what it became. */
function applyFor(species: string, deck: string): number {
    const base = PRISTINE.get(species);
    if (base === undefined) throw new Error(`energyshard: no pristine energy for '${species}'`);
    const want = base + (UNDERPERFORMERS.has(deck) ? 1 : 0);
    (MingmingRegistry as Record<string, { baseStats: { energy: number } }>)[species].baseStats.energy = want;
    return want;
}

const opponents: Array<{ sp: string; deck: string }> = [];
for (const sp of BALANCE_SPECIES) if (sp !== SPECIES)
    for (const d of MingmingRegistry[sp].availableOS) opponents.push({ sp, deck: d });

let buffedCells = 0;
for (let i = SHARD; i < opponents.length; i += SHARDS) {
    const o = opponents[i];
    // Both sides every cell, so nothing carries over from the previous iteration of this loop.
    const pe = applyFor(SPECIES, DECK);
    const ee = applyFor(o.sp, o.deck);
    if (pe > PRISTINE.get(SPECIES)! || ee > PRISTINE.get(o.sp)!) buffedCells++;

    const r = runPairedBatch(matchupScenario({
        player: SPECIES, enemy: o.sp, playerOS: DECK, enemyOS: o.deck,
        seed: `${SEEDBASE}:${DECK}:${o.deck}`,
    }), { iterations: ITER });

    // Field order matches gridshard's exactly, then appends the two energies. `energygrid.mjs`
    // reads by position and re-checks the energies against its own copy of the buff list, so a
    // shard that silently failed to patch cannot be merged as if it had.
    console.log([`CELL`, i, o.deck,
        (r.pooled.decisiveWinRate * 100).toFixed(2),
        r.pooled.iterations, r.pooled.decisive,
        r.pooled.averageTurns.toFixed(2), r.pooled.ftkCount,
        r.pooled.deadCardRatio.toFixed(4),
        pe, ee].join(','));
}

// Every shard of every row must touch at least one buffed side: the nine buffed decks are spread
// across seven species, so no 30-opponent row can avoid them all. Zero means the set never matched
// and the whole lane measured the unmodified game.
if (buffedCells === 0) throw new Error(`energyshard: ${DECK} shard ${SHARD} buffed NOTHING`);
console.log(`ARMCHECK,${DECK},${SHARD},buffedCells=${buffedCells}`);
