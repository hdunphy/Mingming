/** Ticket 103: audhumbla_v2 arms, priced AND simmed, after the 2e purify made her worse (27.6%). */
import PROGRAMS from '../src/engine/data/programs.json';
const P = PROGRAMS as unknown as Record<string, { baseCost: number; actions: unknown[] }>;
const S = (st: string, n: number, t = 'SELF') => ({ type: 'STATUS', status: st, stacks: n, target: t });
const ARM = process.env.ARM ?? 'V0';
let STAT_ATTACK = 0;

switch (ARM) {
    case 'V0':  // purify back to 1e as printed
        P.purify.baseCost = 1;
        P.purify.actions = [S('Poison', -2), S('Burn', -2)];
        break;
    case 'V1':  // 1e, the shed trimmed so it prices at 3.3 (+0.3) instead of 6.5 (+3.5)
        P.purify.baseCost = 1;
        P.purify.actions = [S('Poison', -1), S('Burn', -1), S('Weakened', -2), S('Dazed', -2)];
        break;
    case 'V2':  // 1e, the full first-cut shed + Sharp (6.5, +3.5 OVER) - the field-best arm
        P.purify.baseCost = 1;
        P.purify.actions = [S('Poison', -2), S('Burn', -2), S('Weakened', -3), S('Dazed', -3), S('Sharp', 2)];
        break;
    case 'V3':  // purify as printed at 1e, and the Sharp moved onto her 0-cost heal instead
        P.purify.baseCost = 1;
        P.purify.actions = [S('Poison', -2), S('Burn', -2)];
        P.pale_mercy.actions = [...P.pale_mercy.actions, S('Sharp', 1)];
        break;
    case 'V4':  // V1 plus the 0-cost Sharp: a shed she can afford AND a trickle of the currency
        P.purify.baseCost = 1;
        P.purify.actions = [S('Poison', -1), S('Burn', -1), S('Weakened', -2), S('Dazed', -2)];
        P.pale_mercy.actions = [...P.pale_mercy.actions, S('Sharp', 1)];
        break;
    case 'V5':
    case 'V6':
    case 'V7':
        // The stat lever Henry offered. Her attack is 60 - the LOWEST on the roster, against a
        // median of 85 - and her whole problem is that she cannot close: 9 turns a game, 9 to 12
        // absolutes. A clock costs no card budget at all.
        P.purify.baseCost = 1;
        P.purify.actions = [S('Poison', -2), S('Burn', -2)];
        STAT_ATTACK = ARM === 'V5' ? 70 : ARM === 'V6' ? 75 : 80;
        break;
    default: throw new Error(ARM);
}

const { calculatePowerscale, budgetBandFor } = await import('../src/debug/balance/powerscale');
const { ProgramRegistry } = await import('../src/engine/data/programRegistry');
for (const id of ['purify', 'pale_mercy']) {
    const c = (ProgramRegistry as Record<string, any>)[id];
    const s = calculatePowerscale(c).score ?? 0; const b = budgetBandFor(c.baseCost);
    console.error(`  price ${id.padEnd(12)}${c.baseCost}e ${s.toFixed(1).padStart(6)}  band ${b.under}-${b.over}  ` +
        (s > b.over ? 'OVER' : s < b.under ? 'UNDER' : 'IN BAND'));
}

const { runPairedBatch } = await import('../src/debug/balance/runBatch');
const { matchupScenario, BALANCE_SPECIES } = await import('../src/debug/balance/balanceScenarios');
const { MingmingRegistry } = await import('../src/engine/data/mingmingRegistry');
if (STAT_ATTACK) (MingmingRegistry.audhumbla.baseStats as { attack: number }).attack = STAT_ATTACK;
const opponents: Array<{ sp: string; deck: string }> = [];
for (const sp of BALANCE_SPECIES) if (sp !== 'audhumbla')
    for (const d of MingmingRegistry[sp].availableOS) opponents.push({ sp, deck: d });
let sum = 0, dead = 0, turns = 0; const cells: number[] = [];
for (const o of opponents) {
    const r = runPairedBatch(matchupScenario({
        player: 'audhumbla', enemy: o.sp, playerOS: 'audhumbla_v2', enemyOS: o.deck,
        seed: `grid:audhumbla_v2:${o.deck}`,
    }), { iterations: Number(process.env.ITER ?? 10) });
    sum += r.pooled.decisiveWinRate; dead += r.pooled.deadCardRatio; turns += r.pooled.averageTurns;
    cells.push(r.pooled.decisiveWinRate * 100);
}
const n = opponents.length;
console.error(`audhumbla_v2 ${ARM}  field ${((sum / n) * 100).toFixed(1)}%   dead ${((dead / n) * 100).toFixed(1)}%` +
    `   turns ${(turns / n).toFixed(2)}   absolutes ${cells.filter(c => c >= 100 || c <= 0).length}`);
