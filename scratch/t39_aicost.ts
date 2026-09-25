/**
 * TICKET 39 (AI half) — what an enemy DECISION costs at the gym boss, beamless, 3v3.
 *
 * The 2026-09-24 note fixes the case to measure: *"the beam is a ladder rung — wild 8, elite 8, gym
 * 0 (beamless). The gym boss's unbeamed 3v3 turn is the p95 case."* So this builds the REAL boss
 * fight — `rollGauntletFight`, which applies `BOSS_IVS`, attaches the gym's Driver and fields the
 * deck the gauntlet fields — on the 28b trios, and times `getBestAction` call by call.
 *
 * ONE DECISION, NOT ONE TURN, is the unit, because that is what the UI blocks on: `BattleArena`
 * calls `getBestAction` once per action and the search is synchronous on the main thread, so the
 * freeze the player feels is one decision long. A turn is several of them with a reveal between.
 *
 * Run: `npx vite-node scratch/t39_aicost.ts -- --iter 3`
 */
import { arg } from './_env';
import { createRun } from '../src/engine/run/createRun';
import { offerGyms, GYM_REGISTRY } from '../src/engine/run/gyms';
import { rollGauntletFight, GAUNTLET_FIGHTS, isBossFight } from '../src/engine/run/gauntlet';
import { RUN_ENEMY_MODE } from '../src/engine/run/encounter';
import { BALANCE_IV, BALANCE_STAT_JITTER } from '../src/debug/balance/balanceScenarios';
import { buildScenarioState } from '../src/debug/scenarios/buildScenarioState';
import { getBestAction } from '../src/engine/ai/TacticalAI';
import { battleReducer } from '../src/engine/battleReducer';
import type { IMingmingState } from '../src/engine/types';

const ITER = Number(arg('iter', '3'));
const MAX_DECISIONS = Number(arg('decisions', '40'));

/** A three-body player party, as a run arrives at the gym with. */
const PARTY: Array<[string, string]> = [
    ['kraken', 'kraken_v1'], ['jormungandr', 'jormungandr_v1'], ['huldra', 'huldra_v1'],
];
const member = (id: string, species: string, os: string): IMingmingState => ({
    id, definitionId: species, activeOS: os, blueprintsCollected: 0,
    attackIV: BALANCE_IV, defenseIV: BALANCE_IV, hpIV: BALANCE_IV,
});

const pct = (xs: number[], p: number): number => {
    if (xs.length === 0) return 0;
    const s = [...xs].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};

console.log(`ticket 39 — enemy DECISION cost, gym boss, 3v3, aiBeam=${arg('beam','0')}\n`);
console.log('gym            decisions   mean      p50      p95      max');

const all: number[] = [];
for (const gymId of (arg('gym', '') ? [arg('gym','')] : Object.keys(GYM_REGISTRY))) {
    const party = PARTY.map(([sp, os], i) => member(`mm${i + 1}`, sp, os));
    const offer = offerGyms('t39:gyms').find((o) => o.gym.id === gymId)!;
    const run = createRun({ seed: `t39:${gymId}`, offer, party, startedAt: 1 });
    const node = run.nodes.find((n) => n.kind === 'gym')!;
    const bossIndex = GAUNTLET_FIGHTS - 1;
    if (!isBossFight(bossIndex, GAUNTLET_FIGHTS)) throw new Error('boss index');

    const times: number[] = [];
    for (let it = 0; it < ITER; it += 1) {
        const enc = rollGauntletFight({ run, node, fightIndex: bossIndex });
        let state = buildScenarioState({
            seed: `t39:${gymId}:${it}`,
            enemyMode: RUN_ENEMY_MODE,
            player: { party: party.map((m) => ({ definitionId: m.definitionId, activeOS: m.activeOS, attackIV: m.attackIV, defenseIV: m.defenseIV, hpIV: m.hpIV })), deck: run.deck.map((c) => c.dataId), drivers: [] },
            enemies: enc.enemyParty.map((e, i) => ({
                definitionId: e.definitionId, activeOS: e.activeOS ?? 'run-gate:no-firmware',
                attackIV: e.attackIV ?? BALANCE_IV, defenseIV: e.defenseIV ?? BALANCE_IV, hpIV: e.hpIV ?? BALANCE_IV,
                deck: i === 0 ? [...enc.enemyDeckIds] : [],
            })),
            ...(enc.enemyDrivers && enc.enemyDrivers.length > 0 ? { enemyDrivers: [...enc.enemyDrivers] } : {}),
            statJitter: BALANCE_STAT_JITTER,
        });
        // Beamless, which is the gym's own rung, and the case the note names.
        state = { ...state, aiBeam: Number(arg('beam', '0')) };

        for (let d = 0; d < MAX_DECISIONS; d += 1) {
            if (state.playerParty.every((p) => p.currentHp <= 0) || state.enemyParty.every((e) => e.currentHp <= 0)) break;
            const t = performance.now();
            const action = getBestAction(state);
            const ms = performance.now() - t;
            // Only the ENEMY's decisions are the p95 the player waits on; the player's side is
            // theirs to take at their own speed.
            console.log(`   ${gymId} d${d} side=${state.activeSide} act=${(action as {type?:string}).type ?? '?'} ${ms.toFixed(0)}ms`);
            if (state.activeSide === 'ENEMY') { times.push(ms); all.push(ms); }
            state = battleReducer(state, action);
        }
    }
    console.log(
        `${gymId.padEnd(15)}${String(times.length).padStart(9)}`
        + `${(times.reduce((a, b) => a + b, 0) / Math.max(1, times.length)).toFixed(0).padStart(8)}ms`
        + `${pct(times, 50).toFixed(0).padStart(8)}ms${pct(times, 95).toFixed(0).padStart(8)}ms${Math.max(...times, 0).toFixed(0).padStart(8)}ms`,
    );
}

console.log(`\nPOOLED  n=${all.length}  mean ${(all.reduce((a, b) => a + b, 0) / Math.max(1, all.length)).toFixed(0)}ms  p50 ${pct(all, 50).toFixed(0)}ms  p95 ${pct(all, 95).toFixed(0)}ms  max ${Math.max(...all, 0).toFixed(0)}ms`);
console.log(`target: enemy turn p95 < 1000ms. NOTE this machine is a 2-core sandbox, NOT Deck-class; and Chrome 4x throttling is a further multiplier on top.`);
