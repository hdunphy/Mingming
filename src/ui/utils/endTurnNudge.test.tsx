/**
 * TICKET 171h — the END TURN nudge.
 *
 * Henry, 2026-09-29: *"I missed out on 3e on a turn because I hit the end button. It would be great
 * to highlight or alert the user if they can still make a play ... Just like a flash on the button
 * and then the card that is playable lights up."* Ruled as written on 2026-09-30.
 */

import { configureStore } from '@reduxjs/toolkit';
import { describe, expect, it } from 'vitest';
import { Provider } from 'react-redux';
import { renderToStaticMarkup } from 'react-dom/server';

import CardHand from '../components/CardHand';
import battleSliceReducer, { endTurn, nudgeEndTurn } from '../store/battleSlice';
import gameReducer, { createEmptyRanch } from '../store/gameSlice';
import runReducer from '../store/runSlice';
import { decideEndTurn, nudgeIsLive } from './endTurnNudge';
import { playsLeft } from './playsLeft';
import type { Element, IBattleEntity, IBattleState, ProgramEntity } from '../../engine/types';

function unit(id: string, over: Partial<IBattleEntity> = {}): IBattleEntity {
    return {
        id, name: id.toUpperCase(), definitionId: 'fenrir', blueprintsCollected: 0,
        attackIV: 0, defenseIV: 0, hpIV: 0, maxHp: 200, currentHp: 200,
        cardDraw: 3, maxEnergy: 3, currentEnergy: 3, attack: 45, defense: 30, speed: 10,
        primaryElement: 'Fire' as Element, secondaryElement: 'None' as Element,
        tempHp: 0, statusEffects: [], daemons: [], hooks: [], playsThisTurn: 0,
        ...over,
    } as IBattleEntity;
}

const card = (id: string, dataId: string, cost: number): ProgramEntity => ({ id, dataId, currentCost: cost, isPlayable: true });

function board(hand: ProgramEntity[], over: Partial<IBattleState> = {}): IBattleState {
    return {
        sessionId: 'nudge', seed: 'nudge', turn: 3, phase: 'ACTION', activeSide: 'PLAYER', activeDrivers: [],
        playerParty: [unit('blaze')],
        enemyParty: [unit('sprout', { primaryElement: 'Nature' as Element, maxHp: 400, currentHp: 400 })],
        playerDeck: { ownerId: 'PLAYER', deck: [], drawpile: [], hand, discard: [], exhaust: [] },
        enemyDeck: { ownerId: 'ENEMY', deck: [], drawpile: [], hand: [], discard: [], exhaust: [] },
        logs: [], osLogs: [], procs: [], cardsPlayedThisTurn: 0, cardsDrawnThisTurn: 0,
        lastProgramPlayed: null, counters: {},
        ...over,
    } as unknown as IBattleState;
}

// `fire_punch_v2` costs 1, `tackle` costs 0.
const PUNCH = card('c1', 'fire_punch_v2', 1);
const TACKLE = card('c2', 'tackle', 0);

describe('playsLeft — any card still playable', () => {
    it('finds a 1e card a caster with Energy can cast, and a 0e card too (ticket 172)', () => {
        // Henry, 2026-09-30, on 0e cards: "I think it still should trigger."
        expect(playsLeft(board([PUNCH, TACKLE]))).toEqual(['c1', 'c2']);
        expect(playsLeft(board([TACKLE]))).toEqual(['c2']);
    });

    it('with no Energy left, only the 0e card is still a play', () => {
        expect(playsLeft(board([PUNCH, TACKLE], { playerParty: [unit('blaze', { currentEnergy: 0 })] }))).toEqual(['c2']);
    });

    it('is empty with nothing castable, on the enemy turn, or with every ally down', () => {
        expect(playsLeft(board([PUNCH], { playerParty: [unit('blaze', { currentEnergy: 0 })] }))).toEqual([]);
        expect(playsLeft(board([PUNCH], { activeSide: 'ENEMY' }))).toEqual([]);
        expect(playsLeft(board([PUNCH], { playerParty: [unit('blaze', { currentHp: 0 })] }))).toEqual([]);
    });
});

describe('decideEndTurn — flash first, end on the second press', () => {
    it('nudges on the first press, ends on the second', () => {
        const state = board([PUNCH]);
        const first = decideEndTurn(state, null);
        expect(first).toEqual({ kind: 'nudge', cardIds: ['c1'] });
        expect(decideEndTurn(state, { turn: state.turn, cardIds: ['c1'] })).toEqual({ kind: 'end' });
    });

    it('ends straight away when nothing is playable', () => {
        expect(decideEndTurn(board([]), null)).toEqual({ kind: 'end' });
        expect(decideEndTurn(board([PUNCH], { playerParty: [unit('blaze', { currentEnergy: 0 })] }), null)).toEqual({ kind: 'end' });
    });

    it('a nudge from an earlier turn does not count as the second press', () => {
        expect(decideEndTurn(board([PUNCH]), { turn: 1, cardIds: ['c1'] }).kind).toBe('nudge');
    });
});

describe('the slice and the hand', () => {
    const storeWith = (nudge: { turn: number; cardIds: string[] } | null) => configureStore({
        reducer: { battle: battleSliceReducer, game: gameReducer, run: runReducer },
        preloadedState: {
            game: createEmptyRanch(), run: { run: null },
            battle: {
                battle: board([PUNCH, TACKLE]), selectedSourceId: 'blaze', selectedTargetId: 'sprout',
                selectedCardId: null, endTurnNudge: nudge,
            },
        },
    });

    it('nudgeEndTurn records the turn and the cards; endTurn clears it', () => {
        const store = storeWith(null);
        store.dispatch(nudgeEndTurn(['c1']));
        expect(store.getState().battle.endTurnNudge).toEqual({ turn: 3, cardIds: ['c1'] });
        expect(nudgeIsLive(store.getState().battle.battle, store.getState().battle.endTurnNudge)).toBe(true);
        store.dispatch(endTurn());
        expect(store.getState().battle.endTurnNudge).toBeNull();
    });

    it('flashes the button and lights only the playable card while nudged', () => {
        const markup = renderToStaticMarkup(<Provider store={storeWith({ turn: 3, cardIds: ['c1'] })}><CardHand /></Provider>);
        expect(markup).toMatch(/class="end-turn-button [^"]*\bnudge\b/);
        expect(markup.match(/nudge-playable/g)).toHaveLength(1);   // the nudge on screen lit c1 only
        expect(markup).toContain('press again to end the turn');

        const quiet = renderToStaticMarkup(<Provider store={storeWith(null)}><CardHand /></Provider>);
        expect(quiet).not.toContain('nudge');
    });
});
