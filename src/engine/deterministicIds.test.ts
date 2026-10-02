/**
 * TICKET 186a — the ids the battle engine makes are the same every time.
 *
 * A status instance and a generated card used to get `crypto.randomUUID()`, so the same battle played
 * twice gave two states that differed in those ids alone, and a recorded run could not be compared
 * with its replay. Now both ids come from what is already in the state: a function of the state, never
 * of the clock or a random source.
 */
import { describe, expect, it } from 'vitest';

import { effectHandlers } from './effectHandlers';
import { getStatusBehavior } from './StatusBehaviors';
import { createSparseBattleState, createSparseEntity } from '../debug/scenarios/scenarioTestSupport';
import { StatusType, type IBattleState, type ProgramEntity, type StatusEffectInstance } from './types';

const target = createSparseEntity({ id: 'e1', definitionId: 'fenrir', name: 'Foe' });
const card = (id: string, dataId = 'tackle'): ProgramEntity => ({ id, dataId, currentCost: 0, isPlayable: true } as ProgramEntity);

const board = (hand: ProgramEntity[] = [], discard: ProgramEntity[] = []): IBattleState =>
    createSparseBattleState({
        activeSide: 'PLAYER',
        phase: 'ACTION',
        playerParty: [createSparseEntity({ id: 'p1', definitionId: 'kraken', name: 'Kraken' })],
        enemyParty: [target],
        playerDeck: { ownerId: 'PLAYER', deck: [], drawpile: [], hand, discard, exhaust: [] },
    });

const apply = (type: keyof typeof StatusType, current: StatusEffectInstance[] = [], stacks = 2): StatusEffectInstance[] =>
    getStatusBehavior(StatusType[type]).onApply(current, stacks, target).updatedEffects;

describe('186a — status instance ids', () => {
    it('applying the same status to the same entity twice gives the same instance, id and all', () => {
        for (const type of ['Burn', 'Poison', 'Weakened', 'Strengthened', 'Dazed'] as const) {
            expect(apply(type), type).toEqual(apply(type));
        }
    });

    it('two different statuses on one entity never share an id', () => {
        const both = apply('Weakened', apply('Strengthened'));
        expect(both).toHaveLength(2);
        expect(new Set(both.map((s) => s.id)).size).toBe(2);
    });

    it('is not a random UUID', () => {
        expect(apply('Burn')[0].id).not.toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/);
    });
});

describe('186a — generated card ids', () => {
    const generate = (state: IBattleState): IBattleState => effectHandlers.GENERATE_CARD(state, { sourceId: 'p1', dataId: 'tackle' });

    it('generating a card in the same state twice gives the same card', () => {
        expect(generate(board()).playerDeck.hand).toEqual(generate(board()).playerDeck.hand);
    });

    it('two generated cards in a row get different ids', () => {
        const hand = generate(generate(board())).playerDeck.hand;
        expect(hand).toHaveLength(2);
        expect(hand[0].id).not.toBe(hand[1].id);
    });

    it('a generated card never takes an id that is already in the deck, in any pile', () => {
        const first = generate(board()).playerDeck.hand[0].id;
        // put a card with that very id in the discard pile and generate again: it must pick another
        const second = generate(board([], [card(first)])).playerDeck.hand[0].id;
        expect(second).not.toBe(first);
    });

    it('is not a random UUID', () => {
        expect(generate(board()).playerDeck.hand[0].id).not.toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/);
    });
});
