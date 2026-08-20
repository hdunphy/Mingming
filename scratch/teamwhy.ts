/**
 * TICKET 98: WHERE the 3v3 cost is. Greedy (no lookahead at all) costs 34s a battle against full's
 * 52s, so at least two thirds of the cost is not search depth. The two remaining candidates need
 * different fixes, so they have to be told apart:
 *
 *   (a) CANDIDATE COUNT - the AI evaluates casters x hand x targets, and every one of those is a
 *       full `battleReducer` simulation. 3 x 7 x 3 = 63 where 1v1 does 1 x 4 x 1.
 *   (b) PER-CALL COST - each reducer call is itself dearer with 6 entities, 27-card piles and more
 *       hooks in flight.
 *
 * (a) is fixed by pruning the candidate set; (b) is fixed in the engine. This measures both.
 */
import { buildScenarioState } from '../src/debug/scenarios/buildScenarioState';
import { teamScenario } from '../src/debug/balance/balanceScenarios';
import { battleReducer } from '../src/engine/battleReducer';
import { getBestAction } from '../src/engine/ai/TacticalAI';
import { globalBattleEventBus } from '../src/engine/events';
type St = import('../src/engine/types').IBattleState;

const SQUAD: Array<readonly [string, string]> = [
    ['draugr', 'draugr_v2'], ['huldra', 'huldra_v1'], ['sleipnir', 'sleipnir_v1'],
];
const FOE: Array<readonly [string, string]> = [
    ['hel', 'hel_v2'], ['kraken', 'kraken_v1'], ['fenrir', 'fenrir_v1'],
];

for (const n of [1, 3]) {
    const setup = teamScenario({ player: SQUAD.slice(0, n), enemy: FOE.slice(0, n), seed: `why:${n}` });
    let st = buildScenarioState({ ...setup, seed: `why:${n}` }) as St;

    // Walk to a mid-battle state where a PLAY is actually available. The first version of this
    // probe walked a fixed 12 steps and landed on a state with no legal play, which reported 0ms
    // per decision and 0us per call - a measurement of nothing that looked like a fast result.
    let probe: St | null = null;
    for (let i = 0; i < 200 && !probe; i++) {
        const a = getBestAction(st);
        if (a.type === 'PLAY_PROGRAM' && i >= 6) probe = st;
        const next = battleReducer(st, a);
        st = next === st ? battleReducer(st, { type: 'END_TURN' }) : next;
        const dead = (p: ReadonlyArray<{ currentHp: number }>) => p.every(e => e.currentHp <= 0);
        if (dead(st.playerParty) || dead(st.enemyParty)) break;
    }
    if (!probe) { console.error(`${n}v${n}  no playable state found - probe invalid`); continue; }
    st = probe;

    const party = st.activeSide === 'PLAYER' ? st.playerParty : st.enemyParty;
    const deck = st.activeSide === 'PLAYER' ? st.playerDeck : st.enemyDeck;
    const opp = st.activeSide === 'PLAYER' ? st.enemyParty : st.playerParty;
    const casters = party.filter(e => e.currentHp > 0).length;
    const targets = opp.filter(e => e.currentHp > 0).length;
    const hand = deck.hand.length;

    // (b) per-call cost: one representative PLAY_PROGRAM, muted, repeated.
    const card = deck.hand[0];
    const src = party.find(e => e.currentHp > 0)!;
    const tgt = opp.find(e => e.currentHp > 0)!;
    const play = { type: 'PLAY_PROGRAM' as const,
        payload: { sourceId: src.id, targetId: tgt.id, programId: card.dataId } };
    // Assert the call does something. A rejected play returns the same object and would time a
    // no-op - the exact trap the first version of this probe fell into.
    const changed = globalBattleEventBus.runMuted(() => battleReducer(st, play)) !== st;
    const REPS = 500;
    const t0 = performance.now();
    for (let i = 0; i < REPS; i++) globalBattleEventBus.runMuted(() => battleReducer(st, play));
    const perCallUs = ((performance.now() - t0) / REPS) * 1000;

    // (a) candidate count: what the AI's same-turn enumeration actually walks.
    const t1 = performance.now();
    getBestAction(st);
    const perDecisionMs = performance.now() - t1;

    console.error(`${n}v${n}  casters ${casters} x hand ${hand} x targets ${targets} = ` +
        `${casters * hand * targets} same-turn candidates   ` +
        `per reducer call ${perCallUs.toFixed(0)}us${changed ? '' : ' (REJECTED - invalid)'}   ` +
        `per DECISION ${perDecisionMs.toFixed(0)}ms`);
}
