/**
 * TICKET 129 - whirlpool_v2 arms, measured on kraken_v1's field.
 *
 * Henry: *"whirlpool seems very under powered. Especially compared to pressure point. I almost never
 * play it unless I have extra energy. It should have another rider maybe side wide dazed or
 * weakened."*
 *
 * He is right and the scorer agrees: at 1e, `whirlpool_v2` (8 power, draw 1) scores **2.2** against a
 * 2.4-3.0 band while `pressure_point` (22 power, conditional draw 1) scores **3.1**. Same cost, a 41%
 * relative gap, and both sit in kraken_v1 twice over. A price is not a field result though, so this
 * runs the arms.
 *
 * ARMS
 *   SHIPPED        8 power, draw 1                              scores 2.2  (under by 19%)
 *   DAZED1         + 1 Dazed, single target                     scores 2.7  (dead centre)
 *   POWER15        power 8 -> 15, no rider                      scores 2.9  (top of band)
 *   SIDEDAZED      + 1 Dazed, scope Side                        scores 4.2  (over by 56%)
 *
 * SIDEDAZED is included even though it prices badly because it is what Henry asked for, and because
 * the scorer's Side multiplier is the known-width-blind x2.2 of ticket 119 - it reads the same at
 * 1v1 and 3v3 when the measured truth is ~1x and ~4.5x. So its score is the least trustworthy number
 * in the list and the field row is the thing worth having.
 *
 * ONE ARM PER PROCESS. `ProgramRegistry` is mutated before the heavy modules load - `GetProgramData`
 * inflates a fresh object per call, so mutating a copy is the ticket-103 dead-arm trap. The arm
 * ASSERTS the mutation took and prints the card it wrote, because four arms in this project have
 * "worked", stayed green and measured nothing.
 *
 * Run: npx vite-node scratch/whirlpoolarms.ts -- --arm DAZED1 --iter 10
 */
import PROGRAMS from '../src/engine/data/programs.json';

function arg(name: string, dflt?: string): string {
    const i = process.argv.indexOf(`--${name}`);
    const v = i === -1 ? undefined : process.argv[i + 1];
    if (v === undefined || v.startsWith('--')) {
        if (dflt === undefined) throw new Error(`whirlpoolarms: --${name} is required`);
        return dflt;
    }
    return v;
}

const ARM = arg('arm');
const ITER = Number(arg('iter', '10'));
const DECK = arg('deck', 'kraken_v1');
const BEAM = arg('beam', '0');
const WIDTH = Number(arg('width', '1'));

const P = 'process', E = 'env';
const penv = ((globalThis as unknown as Record<string, Record<string, Record<string, string>>>)[P] ??= {} as never);
((penv[E] ??= {} as never)).AI_BEAM = BEAM;

type Raw = Record<string, { target: string; description: string; actions: unknown[] }>;
const raw = PROGRAMS as unknown as Raw;
const card = raw['whirlpool_v2'];
if (!card) throw new Error('whirlpoolarms: whirlpool_v2 is not in programs.json');

const ATTACK8 = { type: 'ATTACK', power: 8, target: 'TARGET' };
const DRAW1 = { type: 'DRAW', amount: 1, target: 'SELF' };
const DAZED1 = { type: 'STATUS', status: 'Dazed', stacks: 1, target: 'TARGET' };
const DAZED2 = { type: 'STATUS', status: 'Dazed', stacks: 2, target: 'TARGET' };
const DRAW2 = { type: 'DRAW', amount: 2, target: 'SELF' };

switch (ARM) {
    case 'SHIPPED': break;
    case 'DAZED1':
        card.actions = [ATTACK8, DRAW1, DAZED1];
        card.description = '8 power. Draw a card. Apply 1 Dazed.';
        break;
    case 'POWER15':
        card.actions = [{ ...ATTACK8, power: 15 }, DRAW1];
        card.description = '15 power. Draw a card.';
        break;
    case 'RULED':
        // Henry, 2026-09-01: *"remove the power and make it add dazed and card draw."* Priced at
        // 2.8 against the 1e band (2.4-3.0) - the only no-power shape that lands mid-band. This is
        // the arm that was RULED and, until now, the one shape never actually run.
        card.actions = [DRAW2, DAZED1];
        card.description = 'Draw 2 cards. Apply 1 Dazed.';
        break;
    case 'RULED_DAZED2':
        // The alternative that keeps a single draw: 2 Dazed + draw 1 prices at 2.4, the band floor.
        // Included because Henry's worry is about how much DAZED the card adds, and this trades the
        // extra card for an extra stack - the opposite trade - so the two bracket the concern.
        card.actions = [DRAW1, DAZED2];
        card.description = 'Draw a card. Apply 2 Dazed.';
        break;
    case 'SIDEDAZED':
        card.target = 'Side';
        card.actions = [ATTACK8, DRAW1, DAZED1];
        card.description = '8 power to the side. Draw a card. Apply 1 Dazed to the side.';
        break;
    default:
        throw new Error(`whirlpoolarms: unknown --arm ${ARM}`);
}

