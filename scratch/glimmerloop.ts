/**
 * REPRO — `glimmer` draws itself forever (found by accident in ticket 100, never ticketed).
 *
 * `handlePlayProgram` appends the played card to the DISCARD while paying its cost, at step 3,
 * BEFORE its actions resolve at step 4. `drawCards` auto-shuffles the discard into the drawpile
 * whenever the drawpile is empty. So a 0-cost "Draw a card" whose drawpile is empty finds its own
 * copy in the discard it was just put into, shuffles it back, and draws it into hand — leaving the
 * state identical to where it started, minus one advanced seed. It costs 0 Energy, so nothing
 * bounds the repetition.
 *
 * This runs the mechanism directly rather than the 3,942-play game, so the fixed point is visible
 * in five dispatches instead of a whole battle. The in-game repro on record is
 * `valkyrie_v2` vs `huldra_v1`, seed 761868416, turn 8.
 *
 * Run: npx vite-node scratch/glimmerloop.ts
 */
import { battleReducer } from '../src/engine/battleReducer';
import { createSparseBattleState, createSparseEntity } from '../src/debug/scenarios/scenarioTestSupport';
import type { IBattleState, ProgramEntity } from '../src/engine/types';

const glimmer = (instance: string): ProgramEntity =>
    ({ id: instance, dataId: 'glimmer', currentCost: 0, isPlayable: true } as ProgramEntity);

let state: IBattleState = createSparseBattleState({
    activeSide: 'PLAYER',
    phase: 'ACTION',
    playerParty: [createSparseEntity({ id: 'p1', definitionId: 'valkyrie', name: 'Valkyrie', cardDraw: 3 })],
    playerDeck: {
        ownerId: 'PLAYER',
        deck: ['glimmer'],
        drawpile: [],           // empty — this is the precondition
        hand: [glimmer('g1')],
        discard: [],
        exhaust: [],
    },
});

const snap = (s: IBattleState) => ({
    hand: s.playerDeck.hand.map(c => c.dataId).join(','),
    drawpile: s.playerDeck.drawpile.length,
    discard: s.playerDeck.discard.length,
    played: s.cardsPlayedThisTurn,
    energy: s.playerParty[0].currentEnergy,
});

console.log('start          ', snap(state));
for (let i = 1; i <= 5; i++) {
    const inHand = state.playerDeck.hand.find(c => c.dataId === 'glimmer');
    if (!inHand) { console.log(`play ${i}: glimmer is NOT in hand — the loop is broken (good)`); break; }
    state = battleReducer(state, {
        type: 'PLAY_PROGRAM',
        payload: { sourceId: 'p1', targetId: 'p1', programId: inHand.id },
    } as never);
    console.log(`after play ${i}  `, snap(state));
}

const looped = state.playerDeck.hand.some(c => c.dataId === 'glimmer');
console.log(
    looped
        ? '\nLOOP CONFIRMED: glimmer is back in hand after every play, at 0 Energy, with no bound.'
        : '\nNo loop: glimmer did not return to hand.',
);
