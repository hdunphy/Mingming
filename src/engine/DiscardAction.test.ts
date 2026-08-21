import { describe, it, expect, vi } from 'vitest';
import type { IBattleState, IBattleEntity, ProgramEntity } from './types';
import { ActionExecutorRegistry } from './actions/ActionExecutors';
import { createMockEntity } from './data/battleFactories';
import { battleReducer } from './battleReducer';

// A card with a discardEffect, deliberately EXPENSIVE, so the priority test proves the
// discardEffect rule outranks the cheapest-first rule rather than coinciding with it.
vi.mock('./data/programRegistry', async (importOriginal) => {
    const original = await importOriginal<typeof import('./data/programRegistry')>();
    return {
        ...original,
        GetProgramData: vi.fn((id: string) =>
            id === 'test_cache_card'
                ? {
                    id: 'test_cache_card', name: 'Test Cache', description: '', element: 'Air',
                    target: 'Single', category: 'Skill', rarity: 'Common', baseCost: 3,
                    constraints: [], actions: [], discardEffect: [{ type: 'DRAW', amount: 1, target: 'SELF' }]
                }
                : original.GetProgramData(id))
    };
});

/**
 * Ticket 21 - the DISCARD self-cost action.
 *
 * `{ "type": "DISCARD", "count": N }` on a card (Lance, Cavalry Charge) removes N cards
 * from the acting side's own hand, chosen DETERMINISTICALLY: cards with a discardEffect
 * first (shedding them is upside), then cheapest baseCost, then hand order. No RNG at
 * all, so a replayed battle sheds exactly the same cards. FORCE_DISCARD and any caller
 * that sets isRandom explicitly keep their old behaviour.
 */

function stateWithHand(handDataIds: string[], seed = 'discard-seed', drawpileDataIds: string[] = []): IBattleState {
    return {
        sessionId: 'test-session',
        seed,
        turn: 1,
        phase: 'ACTION',
        activeSide: 'PLAYER',
        logs: [],
        osLogs: [],
        procs: [],
        playerParty: [createMockEntity('Player', 'sleipnir')],
        enemyParty: [createMockEntity('Enemy', 'fenrir')],
        playerDeck: {
            ownerId: 'PLAYER',
            deck: [],
            hand: handDataIds.map((dataId, i) => ({
                id: `h${i}`,
                dataId,
                currentCost: 0,
                isPlayable: true
            })) as ProgramEntity[],
            drawpile: drawpileDataIds.map((dataId, i) => ({
                id: `d${i}`,
                dataId,
                currentCost: 0,
                isPlayable: true
            })) as ProgramEntity[],
            discard: [],
            exhaust: []
        },
        enemyDeck: {
            ownerId: 'ENEMY', deck: [], drawpile: [], hand: [], discard: [], exhaust: []
        },
        cardsPlayedThisTurn: 0,
        cardsDrawnThisTurn: 0,
        lastProgramPlayed: null,
        counters: {},
        activeRelics: []
    } as unknown as IBattleState;
}

function discard(state: IBattleState, count: number): IBattleState {
    const selfId = state.playerParty[0].id;
    const executor = ActionExecutorRegistry['DISCARD'];
    return executor.execute(state, selfId, selfId, { type: 'DISCARD', count } as any, undefined, {} as any);
}

const HAND = ['water_slap', 'slipstream', 'tailwind', 'zephyr_strike', 'dust_devil'];

describe('DISCARD self-cost action (ticket 21)', () => {
    it('discards N cards from hand into the discard pile', () => {
        const before = stateWithHand(HAND);
        const after = discard(before, 2);

        expect(after.playerDeck.hand).toHaveLength(HAND.length - 2);
        expect(after.playerDeck.discard).toHaveLength(2);

        // Every card is still accounted for: nothing vanishes, nothing duplicates.
        const ids = [...after.playerDeck.hand, ...after.playerDeck.discard].map(c => c.id).sort();
        expect(ids).toEqual(before.playerDeck.hand.map(c => c.id).sort());
    });

    it('is deterministic: same hand in, same cards out, and the seed is untouched', () => {
        const runA = discard(stateWithHand(HAND, 'seed-alpha'), 2);
        const runB = discard(stateWithHand(HAND, 'seed-beta'), 2);

        const pick = (s: IBattleState) => s.playerDeck.discard.map(c => c.dataId);
        // Different seeds, identical result: the choice is a rule, not a roll.
        expect(pick(runA)).toEqual(pick(runB));
        expect(runA.seed).toBe('seed-alpha');
    });

    it('sheds the cheapest cards first, ties broken by hand order', () => {
        // HAND costs: water_slap 0, slipstream 0, tailwind 1, zephyr_strike 1, dust_devil 1
        const after = discard(stateWithHand(HAND), 2);

        expect(after.playerDeck.discard.map(c => c.dataId)).toEqual(['water_slap', 'slipstream']);
    });

    it('picks a discardEffect card over a cheaper plain one', () => {
        // test_cache_card costs 3 - the most expensive card in hand - but discarding it
        // is upside, so it goes before the 0-cost Tackle. (A stocked drawpile keeps its
        // "draw a card" discardEffect from recycling the discard pile back into hand.)
        const after = discard(stateWithHand(['water_slap', 'test_cache_card', 'slipstream'], 'seed', ['dust_devil', 'tailwind']), 1);

        expect(after.playerDeck.discard.map(c => c.dataId)).toEqual(['test_cache_card']);
    });

    it('discards what is there when the hand is smaller than N', () => {
        const after = discard(stateWithHand(['water_slap']), 2);

        expect(after.playerDeck.hand).toHaveLength(0);
        expect(after.playerDeck.discard).toHaveLength(1);
    });

    it('is safe on an empty hand', () => {
        const after = discard(stateWithHand([]), 2);

        expect(after.playerDeck.hand).toHaveLength(0);
        expect(after.playerDeck.discard).toHaveLength(0);
    });

    it('logs one line per discarded card', () => {
        const after = discard(stateWithHand(HAND), 2);
        const lines = after.logs.filter(l => l.includes('discards'));

        expect(lines).toHaveLength(2);
        expect(lines[0]).toMatch(/discards .+!$/);
    });
});

