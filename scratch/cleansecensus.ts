/**
 * Ticket 102, blast-radius item 2: re-measure the debuff load that CLEANSE_POWER is derived from.
 *
 * Ticket 46 set `CLEANSE_POWER = 10` from a measured median debuff load of 15 power, deliberately
 * lowballed. That measurement was taken under PERCENT, where `streamStacks` clamped a pile at 13.
 * Under POWER the clamp is gone, so a unit carrying a 24-stack Weakened pile is now worth what 24
 * stacks are worth rather than what 13 were - and the stack census says piles that size are real.
 * The per-CARD prices did not move; this is the one place the un-clamping can bite, so it gets
 * re-measured rather than asserted.
 *
 * Method mirrors ticket 46: sample every side-turn across the tuned pairings, value each held
 * status with `statusPileValue`, and report the ROBUST statistics - the raw mean is dominated by
 * nidhoggr's triangular poison piles and was useless then too.
 *
 * env: ITER (seeds per pairing, default 3), PAIRS (default 90 = every ordered pair)
 */
import { statusPileValue } from '../src/debug/balance/powerscale';
import { matchupScenario, BALANCE_SPECIES } from '../src/debug/balance/balanceScenarios';
import { buildScenarioState } from '../src/debug/scenarios/buildScenarioState';
import { deriveSeeds, applyStatJitter } from '../src/debug/balance/runBatch';
import { battleReducer } from '../src/engine/battleReducer';
import { getBestAction } from '../src/engine/ai/TacticalAI';
import { MingmingRegistry } from '../src/engine/data/mingmingRegistry';
import { DEBUFFS } from '../src/debug/balance/powerscale';
import type { IBattleState, IBattleEntity, BattleAction } from '../src/engine/types';

const ITER = Number(process.env.ITER ?? 3);
const PAIR_LIMIT = Number(process.env.PAIRS ?? 90);

const pairs: Array<{ a: string; b: string }> = [];
for (const a of BALANCE_SPECIES) for (const b of BALANCE_SPECIES) if (a !== b) pairs.push({ a, b });
const sample = pairs.slice(0, PAIR_LIMIT);

const loads: number[] = [];
let games = 0;
let samples = 0;
let loaded = 0;

const debuffLoad = (e: IBattleEntity): number => {
    let total = 0;
    for (const s of e.statusEffects) if (DEBUFFS.includes(s.type)) total += statusPileValue(s.type, s.stacks);
    return total;
};

for (const p of sample) {
    const setup = matchupScenario({
        player: p.a, enemy: p.b,
        playerOS: MingmingRegistry[p.a].availableOS[0], enemyOS: MingmingRegistry[p.b].availableOS[0],
        seed: `cleanse:${p.a}:${p.b}`,
    });
    for (const seed of deriveSeeds(setup.seed, ITER)) {
        let st: IBattleState = buildScenarioState({ ...applyStatJitter(setup, seed), seed });
        games++;
        let guard = 0;
        let lastKey = '';
        const alive = (party: ReadonlyArray<IBattleEntity>) => party.some(e => e.currentHp > 0);
        while (alive(st.playerParty) && alive(st.enemyParty) && st.turn <= 60 && guard++ < 4000) {
            // Once per side-turn, per ticket 46, and OUTSIDE getBestAction per 0-AI-SIM-COUNTS.
            const key = `${st.turn}:${st.activeSide}`;
            if (key !== lastKey) {
                lastKey = key;
                const unit = (st.activeSide === 'PLAYER' ? st.playerParty : st.enemyParty)[0];
                if (unit && unit.currentHp > 0) {
                    const load = debuffLoad(unit);
                    samples++;
                    if (load > 0) { loaded++; loads.push(load); }
                }
            }
            const action: BattleAction = getBestAction(st);
            let next = battleReducer(st, action);
            if (next === st) { next = battleReducer(st, { type: 'END_TURN' }); if (next === st) break; }
            st = next;
        }
    }
}

loads.sort((x, y) => x - y);
const q = (f: number) => loads.length ? loads[Math.min(loads.length - 1, Math.floor(loads.length * f))] : 0;
const trimmed = loads.slice(0, Math.floor(loads.length * 0.95));
const mean = (a: number[]) => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;

console.error(`\nCLEANSE CENSUS   games ${games}   side-turns ${samples}`);
console.error(`  carrying a debuff       ${((loaded / Math.max(1, samples)) * 100).toFixed(1)}%   (ticket 46 measured 63.3%)`);
console.error(`  median load when loaded ${q(0.5).toFixed(1)} power   (ticket 46 measured 15)`);
console.error(`  p25 / p75               ${q(0.25).toFixed(1)} / ${q(0.75).toFixed(1)}   (ticket 46: 7 / 38.5)`);
console.error(`  trimmed mean (top 5% out) ${mean(trimmed).toFixed(1)}   (ticket 46: 13.4-16.9)`);
console.error(`  raw mean                ${mean(loads).toFixed(1)}   <- dominated by poison tails, ignore`);
console.error(`\n  CLEANSE_POWER ships at 10, deliberately under the median.`);
console.error(`CSV,cleanse,${games},${samples},${((loaded / Math.max(1, samples)) * 100).toFixed(2)},${q(0.5).toFixed(2)},${q(0.25).toFixed(2)},${q(0.75).toFixed(2)},${mean(trimmed).toFixed(2)},${mean(loads).toFixed(2)}`);
