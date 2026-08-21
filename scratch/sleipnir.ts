/**
 * Ticket 103: bound sleipnir_v1's MINT - with NO caps of any kind, per-turn included.
 *
 * Henry: *"can you do a run of balancing sleipnir except no caps not even per turn. Try reducing
 * his number per card, then try a consume str for damage, and also try adding a debuff if those
 * don't work."*
 *
 * He is at 83.9% field after ticket 102 because MOMENTUM_DRIVE mints 2 Strengthened per 0-cost
 * card and 5 of his 12 cards cost 0 - a measured pile of mean 4.85 / peak 24, against a ~40-power
 * 1e card. Every arm here leaves the pile UNBOUNDED. What changes is the rate it fills at, whether
 * it drains, or what it costs to hold.
 *
 * ARMS
 *   live  MOMENTUM_DRIVE as shipped: 2 Strengthened per 0-cost card.
 *   A1    the same hook at 1 stack. The straight rate cut.
 *   A2    2 stacks, but only on 0-cost ATTACKS - a CONDITION, not a cap. His utility 0-costs
 *         (slipstream, disorienting_gust) stop minting; the engine still runs on his attacks.
 *   B1    2 stacks, plus: when he attacks, CONSUME the whole Strengthened pile and convert it to
 *         one bonus hit at 1 power per stack. The pile becomes ammo he cashes, not a permanent
 *         multiplier he sits on. Uncapped - a bigger pile is a bigger hit.
 *   B2/B3/B4  the same at 2 / 5 / 8 power per consumed stack: cashing worth progressively more
 *         than holding, which is what makes building the pile before spending it worth doing.
 *   B5    the pile LEAKS - one stack spent per attack, no bonus. Uncapped; just not permanent.
 *   B6/B7/B8  HOLD-OR-CASH: `momentum_crash` CONSUMES the pile instead of just reading it, at
 *         8 / 12 / 15 power per stack. The player picks the turn. `sun_devourer`'s pattern.
 *   C1    2 stacks, plus 1 Dazed on himself per mint. Stacking makes him fragile - a price, not a
 *         ceiling. This is gullinbursti_v2's KINETIC_RAM shape, which is already proven here.
 *   C2    the same at 2 Dazed per mint - the price matches the mint exactly.
 *
 * env: ARM (default live), ITER (seeds per opponent, default 8), STEP (opponent spread, default 3)
 */
import HOOKS_DATA from '../src/engine/data/lib/hooks.json';
import PROGRAMS from '../src/engine/data/programs.json';

const ARM = process.env.ARM ?? 'live';
const hooks = HOOKS_DATA as unknown as Record<string, { hooks: Array<Record<string, unknown>> }>;
const mint = hooks.sleipnir_v1.hooks[0];

const CONSUME_AND_SWING = (powerPerStack: number) => ({
    id: 'sleipnir_v1_cash',
    trigger: 'onActionStart',
    priority: 30,          // AFTER the mint (40) so a 0-cost attack banks before it cashes.
    when: { source: 'SELF', actionType: 'ATTACK' },
    do: [
        { type: 'STATUS', target: 'SELF', status: 'Strengthened', consume: true },
        { type: 'ATTACK', target: 'TARGET', element: 'Air', power: powerPerStack, scaling: 'STATUS_CONSUMED' },
    ],
});