async function main(): Promise<void> {
    const { GetProgramData } = await import('../src/engine/data/programRegistry');
    const { runPairedBatch } = await import('../src/debug/balance/runBatch');
    const { matchupScenario, BALANCE_SPECIES } = await import('../src/debug/balance/balanceScenarios');
    const { MingmingRegistry } = await import('../src/engine/data/mingmingRegistry');
    const { calculatePowerscale } = await import('../src/debug/balance/powerscale');

    // ASSERT THE ARM TOOK, through the same accessor the engine uses.
    const live = GetProgramData('whirlpool_v2');
    const gotDazed = live.actions.some(a => (a as { status?: string }).status === 'Dazed');
    // `undefined` is a legitimate expectation now: the ruled arms remove the ATTACK entirely, and
    // "no attack" must be asserted rather than passing silently as "power did not change".
    const gotPower = (live.actions.find(a => a.type === 'ATTACK') as { power?: number } | undefined)?.power;
    const gotDraw = (live.actions.find(a => a.type === 'DRAW') as { amount?: number } | undefined)?.amount;
    const gotDazedStacks = (live.actions.find(a => (a as { status?: string }).status === 'Dazed') as { stacks?: number } | undefined)?.stacks;
    const gotSide = live.target === 'Side';
    const want = {
        SHIPPED: { dazed: false, power: 8, side: false, draw: 1, stacks: undefined },
        DAZED1: { dazed: true, power: 8, side: false, draw: 1, stacks: 1 },
        POWER15: { dazed: false, power: 15, side: false, draw: 1, stacks: undefined },
        SIDEDAZED: { dazed: true, power: 8, side: true, draw: 1, stacks: 1 },
        RULED: { dazed: true, power: undefined, side: false, draw: 2, stacks: 1 },
        RULED_DAZED2: { dazed: true, power: undefined, side: false, draw: 1, stacks: 2 },
    }[ARM]!;
    if (gotDazed !== want.dazed || gotPower !== want.power || gotSide !== want.side
        || gotDraw !== want.draw || gotDazedStacks !== want.stacks) {
        throw new Error(`whirlpoolarms: arm ${ARM} did NOT take - engine sees `
            + `dazed=${gotDazed} power=${gotPower} side=${gotSide} draw=${gotDraw} `
            + `stacks=${gotDazedStacks}, wanted ${JSON.stringify(want)}`);
    }
    console.log(`ARM ${ARM}: engine sees "${live.description}" (target ${live.target}) `
        + `score ${calculatePowerscale(live).score.toFixed(1)}`);

    // 3v3: the only width where the three arms can differ. At 1v1 "Side" IS "Single" - one enemy -
    // so SIDEDAZED and DAZED1 are the same card, which is ticket 119's width-blind multiplier seen
    // from the field rather than from the scorer.
    if (WIDTH === 3) {
        const { teamScenario } = await import('../src/debug/balance/balanceScenarios');
        type Member = readonly [string, string];
        const CTL: Member[] = [['kraken', 'kraken_v1'], ['huldra', 'huldra_v1'], ['draugr', 'draugr_v2']];
        const ZOO: Member[] = [['jormungandr', 'jormungandr_v1'], ['sleipnir', 'sleipnir_v1'], ['hraesvelgr', 'hraesvelgr_v1']];
        const r = runPairedBatch(teamScenario({ player: CTL, enemy: ZOO, seed: 'wp3v3' }), { iterations: ITER });
        console.log(`FIELD3v3,${ARM},control-vs-zoo,${(r.pooled.decisiveWinRate * 100).toFixed(2)},`
            + `turns ${r.pooled.averageTurns.toFixed(2)},decisive ${r.pooled.decisive}`);
        return;
    }

    const SPECIES = DECK.replace(/_v[12]$/, '');
    const opponents: Array<{ sp: string; deck: string }> = [];
    for (const sp of BALANCE_SPECIES) if (sp !== SPECIES)
        for (const d of MingmingRegistry[sp].availableOS) opponents.push({ sp, deck: d });

    let total = 0;
    for (const o of opponents) {
        const r = runPairedBatch(matchupScenario({
            player: SPECIES, enemy: o.sp, playerOS: DECK, enemyOS: o.deck,
            seed: `grid:${DECK}:${o.deck}`,
        }), { iterations: ITER });
        total += r.pooled.decisiveWinRate * 100;
        console.log(`CELL,${ARM},${o.deck},${(r.pooled.decisiveWinRate * 100).toFixed(2)}`);
    }
    console.log(`FIELD,${ARM},${DECK},${(total / opponents.length).toFixed(2)}`);
}

main().catch(e => { console.error(e); process.exit(1); });