/**
 * End-to-end through the reducer: Lance ("55 power. Discard a random card.") must
 * spend from the PLAYER's hand even though the card targets an enemy, and
 * `count: 2` on Cavalry Charge must discard two cards rather than running the
 * whole action twice (the reducer's generic multi-hit `count` is suppressed for
 * DISCARD).
 */
const unit = (id: string, name: string, overrides: Partial<IBattleEntity> = {}): IBattleEntity => ({
    id, name,
    currentHp: 4000, maxHp: 4000, tempHp: 0,
    attack: 10, defense: 10,
    maxEnergy: 5, currentEnergy: 5,
    cardDraw: 3,
    statusEffects: [], definitionId: 'sleipnir', hooks: [], speed: 10,
    primaryElement: 'Air', daemons: [], blueprintsCollected: 0,
    hpIV: 0, attackIV: 0, defenseIV: 0,
    ...overrides
});

function reducerState(hand: ProgramEntity[]): IBattleState {
    return {
        sessionId: 'test-session',
        turn: 1,
        phase: 'ACTION',
        activeSide: 'PLAYER',
        activeRelics: [],
        playerParty: [unit('p1', 'Sleipnir')],
        enemyParty: [unit('e1', 'Enemy', { definitionId: 'fenrir' })],
        playerDeck: { ownerId: 'PLAYER', hand, drawpile: [], discard: [], exhaust: [], deck: [] },
        enemyDeck: { ownerId: 'ENEMY', hand: [], drawpile: [], discard: [], exhaust: [], deck: [] },
        logs: [], osLogs: [], procs: [],
        seed: '12345',
        cardsPlayedThisTurn: 0,
        cardsDrawnThisTurn: 0,
        lastProgramPlayed: null,
        counters: {}
    } as unknown as IBattleState;
}

const entity = (id: string, dataId: string, cost: number): ProgramEntity =>
    ({ id, dataId, currentCost: cost, isPlayable: true } as ProgramEntity);

describe('DISCARD through the reducer (Lance / Cavalry Charge)', () => {
    it('Lance discards one card from the PLAYER hand, not the enemy hand', () => {
        const state = reducerState([
            entity('c1', 'lance', 1),
            entity('c2', 'water_slap', 0),
            entity('c3', 'tailwind', 1)
        ]);

        const after = battleReducer(state, {
            type: 'PLAY_PROGRAM',
            payload: { sourceId: 'p1', targetId: 'e1', programId: 'c1' }
        });

        // Lance itself left the hand on play; the DISCARD then takes one more.
        expect(after.playerDeck.hand).toHaveLength(1);
        expect(after.enemyDeck.hand).toHaveLength(0);
        expect(after.enemyParty[0].currentHp).toBeLessThan(4000); // the attack still resolved
    });

    it('Cavalry Charge discards two cards and deals its damage once', () => {
        const state = reducerState([
            entity('c1', 'cavalry_charge', 2),
            entity('c2', 'water_slap', 0),
            entity('c3', 'tailwind', 1),
            entity('c4', 'slipstream', 0)
        ]);

        const after = battleReducer(state, {
            type: 'PLAY_PROGRAM',
            payload: { sourceId: 'p1', targetId: 'e1', programId: 'c1' }
        });

        expect(after.playerDeck.hand).toHaveLength(1);
        // One ATTACK resolution, not two: `count` is the discard size, not a repeat.
        expect(after.logs.filter(l => l.includes('discards'))).toHaveLength(2);
    });
});
