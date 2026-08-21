/**
 * Hand-built battle states for the scenario-schema tests.
 *
 * Test-only: nothing in the shipped toolkit imports this module. It exists as its own
 * file rather than living inside one `.test.ts` so both the normalizer tests and the
 * loader tests can share one builder without a test file importing another test file
 * (which would re-register its `describe` blocks).
 *
 * Modelled on `SnapshotPattern.test.ts`'s `createMockState`, but with real registry
 * definitionIds so `GetMingmingData` resolves an `activeOS` without warning.
 */

import type { IBattleEntity, IBattleState } from '../../engine/types';

/**
 * An entity with every optional field omitted - the shape `JSON.stringify` leaves behind
 * and the exact input the normalizer's fill class exists for (audit gap #9).
 */
export function createSparseEntity(overrides: Partial<IBattleEntity> = {}): IBattleEntity {
    return {
        id: 'p1',
        definitionId: 'fenrir',
        blueprintsCollected: 0,
        attackIV: 0,
        defenseIV: 0,
        hpIV: 0,

        name: 'Fenrir',
        maxHp: 100,
        cardDraw: 3,
        maxEnergy: 3,
        attack: 20,
        defense: 15,
        speed: 10,
        primaryElement: 'Fire',

        currentHp: 100,
        currentEnergy: 3,
        tempHp: 0,
        statusEffects: [],
        daemons: [],
        ...overrides,
    };
}

/** An entity carrying a real value in every fill-class and strip-class field. */
export function createRichEntity(overrides: Partial<IBattleEntity> = {}): IBattleEntity {
    return createSparseEntity({
        id: 'e1',
        definitionId: 'draugr',
        name: 'Draugr',
        primaryElement: 'Dark',
        secondaryElement: 'Ice',
        relicBonuses: { draw: 1, energy: 2, attackMod: 1.5 },
        hooks: ['hook_a'],
        activeOS: 'draugr_v2',
        playsThisTurn: 2,
        forcedTargetId: 'p1',
        nextProgramModifier: { multiplier: 2, appliesTo: 'Attack' },
        currentIntent: {
            id: 'draugr_swipe',
            name: 'Swipe',
            intentType: 'Attack',
            priority: 5,
            actions: [{ type: 'ATTACK', power: 12, target: 'Single' }],
        },
        moves: [
            {
                id: 'draugr_swipe',
                name: 'Swipe',
                intentType: 'Attack',
                priority: 5,
                actions: [{ type: 'ATTACK', power: 12, target: 'Single' }],
            },
        ],
        statusEffects: [{ id: 'st1', type: 'Burn', stacks: 3 }],
        ...overrides,
    });
}

/**
 * A state with every optional field omitted at both the state and the entity level.
 */
export function createSparseBattleState(overrides: Partial<IBattleState> = {}): IBattleState {
    return {
        sessionId: 'battle_test',
        seed: 'seed-0001',
        turn: 1,
        phase: 'ACTION',
        activeSide: 'PLAYER',
        activeRelics: [],

        playerParty: [createSparseEntity()],
        enemyParty: [createSparseEntity({ id: 'e1', definitionId: 'draugr', name: 'Draugr' })],

        playerDeck: {
            ownerId: 'PLAYER',
            deck: ['ignite'],
            drawpile: [],
            hand: [{ id: 'c1', dataId: 'ignite', currentCost: 1, isPlayable: true }],
            discard: [],
            exhaust: [],
        },
        enemyDeck: { ownerId: 'ENEMY', deck: [], drawpile: [], hand: [], discard: [], exhaust: [] },

        logs: [],
        osLogs: [],
        procs: [],
        cardsPlayedThisTurn: 0,
        cardsDrawnThisTurn: 0,
        lastProgramPlayed: null,
        counters: {},
        ...overrides,
    };
}

/** A state whose optional fields all carry real values. */
export function createRichBattleState(overrides: Partial<IBattleState> = {}): IBattleState {
    return createSparseBattleState({
        enemyMode: 'CARDS',
        lastStatusConsumed: 4,
        elementPlays: {
            Fire: 2,
            Water: 0,
            Earth: 0,
            Air: 0,
            Nature: 0,
            Ice: 0,
            Light: 0,
            Dark: 1,
            None: 0,
        },
        playerParty: [createSparseEntity({ activeOS: 'fenrir_v2' })],
        enemyParty: [createRichEntity()],
        ...overrides,
    });
}
