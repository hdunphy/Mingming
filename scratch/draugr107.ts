/**
 * Ticket 107: which of the two changes moved the tug-of-war, and by how much.
 *
 * Shipped together they overshoot enormously - THE cell (`draugr_v2` vs `huldra_v1`) went from
 * 6.7% to 90%, where the ticket's target band is 15-35%, and her field went 58.3% -> 83.8% with
 * eighteen blowout matchups. The ticket's knobs both point UP (rimebreaker 20 -> 15 or 25, rider
 * Poison 1 -> 2), because it expected the changes to UNDERshoot. They need to be measured apart
 * before anything is tuned.
 *
 * env: RIME (any|debuff|off-power), RIDER (0|1|2), CELL_ONLY, ITER
 */
import PROGRAMS from '../src/engine/data/programs.json';
import HOOKS from '../src/engine/data/lib/hooks.json';
import { ENV } from './_env';

const P = PROGRAMS as unknown as Record<string, { actions: Array<Record<string, unknown>> }>;
const H = HOOKS as unknown as Record<string, { hooks: Array<Record<string, unknown>> }>;

/** rimebreaker: `any` = the rework, `debuff` = as it was, plus an explicit power override. */
const RIME = ENV.RIME ?? 'any';
const RIME_POWER = Number(ENV.RIME_POWER ?? (RIME === 'any' ? 20 : 25));
(P.rimebreaker.actions[0] as Record<string, unknown>).scaling = RIME === 'any' ? 'ANY_STATUS' : 'DISTINCT_STATUS';
(P.rimebreaker.actions[0] as Record<string, unknown>).power = RIME_POWER;

/** The Poison rider: 0 removes the hook entirely, N sets its stack count. */
const RIDER = Number(ENV.RIDER ?? 1);
if (RIDER === 0) {
    H.draugr_v2.hooks = H.draugr_v2.hooks.filter(h => h.id !== 'draugr_v2_seep');
} else {
    const seep = H.draugr_v2.hooks.find(h => h.id === 'draugr_v2_seep');
    if (seep) {
        (seep.do as Array<Record<string, unknown>>)[0].stacks = RIDER;
        // RIDER_MINCOST: fire only on statuses applied by a card costing at least N Energy. A
        // CONDITION, not a cap - `rimefrost` is a 0-cost card applying TWO statuses and she runs
        // two copies, so it is the single highest-volume source feeding the rider.
        // RIDER_ONLY: fire only on ONE named status. A condition, not a cap, and it needs no
        // program in the hook context - which `baseCost` does, and `onStatusApplied` does not
        // provide, so RIDER_MINCOST silently disables the hook entirely (see the report).
        if (ENV.RIDER_ONLY) {
            (seep.when as Record<string, unknown>).statusApplied = ENV.RIDER_ONLY;
        }
        if (ENV.RIDER_MINCOST) {
            (seep.when as Record<string, unknown>).baseCost =
                { operator: 'GTE', value: Number(ENV.RIDER_MINCOST) };
        }
    }
}

const { runPairedBatch } = await import('../src/debug/balance/runBatch');
const { matchupScenario, BALANCE_SPECIES } = await import('../src/debug/balance/balanceScenarios');
const { MingmingRegistry } = await import('../src/engine/data/mingmingRegistry');

const ITER = Number(ENV.ITER ?? 30);
const label = `rime ${RIME}/${RIME_POWER}  rider ${RIDER}`;

// THE cell first - it is the gate, and it is cheap.
const cell = (seedTag: string) => runPairedBatch(matchupScenario({
    player: 'draugr', enemy: 'huldra', playerOS: 'draugr_v2', enemyOS: 'huldra_v1',
    seed: `${seedTag}:draugr_v2:huldra_v1`,
}), { iterations: ITER }).pooled.decisiveWinRate * 100;
const a = cell('grid'); const b = cell('alt');
console.error(`\nDRAUGR ${label}`);
console.error(`  THE CELL draugr_v2 vs huldra_v1   ${a.toFixed(1)}% / ${b.toFixed(1)}%   (target 15-35, was 6.7)`);

if (ENV.CELL_ONLY) process.exit(0);

for (const deck of ['draugr_v2', 'huldra_v1']) {
    const sp = deck.replace(/_v[12]$/, '');
    const opponents: Array<{ sp: string; deck: string }> = [];
    for (const s of BALANCE_SPECIES) if (s !== sp)
        for (const d of MingmingRegistry[s].availableOS) opponents.push({ sp: s, deck: d });
    let sum = 0; const cells: number[] = [];
    for (const o of opponents) {
        const r = runPairedBatch(matchupScenario({
            player: sp, enemy: o.sp, playerOS: deck, enemyOS: o.deck, seed: `grid:${deck}:${o.deck}`,
        }), { iterations: 10 });
        sum += r.pooled.decisiveWinRate; cells.push(r.pooled.decisiveWinRate * 100);
    }
    console.error(`  ${deck.padEnd(12)} field ${((sum / opponents.length) * 100).toFixed(1)}%   ` +
        `absolutes ${cells.filter(c => c >= 100 || c <= 0).length}`);
}
console.error(`CSV,${RIME},${RIME_POWER},${RIDER},${a.toFixed(2)},${b.toFixed(2)}`);
