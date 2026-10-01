/**
 * TICKET 177a — every single play the AI could make right now, in the order the search walks them.
 *
 * `legalActions` is the enumeration that used to live inside `findBestSequence`, moved out so the
 * cheap policy (177b) can read the same list. The ORDER is part of the contract: `bestScore`
 * improves on a strict `>`, so among equal lines the first one visited wins, and the cheap policy's
 * tie-break ("the earlier action") is only meaningful if both read the list the same way.
 */
import { describe, it, expect } from 'vitest';
import { legalActions, legalPlays } from './legalActions';
import { createSparseBattleState, createSparseEntity } from '../../debug/scenarios/scenarioTestSupport';
import type { IBattleState, ProgramEntity } from '../types';

const card = (id: string, dataId: string, currentCost = 1): ProgramEntity => (
    { id, dataId, currentCost, isPlayable: true }
);

function board(overrides: Partial<IBattleState> = {}): IBattleState {
    return createSparseBattleState({
        activeSide: 'PLAYER',
        phase: 'ACTION',
        playerParty: [
            createSparseEntity({ id: 'p1', name: 'Caster', currentHp: 900, maxHp: 1000, currentEnergy: 2, maxEnergy: 3 }),
            createSparseEntity({
                id: 'p2', name: 'Stunned', currentHp: 900, maxHp: 1000, currentEnergy: 3, maxEnergy: 3,
                statusEffects: [{ id: 'st1', type: 'Stunned', stacks: 1 }],
            }),
        ],
        enemyParty: [
            createSparseEntity({ id: 'e1', name: 'Foe 1', currentHp: 900, maxHp: 1000 }),
            createSparseEntity({ id: 'e2', name: 'Foe 2', currentHp: 900, maxHp: 1000 }),
        ],
        playerDeck: {
            ownerId: 'PLAYER', deck: [], drawpile: [], discard: [], exhaust: [],
            // Drawn in an order that is NOT the canonical one, with a pair of water_slap (the copy
            // must be deduped) and a card p1 cannot afford (3 against 2 Energy).
            hand: [
                card('h0', 'water_slap'),
                card('h1', 'iron_bark'),
                card('h2', 'water_slap'),
                card('h3', 'growth'),
                card('h4', 'baseline_jab', 3),
            ],
        },
        ...overrides,
    });
}

const describePlay = (a: ReturnType<typeof legalActions>[number]): string => (
    a.type === 'PLAY_PROGRAM'
        ? `${a.payload.sourceId}>${a.payload.targetId}:${a.payload.programId}`
        : a.type
);

describe('177a — legalActions', () => {
    it('lists the plays in canonical hand order, one per distinct copy, ending with END_TURN', () => {
        const actions = legalActions(board(), 'PLAYER');
        expect(actions.map(describePlay)).toEqual([
            // growth (an ally card): every living friendly body.
            'p1>p1:h3', 'p1>p2:h3',
            // iron_bark (Self): the caster only, once.
            'p1>p1:h1',
            // water_slap: the FIRST copy by id only (h2 is the deduped twin), each living enemy.
            'p1>e1:h0', 'p1>e2:h0',
            'END_TURN',
        ]);
    });

    it('a stunned caster and an unaffordable card contribute nothing', () => {
        const actions = legalActions(board(), 'PLAYER').map(describePlay);
        expect(actions.some((a) => a.startsWith('p2>'))).toBe(false);
        expect(actions.some((a) => a.endsWith(':h4'))).toBe(false);
    });

    it('a downed enemy is not a target, and a downed caster does not cast', () => {
        const state = board();
        const downed: IBattleState = {
            ...state,
            enemyParty: [state.enemyParty[0], { ...state.enemyParty[1], currentHp: 0 }],
        };
        const actions = legalActions(downed, 'PLAYER').map(describePlay);
        expect(actions).toContain('p1>e1:h0');
        expect(actions).not.toContain('p1>e2:h0');
    });

    it('an empty hand, or nobody left to fight, leaves only END_TURN', () => {
        const empty = board();
        const noHand: IBattleState = { ...empty, playerDeck: { ...empty.playerDeck, hand: [] } };
        expect(legalActions(noHand, 'PLAYER')).toEqual([{ type: 'END_TURN' }]);

        const nobody: IBattleState = { ...empty, enemyParty: empty.enemyParty.map((e) => ({ ...e, currentHp: 0 })) };
        expect(legalActions(nobody, 'PLAYER')).toEqual([{ type: 'END_TURN' }]);
    });

    it('reads the other side\'s hand and party for ENEMY', () => {
        const state = board();
        const flipped: IBattleState = {
            ...state,
            activeSide: 'ENEMY',
            enemyDeck: {
                ...state.enemyDeck,
                hand: [card('x0', 'baseline_jab', 1)],
            },
            enemyParty: state.enemyParty.map((e) => ({ ...e, currentEnergy: 2 })),
        };
        const actions = legalActions(flipped, 'ENEMY').map(describePlay);
        expect(actions).toEqual([
            'e1>p1:x0', 'e1>p2:x0', 'e2>p1:x0', 'e2>p2:x0', 'END_TURN',
        ]);
    });

    it('does not write to the state it reads, and the same state gives the same list', () => {
        const state = board();
        const handBefore = [...state.playerDeck.hand];
        const first = legalActions(state, 'PLAYER');
        const second = legalActions(state, 'PLAYER');
        expect(second).toEqual(first);
        expect(state.playerDeck.hand).toEqual(handBefore);
    });

    it('legalPlays is legalActions without the END_TURN, and tallies for the census', () => {
        const state = board();
        const tally = { enumerated: 0, duplicate: 0, deduped: 0 };
        const plays = legalPlays(state, 'PLAYER', tally);
        expect(plays.map(describePlay)).toEqual(legalActions(state, 'PLAYER').slice(0, -1).map(describePlay));
        // 6 plays enumerated, one deduped copy, and no duplicate (source, target, card) triple.
        expect(tally).toEqual({ enumerated: 5, duplicate: 0, deduped: 1 });
    });
});
