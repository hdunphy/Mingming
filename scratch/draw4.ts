/**
 * Ticket 100: the draw-4 experiment. Wide decks get more cards and weaker ones.
 *
 * Ticket 88's recommendation, green-lit: give `sleipnir_v1` a fourth card of draw and pay for it
 * out of her own cards' power, until she lands in band. The success condition is NOT a win rate -
 * it is *"she plays 4+ cards a turn at a normal win rate AND feels like a different deck"*, with
 * Henry judging the second half. So this reports the **cards-per-turn distribution**, which is the
 * half a field rate cannot see.
 *
 * TWO THINGS HAVE CHANGED SINCE THE TICKET WAS WRITTEN, and both matter:
 *   - It describes sleipnir_v1 as "36.8% field, 20 points behind her sibling". After ticket 103 she
 *     is at **57.7%** and AHEAD of sleipnir_v2 (56.0). The "land ~45%" target is stale; the live
 *     question is whether draw-4-paid-in-power makes her WIDER without making her stronger.
 *   - `cardDraw` is a SPECIES stat, so sleipnir_v2 rides any change to it. Both are reported.
 *
 * env: DRAW (species cardDraw), CUT ("card:power,card:power"), ITER, DECK
 */
import { MingmingRegistry } from '../src/engine/data/mingmingRegistry';
import { ProgramRegistry } from '../src/engine/data/programRegistry';
import { ENV } from './_env';

// DRAW sets the cardDraw of whatever species DECK names - the knob generalises, because the
// interesting question turned out to be WHICH deck the recipe fits, not what sleipnir does with it.
if (ENV.DRAW) {
    const sp = (ENV.DECK ?? 'sleipnir_v1').replace(/_v[12]$/, '');
    (MingmingRegistry[sp] as { cardDraw: number }).cardDraw = Number(ENV.DRAW);
}
// The payback: ticket 88 measured the exchange at ~2-3 cards of power per draw point.
for (const spec of (ENV.CUT ?? '').split(',').filter(Boolean)) {
    const [id, power] = spec.split(':');
    const card = (ProgramRegistry as Record<string, { actions: Array<Record<string, unknown>> }>)[id];
    const attack = card.actions.find(a => a.type === 'ATTACK');
    if (!attack) throw new Error(`${id} has no ATTACK to cut`);
    attack.power = Number(power);
}

const { runPairedBatch } = await import('../src/debug/balance/runBatch');
const { matchupScenario, BALANCE_SPECIES } = await import('../src/debug/balance/balanceScenarios');
const { buildScenarioState } = await import('../src/debug/scenarios/buildScenarioState');
const { deriveSeeds, applyStatJitter } = await import('../src/debug/balance/runBatch');
const { battleReducer } = await import('../src/engine/battleReducer');
const { getBestAction } = await import('../src/engine/ai/TacticalAI');
type St = import('../src/engine/types').IBattleState;

const DECK = ENV.DECK ?? 'sleipnir_v1';
const SPECIES = DECK.replace(/_v[12]$/, '');
const ITER = Number(ENV.ITER ?? 8);

const opponents: Array<{ sp: string; deck: string }> = [];
for (const sp of BALANCE_SPECIES) if (sp !== SPECIES)
    for (const d of MingmingRegistry[sp].availableOS) opponents.push({ sp, deck: d });

// --- field ---
let sum = 0, dead = 0, turns = 0;
const cells: number[] = [];
for (const o of opponents) {
    const r = runPairedBatch(matchupScenario({
        player: SPECIES, enemy: o.sp, playerOS: DECK, enemyOS: o.deck, seed: `grid:${DECK}:${o.deck}`,
    }), { iterations: ITER });
    sum += r.pooled.decisiveWinRate; dead += r.pooled.deadCardRatio; turns += r.pooled.averageTurns;
    cells.push(r.pooled.decisiveWinRate * 100);
}
const n = opponents.length;

// --- cards per turn, the number the ticket actually asks for ---
const perTurn: number[] = [];
for (const o of opponents.filter((_, i) => i % 3 === 0)) {
    const setup = matchupScenario({
        player: SPECIES, enemy: o.sp, playerOS: DECK, enemyOS: o.deck, seed: `cpt:${DECK}:${o.deck}`,
    });
    for (const seed of deriveSeeds(setup.seed, 4)) {
        let st = buildScenarioState({ ...applyStatJitter(setup, seed), seed }) as St;
        let guard = 0, lastKey = '', played = 0;
        const alive = (p: ReadonlyArray<{ currentHp: number }>) => p.some(e => e.currentHp > 0);
        while (alive(st.playerParty) && alive(st.enemyParty) && st.turn <= 60 && guard++ < 4000) {
            // Bucket on the (turn, side) PAIR, not the turn number alone. Bucketing on the turn
            // alone read valkyrie_v2 at 45-105 cards a turn: her OS can put the player on the
            // board again inside the same `st.turn`, so the counter never saw a transition and
            // accumulated a whole game into one bucket. A single-game trace showed her real rate
            // is 1-5 a turn, so the 45 was the instrument, not the deck.
            const key = `${st.turn}:${st.activeSide}`;
            if (st.activeSide === 'PLAYER' && key !== lastKey) {
                if (lastKey !== '') perTurn.push(played);
                lastKey = key; played = 0;
            }
            const mine = st.activeSide === 'PLAYER';
            const action = getBestAction(st);
            if (mine && action.type === 'PLAY_PROGRAM') played++;
            let next = battleReducer(st, action);
            if (next === st) { next = battleReducer(st, { type: 'END_TURN' }); if (next === st) break; }
            st = next;
        }
        if (lastKey !== '') perTurn.push(played);
    }
}

const mean = (a: number[]) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const hist = (a: number[]) => {
    const h = new Map<number, number>();
    for (const v of a) h.set(v, (h.get(v) ?? 0) + 1);
    return [...h.entries()].sort((x, y) => x[0] - y[0])
        .map(([k, v]) => `${k}:${((v / a.length) * 100).toFixed(0)}%`).join('  ');
};

console.error(`\n${DECK}   draw ${MingmingRegistry[SPECIES].cardDraw}` +
    (ENV.CUT ? `   cut ${ENV.CUT}` : '   (uncut)'));
console.error(`  field ${((sum / n) * 100).toFixed(1)}%   dead ${((dead / n) * 100).toFixed(1)}%   ` +
    `turns ${(turns / n).toFixed(2)}   absolutes ${cells.filter(c => c >= 100 || c <= 0).length}`);
console.error(`  CARDS PER TURN   mean ${mean(perTurn).toFixed(2)}   ` +
    `4+ on ${((perTurn.filter(v => v >= 4).length / perTurn.length) * 100).toFixed(0)}% of turns`);
console.error(`  distribution     ${hist(perTurn)}`);
console.error(`  max in one turn  ${Math.max(...perTurn)}   (a double-digit max means the bucketing broke, not the deck)`);
console.error(`CSV,${DECK},${MingmingRegistry[SPECIES].cardDraw},${ENV.CUT ?? ''},` +
    `${((sum / n) * 100).toFixed(2)},${mean(perTurn).toFixed(3)},` +
    `${((perTurn.filter(v => v >= 4).length / perTurn.length) * 100).toFixed(1)}`);
