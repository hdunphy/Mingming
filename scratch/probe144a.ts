/**
 * TICKET 144a — WHY DO TWO COPIES OF THE SAME CARD NOT PRODUCE THE SAME SUBTREE?
 *
 * §1 argued they can only diverge through a mid-search reshuffle, which should be rare. The gate
 * said 69 of 90 cells moved. This walks a real battle and, at every decision, plays each member of
 * every interchangeable group ONE PLY and structurally diffs the results.
 *
 * If the one-ply states already differ, the premise is wrong before depth even enters into it, and
 * the diff names the field.
 */
import { battleReducer, type BattleAction } from '../src/engine/battleReducer';
import { getBestAction } from '../src/engine/ai/TacticalAI';
import { matchupScenario } from '../src/debug/balance/balanceScenarios';
import { applyStatJitter } from '../src/debug/balance/runBatch';
import { buildScenarioState } from '../src/debug/scenarios/buildScenarioState';
import type { IBattleState } from '../src/engine/types';

const A = process.argv[2] ?? 'fenrir_v1';
const B = process.argv[3] ?? 'kraken_v2';
const SEED = process.argv[4] ?? 'grid:fenrir_v1:kraken_v2:0';

/** Everything about a state that a subtree score could possibly read. Instance ids stripped. */
function fingerprint(s: IBattleState): string {
    const party = (p: readonly unknown[]) => (p as Array<Record<string, unknown>>).map(e => ({
        hp: e.currentHp, energy: e.currentEnergy, os: e.activeOS,
        st: (e.statusEffects as Array<Record<string, unknown>>).map(x => `${x.type}:${x.stacks}`).sort(),
    }));
    const deck = (d: Record<string, unknown>) => ({
        // dataIds IN ORDER. The first version of this probe sorted them, which is exactly how the
        // real mechanism stayed hidden: the two hands hold the same cards and a different ORDER.
        hand: (d.hand as Array<Record<string, unknown>>).map(c => c.dataId),
        draw: (d.drawpile as Array<Record<string, unknown>>).map(c => c.dataId),
        discard: (d.discard as Array<Record<string, unknown>>).map(c => c.dataId).sort(),
        exhaust: (d.exhaust as Array<Record<string, unknown>>).map(c => c.dataId).sort(),
    });
    return JSON.stringify({
        p: party(s.playerParty), e: party(s.enemyParty),
        pd: deck(s.playerDeck as unknown as Record<string, unknown>),
        ed: deck(s.enemyDeck as unknown as Record<string, unknown>),
        turn: s.turn, side: s.activeSide, phase: s.phase,
        seed: s.seed,
        counters: Object.fromEntries(Object.entries(s.counters ?? {}).filter(([k]) => !k.startsWith('card_growth:'))),
    });
}

/** The same three fields 144a keyed interchangeability on. */
function groups(state: IBattleState) {
    const key = state.activeSide === 'PLAYER' ? 'playerDeck' : 'enemyDeck';
    const hand = state[key].hand;
    const map = new Map<string, typeof hand[number][]>();
    for (const c of hand) {
        const g = state.counters?.[`card_growth:${c.id}`] ?? 0;
        const k = `${c.dataId}|${c.currentCost}|${g}`;
        if (!map.has(k)) map.set(k, []);
        map.get(k)!.push(c);
    }
    return [...map.entries()].filter(([, v]) => v.length > 1);
}

const setup = matchupScenario({ player: A.split('_')[0], enemy: B.split('_')[0], playerOS: A, enemyOS: B });
let state: IBattleState = buildScenarioState({ ...applyStatJitter(setup, SEED), seed: SEED });

const casesSeen = { groups: 0, sameOnePly: 0, differOnePly: 0 };
const reasons = new Map<string, number>();
let firstExample: string | null = null;

for (let step = 0; step < 400 && state.turn <= 40; step += 1) {
    const activeParty = state.activeSide === 'PLAYER' ? state.playerParty : state.enemyParty;
    const alive = activeParty.filter(e => e.currentHp > 0);
    for (const [, copies] of groups(state)) {
        casesSeen.groups += 1;
        for (const caster of alive) {
            const enemies = (state.activeSide === 'PLAYER' ? state.enemyParty : state.playerParty)
                .filter(e => e.currentHp > 0);
            const targetId = enemies[0]?.id ?? caster.id;
            const outs = copies.map(c => {
                const act = { type: 'PLAY_PROGRAM', payload: { sourceId: caster.id, targetId, programId: c.id } };
                return { id: c.id, next: battleReducer(state, act as unknown as BattleAction) };
            });
            const rejected = outs.filter(o => o.next === state).length;
            if (rejected === outs.length) continue;
            const prints = outs.map(o => fingerprint(o.next));
            if (prints.every(p => p === prints[0])) { casesSeen.sameOnePly += 1; continue; }
            casesSeen.differOnePly += 1;
            const a = JSON.parse(prints[0]), b = JSON.parse(prints[1]);
            for (const k of Object.keys(a)) {
                if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) {
                    reasons.set(k, (reasons.get(k) ?? 0) + 1);
                    if (!firstExample) {
                        firstExample = `turn ${state.turn} ${state.activeSide} caster ${caster.name}`
                            + `\n    field that differs: ${k}`
                            + `\n    copy A: ${JSON.stringify(a[k]).slice(0, 240)}`
                            + `\n    copy B: ${JSON.stringify(b[k]).slice(0, 240)}`;
                    }
                }
            }
        }
    }

    const action = getBestAction(state);
    const next = battleReducer(state, action);
    state = next === state ? battleReducer(state, { type: 'END_TURN' }) : next;
    if (state.playerParty.every(e => e.currentHp <= 0) || state.enemyParty.every(e => e.currentHp <= 0)) break;
}

console.log(`PROBE ${A} vs ${B}`);
console.log('  interchangeable groups seen :', casesSeen.groups);
console.log('  one-ply states IDENTICAL    :', casesSeen.sameOnePly);
console.log('  one-ply states DIFFER       :', casesSeen.differOnePly);
console.log('  differing fields            :', JSON.stringify(Object.fromEntries(reasons)));
if (firstExample) console.log('  first example:\n    ' + firstExample);
