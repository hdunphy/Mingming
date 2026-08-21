/** Ticket 100 side-check: why does the cards-per-turn walker read valkyrie_v2 at 45+/turn? */
import { matchupScenario } from '../src/debug/balance/balanceScenarios';
import { buildScenarioState } from '../src/debug/scenarios/buildScenarioState';
import { battleReducer } from '../src/engine/battleReducer';
import { getBestAction } from '../src/engine/ai/TacticalAI';
import type { IBattleState } from '../src/engine/types';

const setup = matchupScenario({
    player: 'valkyrie', enemy: 'control', playerOS: 'valkyrie_v2', enemyOS: 'control_v1', seed: 'vloop',
});
let st = buildScenarioState({ ...setup, seed: setup.seed }) as IBattleState;
let guard = 0;
const playsByTurn = new Map<number, number>();
const cards = new Map<string, number>();
const alive = (p: ReadonlyArray<{ currentHp: number }>) => p.some(e => e.currentHp > 0);
while (alive(st.playerParty) && alive(st.enemyParty) && st.turn <= 60 && guard++ < 4000) {
    const mine = st.activeSide === 'PLAYER';
    const action = getBestAction(st);
    if (mine && action.type === 'PLAY_PROGRAM') {
        playsByTurn.set(st.turn, (playsByTurn.get(st.turn) ?? 0) + 1);
        const c = st.playerDeck.hand.find(x => x.id === action.payload.programId);
        if (c) cards.set(c.dataId, (cards.get(c.dataId) ?? 0) + 1);
    }
    let next = battleReducer(st, action);
    if (next === st) { next = battleReducer(st, { type: 'END_TURN' }); if (next === st) break; }
    st = next;
}
console.error(`guard used ${guard} of 4000   final turn ${st.turn}   hit cap: ${guard >= 4000}`);
console.error(`plays per turn: ${[...playsByTurn.entries()].map(([t, n]) => `T${t}:${n}`).join('  ')}`);
console.error(`top cards: ${[...cards.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([c, n]) => `${c} x${n}`).join('  ')}`);
