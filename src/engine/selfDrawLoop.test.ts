/**
 * TICKET 111 regression: a card cannot draw ITSELF back out of the discard.
 *
 * `handlePlayProgram` moves the played card to the discard while paying its cost - step 3, BEFORE
 * any of its actions resolve - and `drawCards` reshuffles the discard whenever the drawpile is
 * empty. A 0-cost "draw a card" played on an empty drawpile therefore used to find its own copy in
 * the discard it had just been placed in, shuffle it back, and draw it into hand: the state after
 * was identical to the state before, minus one advanced seed, and the card costs 0 Energy so nothing
 * bounded the repetition.
 *
 * It was not hypothetical. `valkyrie_v2` reached it in ordinary play - 213 glimmer plays a game, a
 * streak of 249, and 43 of 60 games in her `huldra_v1` cell never deciding - and it had been sitting
 * in the committed 960-cell deck grid the whole time, because `runPairedBatch`'s per-turn action cap
 * ends the game and the sim records an ordinary truncated result. A human sits in a turn that never
 * ends.
 *
 * The fix holds the RESOLVING INSTANCE out of a mid-resolution reshuffle (`state.resolvingCardInstanceId`
 * -> `drawCards`). The third test below is the reason it is keyed on the instance and not the dataId.
 *
 * VERIFIED TO FAIL WITHOUT THE FIX: with the exclusion removed, test 1 draws glimmer straight back
 * into hand and test 3's assertion on which copy moved no longer holds.
 */

import { describe, it, expect } from 'vitest';
import { battleReducer } from './battleReducer';
import { createSparseBattleState, createSparseEntity } from '../debug/scenarios/scenarioTestSupport';
import type { IBattleState, ProgramEntity } from './types';

const glimmer = (instance: string): ProgramEntity =>
    ({ id: instance, dataId: 'glimmer', currentCost: 0, isPlayable: true } as ProgramEntity);
const filler = (instance: string): ProgramEntity =>
    ({ id: instance, dataId: 'radiant_spark', currentCost: 0, isPlayable: true } as ProgramEntity);

function stateWith(deck: Partial<{ hand: ProgramEntity[]; drawpile: ProgramEntity[]; discard: ProgramEntity[] }>): IBattleState {
    return createSparseBattleState({
        activeSide: 'PLAYER',
        phase: 'ACTION',
        playerParty: [createSparseEntity({ id: 'p1', definitionId: 'valkyrie', name: 'Valkyrie', cardDraw: 3 })],
        playerDeck: {
            ownerId: 'PLAYER',
            deck: ['glimmer'],
            drawpile: deck.drawpile ?? [],
            hand: deck.hand ?? [],
            discard: deck.discard ?? [],
            exhaust: [],
        },
    });
}

const play = (state: IBattleState, programId: string): IBattleState =>
    battleReducer(state, {
        type: 'PLAY_PROGRAM',
        payload: { sourceId: 'p1', targetId: 'p1', programId },
    } as never);

describe('ticket 111 - the self-draw loop', () => {
    it('does not reshuffle the resolving card into its own draw', () => {
        const before = stateWith({ hand: [glimmer('g1')], drawpile: [], discard: [] });
        const after = play(before, 'g1');

        // The draw finds an empty drawpile and a discard holding only the card that is resolving,
        // so it draws nothing. Before the fix, glimmer came straight back and the loop was open.
        expect(after.playerDeck.hand.map(c => c.dataId)).not.toContain('glimmer');
        expect(after.playerDeck.hand).toHaveLength(0);
        expect(after.playerDeck.discard.map(c => c.id)).toEqual(['g1']);
        expect(after.playerDeck.drawpile).toHaveLength(0);
    });

    it('still reshuffles the rest of the discard - the fix must not kill ordinary draws', () => {
        const before = stateWith({
            hand: [glimmer('g1')],
            drawpile: [],
            discard: [filler('f1'), filler('f2')],
        });
        const after = play(before, 'g1');

        // Two ordinary cards were in the discard; one of them should now be in hand, and the
        // resolving glimmer should be the thing left behind rather than the thing drawn.
        expect(after.playerDeck.hand).toHaveLength(1);
        expect(after.playerDeck.hand[0].dataId).toBe('radiant_spark');
        expect(after.playerDeck.discard.map(c => c.id)).toContain('g1');
    });

    it('excludes only the RESOLVING copy, so a second copy is still drawable', () => {
        // Keyed on the instance id, not the dataId: holding out every copy of the card would be a
        // different and wrong rule - a deck running two glimmers should still draw the other one.
        const before = stateWith({
            hand: [glimmer('g1')],
            drawpile: [],
            discard: [glimmer('g2')],
        });
        const after = play(before, 'g1');

        expect(after.playerDeck.hand).toHaveLength(1);
        expect(after.playerDeck.hand[0].id).toBe('g2');
        expect(after.playerDeck.discard.map(c => c.id)).toEqual(['g1']);
    });

    it('clears the resolving marker once the card has finished resolving', () => {
        const before = stateWith({ hand: [glimmer('g1')], drawpile: [], discard: [] });
        const after = play(before, 'g1');
        // Left set, the card would be frozen out of every future reshuffle for the rest of the game.
        expect(after.resolvingCardInstanceId ?? null).toBeNull();
    });
});
