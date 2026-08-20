/**
 * Ticket 103, second half: light tuning for the four decks that fell out of band after the status
 * re-denomination.
 *
 * Henry: *"try some light tuning for the worst decks. Add some riders to cards or a consume/cleanse
 * effect. Maybe they need a buff or a stat buff."*
 *
 * The four: `kraken_v2` 29.7%, `audhumbla_v2` 31.2%, `skoll_v2` 34.3%, `ratatoskr_v1` 35.0%. The
 * ticket-102 second-axis read says why three of them fell - they hold none of the currency that
 * just doubled in value. `skoll_v2` is the odd one out: it is FULL of Strengthened, and its OS caps
 * the payoff at 5 stacks, so the one deck built to hoard is the one deck that cannot cash a big
 * pile. Every arm here is a rider, a shed, a cap removal or a stat - nothing structural.
 *
 * env: ARM (required), ITER (default 10), STEP (opponent spread, default 1 = all)
 */
import PROGRAMS from '../src/engine/data/programs.json';

const ARM = process.env.ARM ?? 'live';
const P = PROGRAMS as unknown as Record<string, { actions: unknown[]; description?: string }>;

/** Which deck this arm is measuring - set by the switch below. */
let DECK = '';
let STAT_PATCH: null | ((stats: Record<string, number>) => void) = null;
let CAP_PATCH = 0;

const rider = (card: string, action: Record<string, unknown>) => { P[card].actions = [...P[card].actions, action]; };
const SHARP = (n: number) => ({ type: 'STATUS', status: 'Sharp', stacks: n, target: 'SELF' });
const WEAKEN = (n: number) => ({ type: 'STATUS', status: 'Weakened', stacks: n, target: 'TARGET' });
const DAZE = (n: number) => ({ type: 'STATUS', status: 'Dazed', stacks: n, target: 'TARGET' });

switch (ARM) {
    // ---------------- kraken_v2: 8 cards, all expensive, 58 HP, one Dazed in the whole deck ------
    case 'K0': DECK = 'kraken_v2'; break;
    case 'K1': DECK = 'kraken_v2'; STAT_PATCH = s => { s.hp = 70; }; break;
    case 'K2': DECK = 'kraken_v2'; rider('surge_protection', SHARP(2)); break;
    case 'K3': DECK = 'kraken_v2'; rider('capacitor', SHARP(3)); break;
    case 'K4': DECK = 'kraken_v2'; rider('surge_protection', SHARP(2)); rider('capacitor', SHARP(3)); break;
    case 'K5': DECK = 'kraken_v2'; STAT_PATCH = s => { s.hp = 70; }; rider('surge_protection', SHARP(2)); break;
    case 'K6': DECK = 'kraken_v2'; rider('maelstrom', DAZE(2)); rider('surge_protection', SHARP(2)); break;

    // ---------------- audhumbla_v2: zero duality cards in the whole deck ------------------------
    case 'U0': DECK = 'audhumbla_v2'; break;
    case 'U1': DECK = 'audhumbla_v2'; rider('dawnstrike', WEAKEN(2)); break;
    case 'U2': DECK = 'audhumbla_v2'; rider('sacred_spring', SHARP(4)); break;
    case 'U3': DECK = 'audhumbla_v2'; rider('dawnstrike', WEAKEN(2)); rider('sacred_spring', SHARP(4)); break;
    case 'U4': DECK = 'audhumbla_v2';
        // The cleanse arm: `purify` already sheds Poison and Burn. Extend it to the duality debuffs
        // and let it convert - shed what is on you, and take Sharp for the trouble.
        rider('purify', { type: 'STATUS', status: 'Weakened', stacks: -3, target: 'SELF' });
        rider('purify', { type: 'STATUS', status: 'Dazed', stacks: -3, target: 'SELF' });
        rider('purify', SHARP(2));
        break;
    case 'U5': DECK = 'audhumbla_v2'; rider('dawnstrike', WEAKEN(2)); rider('sacred_spring', SHARP(4));
        rider('purify', { type: 'STATUS', status: 'Weakened', stacks: -3, target: 'SELF' });
        rider('purify', { type: 'STATUS', status: 'Dazed', stacks: -3, target: 'SELF' });
        break;

    // ---------------- skoll_v2: full of Strengthened, and capped at 5 ---------------------------
    case 'S0': DECK = 'skoll_v2'; break;
    case 'S1': DECK = 'skoll_v2'; CAP_PATCH = 8; break;
    case 'S2': DECK = 'skoll_v2'; CAP_PATCH = 99; break;   // the cap removed outright
    case 'S3': DECK = 'skoll_v2';
        // `glass_cannon` is the single most under-budget card in the registry at -5.1: 45 power for
        // 20 self-damage on a 55-defense frame. Pay it what its band says.
        (P.glass_cannon.actions as Array<Record<string, unknown>>)[0].power = 60;
        break;
    case 'S4': DECK = 'skoll_v2'; CAP_PATCH = 99;
        (P.glass_cannon.actions as Array<Record<string, unknown>>)[0].power = 60;
        break;

    // ---------------- ratatoskr_v1: 7 zero-cost cards, no pile to show for them -----------------
    case 'R0': DECK = 'ratatoskr_v1'; break;
    case 'R1': DECK = 'ratatoskr_v1'; rider('forage', WEAKEN(1)); break;
    case 'R2': DECK = 'ratatoskr_v1'; rider('shrug_off', SHARP(3)); break;
    case 'R3': DECK = 'ratatoskr_v1'; rider('forage', WEAKEN(1)); rider('shrug_off', SHARP(3)); break;
    case 'R4': DECK = 'ratatoskr_v1'; rider('forage', WEAKEN(1)); rider('shrug_off', SHARP(3));
        rider('healing_mist', SHARP(1)); break;

    default: throw new Error(`unknown ARM ${ARM}`);
}