switch (ARM) {
    case 'live': break;
    case 'A1':
        (mint.do as Array<Record<string, unknown>>)[0].stacks = 1;
        break;
    case 'A2':
        // NOTE: `isAttack` is declared in HookSchema but NOTHING in the engine reads it - a
        // condition key that silently does nothing. `actionType` is the one that works.
        (mint.when as Record<string, unknown>).actionType = 'ATTACK';
        break;
    case 'B1':
        hooks.sleipnir_v1.hooks.push(CONSUME_AND_SWING(1));
        break;
    case 'B2':
        hooks.sleipnir_v1.hooks.push(CONSUME_AND_SWING(2));
        break;
    case 'B3':
        hooks.sleipnir_v1.hooks.push(CONSUME_AND_SWING(5));
        break;
    case 'B4':
        hooks.sleipnir_v1.hooks.push(CONSUME_AND_SWING(8));
        break;
    case 'B6':
    case 'B7':
    case 'B8': {
        // The HOLD-OR-CASH shape. `momentum_crash` already reads the pile (8 power per Strengthened
        // stack) but does not SPEND it, so under POWER it is pure upside on top of a permanent
        // multiplier. Making it consume is `sun_devourer`'s exact pattern, and it turns the pile
        // into a decision: every stack is worth +1 power on everything until the turn you cash it.
        const power = ARM === 'B6' ? 8 : ARM === 'B7' ? 12 : 15;
        (PROGRAMS as unknown as Record<string, { actions: unknown[] }>).momentum_crash.actions = [
            { type: 'STATUS', status: 'Strengthened', consume: true, target: 'SELF' },
            { type: 'ATTACK', power, scaling: 'STATUS_CONSUMED', target: 'TARGET' },
        ];
        break;
    }
    case 'B5':
        // The pile LEAKS instead of being dumped: every attack spends one stack. Uncapped, and it
        // still rewards building - it just stops the pile from being permanent.
        hooks.sleipnir_v1.hooks.push({
            id: 'sleipnir_v1_leak',
            trigger: 'onActionStart',
            priority: 30,
            when: { source: 'SELF', actionType: 'ATTACK' },
            do: [{ type: 'STATUS', target: 'SELF', status: 'Strengthened', stacks: -1 }],
        });
        break;
    case 'C1':
    case 'C2':
        (mint.do as Array<Record<string, unknown>>).push({
            type: 'STATUS', target: 'SELF', status: 'Dazed', stacks: ARM === 'C1' ? 1 : 2,
        });
        break;
    case 'A1B6':
    case 'A1B8': {
        // The candidate ship: the rate cut that actually bounds him, PLUS the hold-or-cash card.
        // A1 does the balancing; the consume turns `momentum_crash` from free upside on a permanent
        // multiplier into the turn he decides to spend the engine.
        (mint.do as Array<Record<string, unknown>>)[0].stacks = 1;
        const power = ARM === 'A1B6' ? 8 : 15;
        (PROGRAMS as unknown as Record<string, { actions: unknown[] }>).momentum_crash.actions = [
            { type: 'STATUS', status: 'Strengthened', consume: true, target: 'SELF' },
            { type: 'ATTACK', power, scaling: 'STATUS_CONSUMED', target: 'TARGET' },
        ];
        break;
    }
    case 'A1B5':
        (mint.do as Array<Record<string, unknown>>)[0].stacks = 1;
        hooks.sleipnir_v1.hooks.push({
            id: 'sleipnir_v1_leak', trigger: 'onActionStart', priority: 30,
            when: { source: 'SELF', actionType: 'ATTACK' },
            do: [{ type: 'STATUS', target: 'SELF', status: 'Strengthened', stacks: -1 }],
        });
        break;
    case 'R4':
    case 'R5':
    case 'R6': {

/**
 * TICKET 103 ramp arm, off Henry's round-3 feel note: *"the problem is EARLY VELOCITY, not the
 * ceiling"*. Mint 1 per 0-cost card always, and a SECOND stack per 0-cost card once he already
 * holds RAMP_AT. That is a CONDITION, not a cap: it slows the opener and leaves the late climb
 * alone, which is the exact shape he described enjoying (4 -> 14 -> 22 over five turns).
 */
        (mint.do as Array<Record<string, unknown>>)[0].stacks = 1;
        (PROGRAMS as unknown as Record<string, { actions: unknown[] }>).momentum_crash.actions = [
            { type: 'STATUS', status: 'Strengthened', consume: true, target: 'SELF' },
            { type: 'ATTACK', power: 8, scaling: 'STATUS_CONSUMED', target: 'TARGET' },
        ];
        hooks.sleipnir_v1.hooks.push({
            id: 'sleipnir_v1_ramp', trigger: 'onActionStart', priority: 39,
            when: { source: 'SELF', baseCost: 0, sourceStatus: { status: 'Strengthened', minStacks: Number(ARM.slice(1)) } },
            do: [{ type: 'STATUS', target: 'SELF', status: 'Strengthened', stacks: 1 }],
        });
        break;
    }
    default: throw new Error(`unknown ARM ${ARM}`);
}

// Everything downstream is imported AFTER the mutation: `firmwareRegistry` builds its hooks once,
// on first import, straight off this JSON object.
const { runPairedBatch } = await import('../src/debug/balance/runBatch');
const { matchupScenario, BALANCE_SPECIES } = await import('../src/debug/balance/balanceScenarios');
const { MingmingRegistry } = await import('../src/engine/data/mingmingRegistry');

const ITER = Number(process.env.ITER ?? 8);
const STEP = Number(process.env.STEP ?? 3);
const DECK = 'sleipnir_v1';

const opponents: Array<{ sp: string; deck: string }> = [];
for (const sp of BALANCE_SPECIES) if (sp !== 'sleipnir')
    for (const d of MingmingRegistry[sp].availableOS) opponents.push({ sp, deck: d });
const sample = opponents.filter((_, i) => i % STEP === 0);

let sum = 0;
let dead = 0;
let turns = 0;
const cells: Array<{ opponent: string; win: number }> = [];
for (const o of sample) {
    const r = runPairedBatch(matchupScenario({
        player: 'sleipnir', enemy: o.sp, playerOS: DECK, enemyOS: o.deck, seed: `grid:${DECK}:${o.deck}`,
    }), { iterations: ITER });
    sum += r.pooled.decisiveWinRate;
    dead += r.pooled.deadCardRatio;
    turns += r.pooled.averageTurns;
    cells.push({ opponent: o.deck, win: r.pooled.decisiveWinRate * 100 });
}
const field = (sum / sample.length) * 100;

cells.sort((a, b) => b.win - a.win);
const blowouts = cells.filter(c => c.win >= 100 || c.win <= 0).length;
console.error(`\nSLEIPNIR ${ARM.padEnd(5)} field ${field.toFixed(1)}%   over ${sample.length} opponents` +
    `   dead ${((dead / sample.length) * 100).toFixed(1)}%   turns ${(turns / sample.length).toFixed(2)}` +
    `   absolutes ${blowouts}`);
console.error(`  best  ${cells.slice(0, 3).map(c => `${c.opponent} ${c.win.toFixed(0)}%`).join('  ')}`);
console.error(`  worst ${cells.slice(-3).map(c => `${c.opponent} ${c.win.toFixed(0)}%`).join('  ')}`);
console.error(`CSV,${ARM},${field.toFixed(2)},${((dead / sample.length) * 100).toFixed(2)},${(turns / sample.length).toFixed(3)},${blowouts}`);
