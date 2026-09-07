/**
 * PER-STACK PAYOFF AUDIT — Henry, 2026-09-07: "Slander does almost no damage (86 when the enemy
 * has 7 Dazed), Fenrir with 9 Strength only 94. Much less than the other 1e cards."
 *
 * The arithmetic says slander needs 15 Dazed to reach its 2e budget of 75 power and unbound_fang
 * needs 7 Strengthened to reach 35. This walks real games and asks the only question that settles
 * it: WHAT PILE IS ACTUALLY REACHABLE, and what does the payoff card deal when it fires?
 *
 * Records, per real (non-AI-speculation) play: the stacks the caster/target held at cast time and
 * the HP actually removed. Compares against what a vanilla card of the same cost would have dealt
 * through the same attacker into the same target.
 */
import { battleReducer, type BattleAction } from '../src/engine/battleReducer';
import { getBestAction } from '../src/engine/ai/TacticalAI';
import { matchupScenario } from '../src/debug/balance/balanceScenarios';
import { applyStatJitter, deriveSeeds } from '../src/debug/balance/runBatch';
import { buildScenarioState } from '../src/debug/scenarios/buildScenarioState';
import { calculateDamage } from '../src/engine/combatUtils';
import { GetProgramData } from '../src/engine/data/programRegistry';
import type { IBattleState, IBattleEntity } from '../src/engine/types';

const A = process.argv[2] ?? 'fenrir_v1';
const CARD = process.argv[3] ?? 'unbound_fang';
const STATUS = process.argv[4] ?? 'Strengthened';
const ON = (process.argv[5] ?? 'SELF') as 'SELF' | 'TARGET';
const N = Number(process.argv[6] ?? 60);

const FIELD = ['kraken_v2', 'huldra_v1', 'draugr_v2', 'sleipnir_v1', 'jormungandr_v1', 'valkyrie_v2'];
const stacksOf = (e: IBattleEntity, t: string) => e.statusEffects.find(s => s.type === t)?.stacks ?? 0;

interface Fire { stacks: number; dealt: number; vanilla: number; turn: number }
const fires: Fire[] = [];
const peaks: number[] = [];

for (const opp of FIELD) {
    for (const seed of deriveSeeds(`payoff:${A}:${opp}`, N)) {
        const setup = matchupScenario({
            player: A.split('_')[0], enemy: opp.split('_')[0], playerOS: A, enemyOS: opp,
        });
        let state: IBattleState = buildScenarioState({ ...applyStatJitter(setup, seed), seed });
        let peak = 0;

        for (let step = 0; step < 900 && state.turn <= 60; step += 1) {
            // peak pile, sampled every step on the side that owns the payoff
            for (const e of (ON === 'SELF' ? state.playerParty : state.enemyParty)) {
                if (e.currentHp > 0) peak = Math.max(peak, stacksOf(e, STATUS));
            }

            const action = getBestAction(state);
            const isCast = action?.type === 'PLAY_PROGRAM';
            let watch: { stacks: number; hp: number; tid: string; src: IBattleEntity } | null = null;
            if (isCast && state.activeSide === 'PLAYER') {
                const p = action.payload as { sourceId: string; targetId: string; programId: string };
                const card = state.playerDeck.hand.find(c => c.id === p.programId);
                if (card?.dataId === CARD) {
                    const src = state.playerParty.find(e => e.id === p.sourceId)!;
                    const tgt = [...state.enemyParty, ...state.playerParty].find(e => e.id === p.targetId)!;
                    watch = {
                        stacks: stacksOf(ON === 'SELF' ? src : tgt, STATUS),
                        hp: tgt.currentHp, tid: tgt.id, src,
                    };
                }
            }

            const next = battleReducer(state, action);
            if (watch) {
                const after = [...next.enemyParty, ...next.playerParty].find(e => e.id === watch!.tid);
                const dealt = watch.hp - (after?.currentHp ?? 0);
                // what a plain attack at this cost's full budget would have done, same frame
                const cost = GetProgramData(CARD)?.baseCost ?? 1;
                const budget = { 0: 10, 1: 35, 2: 75, 3: 120 }[cost as 0 | 1 | 2 | 3] ?? 35;
                const tgtEnt = [...state.enemyParty, ...state.playerParty].find(e => e.id === watch!.tid)!;
                const vanilla = calculateDamage(watch.src, tgtEnt, GetProgramData(CARD)!, budget, state);
                if (dealt > 0) fires.push({ stacks: watch.stacks, dealt, vanilla, turn: state.turn });
            }
            state = next === state ? battleReducer(state, { type: 'END_TURN' } as BattleAction) : next;
            if (state.playerParty.every(e => e.currentHp <= 0) || state.enemyParty.every(e => e.currentHp <= 0)) break;
        }
        peaks.push(peak);
    }
}

const q = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length * p)] ?? 0; };
const mean = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;

console.log(`\n${A} — ${CARD} (reads ${STATUS} on ${ON})   ${FIELD.length}x${N} games`);
console.log(`  peak ${STATUS} pile per game : mean ${mean(peaks).toFixed(1)}  median ${q(peaks, .5)}  p90 ${q(peaks, .9)}  max ${Math.max(...peaks)}`);
if (!fires.length) { console.log('  card never fired'); } else {
  console.log(`  ${CARD} fired ${fires.length}x`);
  console.log(`    ${STATUS} at cast : mean ${mean(fires.map(f => f.stacks)).toFixed(1)}  median ${q(fires.map(f => f.stacks), .5)}  p90 ${q(fires.map(f => f.stacks), .9)}  max ${Math.max(...fires.map(f => f.stacks))}`);
  console.log(`    damage dealt    : mean ${mean(fires.map(f => f.dealt)).toFixed(1)}  median ${q(fires.map(f => f.dealt), .5)}  max ${Math.max(...fires.map(f => f.dealt))}`);
  console.log(`    a full-budget card, same frame : mean ${mean(fires.map(f => f.vanilla)).toFixed(1)}`);
  console.log(`    => payoff is ${(100 * mean(fires.map(f => f.dealt)) / mean(fires.map(f => f.vanilla))).toFixed(0)}% of a vanilla card at its own cost`);
}