if (CAP_PATCH) {
    const cf = await import('../src/engine/core/CustomFirmware');
    cf.__setSkollStrengthCap(CAP_PATCH);
}

const { runPairedBatch } = await import('../src/debug/balance/runBatch');
const { matchupScenario, BALANCE_SPECIES } = await import('../src/debug/balance/balanceScenarios');
const { MingmingRegistry } = await import('../src/engine/data/mingmingRegistry');

const SPECIES = DECK.replace(/_v[12]$/, '');
if (STAT_PATCH) STAT_PATCH(MingmingRegistry[SPECIES].baseStats as unknown as Record<string, number>);

const ITER = Number(process.env.ITER ?? 10);
const STEP = Number(process.env.STEP ?? 1);

const opponents: Array<{ sp: string; deck: string }> = [];
for (const sp of BALANCE_SPECIES) if (sp !== SPECIES)
    for (const d of MingmingRegistry[sp].availableOS) opponents.push({ sp, deck: d });
const sample = opponents.filter((_, i) => i % STEP === 0);

let sum = 0, dead = 0, turns = 0;
const cells: Array<{ opponent: string; win: number }> = [];
for (const o of sample) {
    const r = runPairedBatch(matchupScenario({
        player: SPECIES, enemy: o.sp, playerOS: DECK, enemyOS: o.deck, seed: `grid:${DECK}:${o.deck}`,
    }), { iterations: ITER });
    sum += r.pooled.decisiveWinRate; dead += r.pooled.deadCardRatio; turns += r.pooled.averageTurns;
    cells.push({ opponent: o.deck, win: r.pooled.decisiveWinRate * 100 });
}
const field = (sum / sample.length) * 100;
cells.sort((a, b) => b.win - a.win);
const blowouts = cells.filter(c => c.win >= 100 || c.win <= 0).length;
console.error(`\n${DECK} ${ARM.padEnd(4)} field ${field.toFixed(1)}%   opp ${sample.length}` +
    `   dead ${((dead / sample.length) * 100).toFixed(1)}%   turns ${(turns / sample.length).toFixed(2)}   absolutes ${blowouts}`);
console.error(`  worst ${cells.slice(-3).map(c => `${c.opponent} ${c.win.toFixed(0)}%`).join('  ')}`);
console.error(`CSV,${DECK},${ARM},${field.toFixed(2)},${((dead / sample.length) * 100).toFixed(2)},${(turns / sample.length).toFixed(3)},${blowouts}`);
