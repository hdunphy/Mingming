/**
 * TICKET 166a's instrument: how long the enemy AI blocks the main thread, per decision, in the
 * Rootfall gauntlet with the 09-26 playtest party (fenrir_v2 / skoll_v2 / huldra_v1).
 *
 *   npx vite-node scratch/stutterprobe.ts -- --beam 8 --fight 0     (gauntlet fight 1, wild/elite beam)
 *   npx vite-node scratch/stutterprobe.ts -- --beam 0 --fight 2     (the boss, which is beamless)
 *
 * Measured 2026-09-27 on 9f605e4 (container, so treat as relative):
 *   fight 0, beam 8: enemy decisions 275 1342 72 52 ms
 *   fight 2, beam 0: enemy decisions 27154 9775 5958 2195 595 219 88 68 0 ms
 * Every one of those milliseconds is a frozen tab today, because `BattleArena` calls
 * `getBestAction` synchronously 50 ms after the previous enemy card was dispatched - i.e. while
 * that card's reveal and cast sequence are animating.
 *
 * It also checks the two facts a Web Worker depends on: the battle state survives
 * `structuredClone` unchanged, and `getBestAction` on the clone picks the same action.
 */
import { arg } from './_env';
import { createRun } from '../src/engine/run/createRun';
import { offerGyms } from '../src/engine/run/gyms';
import { rollGauntletFight } from '../src/engine/run/gauntlet';
import { RUN_ENEMY_MODE } from '../src/engine/run/encounter';
import { BALANCE_IV, BALANCE_STAT_JITTER } from '../src/debug/balance/balanceScenarios';
import { buildScenarioState } from '../src/debug/scenarios/buildScenarioState';
import { getBestAction } from '../src/engine/ai/TacticalAI';
import { battleReducer } from '../src/engine/battleReducer';

const beam = Number(arg('beam', '8')); const fightIndex = Number(arg('fight', '0')); const MAXD = Number(arg('decisions', '12'));
const PARTY: Array<[string, string]> = [['fenrir', 'fenrir_v2'], ['skoll', 'skoll_v2'], ['huldra', 'huldra_v1']];
const party = PARTY.map(([sp, os], i) => ({ id: `mm${i}`, definitionId: sp, activeOS: os, blueprintsCollected: 0, attackIV: BALANCE_IV, defenseIV: BALANCE_IV, hpIV: BALANCE_IV }));
const offer = offerGyms('probe:gyms').find((o) => o.gym.id === 'gym_rootfall')!;
const run = createRun({ seed: 'probe:rootfall', offer, party, startedAt: 1 });
const node = run.nodes.find((n) => n.kind === 'gym')!;
const enc = rollGauntletFight({ run, node, fightIndex });
let state = buildScenarioState({
  seed: 'probe:0', enemyMode: RUN_ENEMY_MODE,
  player: { party: party.map((m) => ({ definitionId: m.definitionId, activeOS: m.activeOS, attackIV: m.attackIV, defenseIV: m.defenseIV, hpIV: m.hpIV })), deck: run.deck.map((c) => c.dataId), drivers: [] },
  enemies: enc.enemyParty.map((e, i) => ({ definitionId: e.definitionId, activeOS: e.activeOS ?? 'run-gate:no-firmware', attackIV: e.attackIV ?? BALANCE_IV, defenseIV: e.defenseIV ?? BALANCE_IV, hpIV: e.hpIV ?? BALANCE_IV, deck: i === 0 ? [...enc.enemyDeckIds] : [] })),
  ...(enc.enemyDrivers && enc.enemyDrivers.length > 0 ? { enemyDrivers: [...enc.enemyDrivers] } : {}),
  statJitter: BALANCE_STAT_JITTER,
});
state = { ...state, aiBeam: beam };
let cloneOk = true, cloneErr = '';
try { const c = structuredClone(state); if (JSON.stringify(c) !== JSON.stringify(state)) { cloneOk = false; cloneErr = 'json differs'; } } catch (e) { cloneOk = false; cloneErr = String(e); }
console.log(`enemies ${enc.enemyParty.map(e => e.definitionId + ':' + (e.activeOS ?? '-')).join(', ')} beam=${beam} fight=${fightIndex}`);
console.log(`structuredClone ok=${cloneOk} ${cloneErr}  stateJSONbytes=${JSON.stringify(state).length}`);
const times: number[] = []; let sameAfterClone = 0, cmp = 0;
for (let d = 0; d < MAXD; d++) {
  if (state.playerParty.every(p => p.currentHp <= 0) || state.enemyParty.every(e => e.currentHp <= 0)) break;
  const t = performance.now(); const a = getBestAction(state); const ms = performance.now() - t;
  if (state.activeSide === 'ENEMY') {
    times.push(ms);
    if (cmp < 3) { cmp++; const b = getBestAction(structuredClone(state)); if (JSON.stringify(a) === JSON.stringify(b)) sameAfterClone++; }
  }
  state = battleReducer(state, a);
}
const s = [...times].sort((x, y) => x - y);
console.log(`enemy decisions n=${times.length} ms: ${times.map(t => t.toFixed(0)).join(' ')}`);
console.log(`p50 ${s[Math.floor(s.length/2)]?.toFixed(0)} max ${s[s.length-1]?.toFixed(0)}  sameActionAfterClone ${sameAfterClone}/${cmp}`);
