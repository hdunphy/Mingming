/**
 * TICKET 166f's instrument: how long the enemy thinks, and whether it still plays like the full
 * search, at several beam widths. Rootfall gauntlet, the 09-26 party (fenrir_v2 / skoll_v2 /
 * huldra_v1). The game is driven by beam 8; at every ENEMY decision each width is timed on the SAME
 * state and its choice compared with the beamless (full) search.
 *
 *   npx vite-node scratch/bossbeam.ts -- --fight 2 --seeds 3 --per 5 --tier full   (the boss)
 *   npx vite-node scratch/bossbeam.ts -- --fight 0 --seeds 3 --per 6 --tier lite   (elite-grade AI)
 *   npx vite-node scratch/bossbeam.ts -- --fight 0 --seeds 3 --per 6 --tier greedy (wild-grade AI)
 *   --widths 8,4,2,0   (0 = beamless; it must be in the list, it is the reference)
 *
 * Measured 2026-09-27 in the cloud container (treat as relative; Henry's machine will differ).
 * "bug 8" is today's game, where `.slice(0, BEAM)` read the process default (0) instead of the
 * battle's width, so every beamed search stopped one play deep:
 *
 *   boss (full tier), 15 decisions      p50      p95   same move as the full search
 *     bug 8                             266 ms   3.2 s     2/15
 *     fixed 8                           2.5 s    4.8 s    14/15
 *     fixed 4                           1.4 s    3.8 s    13/15
 *     fixed 2                           0.6 s    3.4 s     5/15
 *     beamless (what the gym uses now)  10.8 s   43.4 s   15/15
 *
 *   elite (lite tier), 18 decisions:  bug 8  118 ms / 0.9 s  7/18   fixed 8  0.8 s / 2.8 s  18/18
 *   wild (greedy tier), 18 decisions: bug 8   52 ms / 0.3 s  9/18   fixed 8  0.3 s / 2.3 s  18/18
 *
 * Run it AFTER the fix: before it, every width above 0 measures the bug.
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
import type { IBattleState } from '../src/engine/types';

const fightIndex = Number(arg('fight', '2'));
const seeds = Number(arg('seeds', '3'));
const perSeed = Number(arg('per', '5'));
const gymId = arg('gym', 'gym_rootfall');
const tier = arg('tier', 'full');
const widths = arg('widths', '8,4,2,0').split(',').map(Number);
if (!widths.includes(0)) throw new Error('--widths must include 0: the beamless search is the reference');

const PARTY: Array<[string, string]> = [['fenrir', 'fenrir_v2'], ['skoll', 'skoll_v2'], ['huldra', 'huldra_v1']];
const party = PARTY.map(([sp, os], i) => ({ id: `mm${i}`, definitionId: sp, activeOS: os, blueprintsCollected: 0, attackIV: BALANCE_IV, defenseIV: BALANCE_IV, hpIV: BALANCE_IV }));
const at = (s: IBattleState, beam: number): IBattleState => ({ ...s, enemyAiTier: tier, aiBeam: beam } as IBattleState);

const times = new Map<number, number[]>();
const agree = new Map<number, number>();
let n = 0;
const quiet = console.log; console.log = () => {};
for (let sd = 0; sd < seeds; sd++) {
    const offer = offerGyms(`probe:gyms:${sd}`).find((o) => o.gym.id === gymId)!;
    const run = createRun({ seed: `probe:${gymId}:${sd}`, offer, party, startedAt: 1 });
    const node = run.nodes.find((x) => x.kind === 'gym')!;
    const enc = rollGauntletFight({ run, node, fightIndex });
    let state = buildScenarioState({
        seed: `probe:${sd}`, enemyMode: RUN_ENEMY_MODE,
        player: { party: party.map((m) => ({ definitionId: m.definitionId, activeOS: m.activeOS, attackIV: m.attackIV, defenseIV: m.defenseIV, hpIV: m.hpIV })), deck: run.deck.map((c) => c.dataId), drivers: [] },
        enemies: enc.enemyParty.map((e, i) => ({ definitionId: e.definitionId, activeOS: e.activeOS ?? 'run-gate:no-firmware', attackIV: e.attackIV ?? BALANCE_IV, defenseIV: e.defenseIV ?? BALANCE_IV, hpIV: e.hpIV ?? BALANCE_IV, deck: i === 0 ? [...enc.enemyDeckIds] : [] })),
        ...(enc.enemyDrivers && enc.enemyDrivers.length > 0 ? { enemyDrivers: [...enc.enemyDrivers] } : {}),
        statJitter: BALANCE_STAT_JITTER,
    });
    let got = 0;
    for (let d = 0; d < 80 && got < perSeed; d++) {
        if (state.playerParty.every((p) => p.currentHp <= 0) || state.enemyParty.every((e) => e.currentHp <= 0)) break;
        if (state.activeSide === 'ENEMY') {
            got++; n++;
            const choice = new Map<number, string>();
            for (const w of widths) {
                const t = performance.now();
                const action = getBestAction(at(state, w));
                const ms = performance.now() - t;
                times.set(w, [...(times.get(w) ?? []), ms]);
                choice.set(w, JSON.stringify(action));
            }
            for (const w of widths) if (choice.get(w) === choice.get(0)) agree.set(w, (agree.get(w) ?? 0) + 1);
        }
        state = battleReducer(state, getBestAction(at(state, 8)));
    }
}
console.log = quiet;
const pct = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
console.log(`${gymId} fight ${fightIndex}, tier ${tier}: ${n} enemy decisions`);
for (const w of widths) {
    const xs = times.get(w) ?? [0];
    console.log(`beam ${String(w || 'none').padEnd(4)} p50 ${pct(xs, 0.5).toFixed(0).padStart(6)} ms  p95 ${pct(xs, 0.95).toFixed(0).padStart(6)} ms  max ${Math.max(...xs).toFixed(0).padStart(6)} ms  same move as beamless ${agree.get(w) ?? 0}/${n}`);
}
