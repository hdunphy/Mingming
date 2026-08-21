/**
 * Ticket 95: the two-shape status grid.
 *
 * Henry, after playing: *"the statuses don't feel very noticeable. Like a very small change in
 * damage output maybe 1-2 dmg once you hit the cap."* Live, the four duality statuses are 2% per
 * stack against a +-25% cap, which at level 15 is one or two points of damage. His proposal is to
 * re-denominate them in POWER - +1 per stack on the relevant side, uncapped, with the duality
 * cancel and the sheds as the valve instead of a ceiling.
 *
 * This measures both shapes on the decks and the cells where statuses actually decide something,
 * rather than on the whole roster - the point is not a new field ranking, it is whether statuses
 * become a resource worth spending a card on without breaking the three known danger spots.
 *
 * THE THREE NAMED EXHIBITS, from the ticket:
 *   - the DRAUGR TUG-OF-WAR: `draugr_v2` vs `huldra_v1`. His payoff counts distinct debuffs; her
 *     Sharp annihilates his Dazed stack for stack, so his payoff read 4 damage in Henry's hands.
 *     Under POWER the cancel is the only bound, so this cell is where "no cap" gets tested.
 *   - the GULLINBURSTI WALL: `gullinbursti_v1` vs `fafnir_v2` and vs `audhumbla_v2`, two of the
 *     absolute cells from ticket 94. He holds up to 13 Sharp; at +1 power a stack that is -13
 *     power off every incoming card, which is a very different wall from -25%.
 *   - the RAW-STACK SCALERS: `skoll_v2` (+15% damage per Strength stack) and `gullinbursti_v2`
 *     (damage per Sharp stack) already read the raw count. Under POWER their stacks pay twice -
 *     once through the scaler, once through the power - which is the double-dip the ticket flags.
 *
 * env: SHAPE=PERCENT|POWER, PCT (per stack, e.g. 0.04), CAP (e.g. 0.40), PWR (e.g. 1), LABEL
 */
import { STATUS_MODEL } from '../src/engine/core/Hooks';

const SHAPE = (process.env.SHAPE ?? 'PERCENT') as 'PERCENT' | 'POWER';
STATUS_MODEL.shape = SHAPE;
if (process.env.PCT) STATUS_MODEL.pctPerStack = Number(process.env.PCT);
if (process.env.CAP) STATUS_MODEL.pctCap = Number(process.env.CAP);
if (process.env.PWR) STATUS_MODEL.powerPerStack = Number(process.env.PWR);
const LABEL = process.env.LABEL ?? (SHAPE === 'POWER'
    ? `POWER+${STATUS_MODEL.powerPerStack}`
    : `PCT${(STATUS_MODEL.pctPerStack * 100).toFixed(0)}/cap${(STATUS_MODEL.pctCap * 100).toFixed(0)}`);

const { runPairedBatch } = await import('../src/debug/balance/runBatch');
const { matchupScenario, BALANCE_SPECIES } = await import('../src/debug/balance/balanceScenarios');
const { MingmingRegistry } = await import('../src/engine/data/mingmingRegistry');

const ITER_FIELD = Number(process.env.ITER ?? 8);
const ITER_CELL = Number(process.env.ITER_CELL ?? 20);

/** The decks whose PLAN is statuses - where a re-denomination should show up first. */
const STATUS_DECKS = [
    'gullinbursti_v1',   // Sharp + shield wall
    'gullinbursti_v2',   // damage per Sharp stack - a raw-stack scaler
    'skoll_v2',          // +15% damage per Strength stack - the other raw-stack scaler
    'draugr_v2',         // payoff counts DISTINCT debuffs - the tug-of-war deck
    'huldra_v1',         // hands out Weakened and Sharp; the other side of the tug-of-war
    'sleipnir_v1',       // MOMENTUM_DRIVE turns 0-cost cards into Strengthened
];

/** The cells the ticket names, as `deck vs opponent`. */
const EXHIBITS: Array<[string, string]> = [
    ['draugr_v2', 'huldra_v1'],
    ['gullinbursti_v1', 'fafnir_v2'],
    ['gullinbursti_v1', 'audhumbla_v2'],
];

const speciesOf = (deck: string) => deck.replace(/_v[12]$/, '');

function fieldOf(deck: string): number {
    const species = speciesOf(deck);
    const opponents: Array<{ sp: string; deck: string }> = [];
    for (const sp of BALANCE_SPECIES) if (sp !== species)
        for (const d of MingmingRegistry[sp].availableOS) opponents.push({ sp, deck: d });
    // Every third opponent: a spread, and the same spread for every arm so the columns compare.
    const sample = opponents.filter((_, i) => i % 3 === 0);
    let sum = 0;
    for (const o of sample) {
        const r = runPairedBatch(matchupScenario({
            player: species, enemy: o.sp, playerOS: deck, enemyOS: o.deck,
            seed: `grid:${deck}:${o.deck}`,
        }), { iterations: ITER_FIELD });
        sum += r.pooled.decisiveWinRate;
    }
    return (sum / sample.length) * 100;
}

function cellOf(deck: string, opponent: string): number {
    const r = runPairedBatch(matchupScenario({
        player: speciesOf(deck), enemy: speciesOf(opponent),
        playerOS: deck, enemyOS: opponent, seed: `grid:${deck}:${opponent}`,
    }), { iterations: ITER_CELL });
    return r.pooled.decisiveWinRate * 100;
}

const fields = STATUS_DECKS.map(d => ({ deck: d, field: fieldOf(d) }));
const cells = EXHIBITS.map(([d, o]) => ({ deck: d, opponent: o, win: cellOf(d, o) }));

console.error(`\nSTATUS ${LABEL}`);
for (const f of fields) console.error(`  ${f.deck.padEnd(18)}${f.field.toFixed(1).padStart(6)}%`);
for (const c of cells) console.error(`  ${c.deck} vs ${c.opponent}`.padEnd(46) + `${c.win.toFixed(1).padStart(6)}%`);
console.error(`CSV,${LABEL},${fields.map(f => f.field.toFixed(1)).join(',')},${cells.map(c => c.win.toFixed(1)).join(',')}`);
