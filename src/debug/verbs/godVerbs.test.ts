import { describe, it, expect } from 'vitest';
import type { IBattleEntity, IBattleState, IMove } from '../../engine/types';
import {
    DEBUG_LOG_PREFIX,
    DEBUG_NO_OP_SUFFIX,
    GOD_VERBS,
    GOD_VERBS_BY_ID,
    addCardToHand,
    applyStatus,
    clearStatus,
    executeIntent,
    killEntity,
    setEnergy,
    setHp,
    setIntent,
    setTempHp,
    skipTurn,
} from './godVerbs';

/**
 * The verbs are pure `(state, args) => IBattleState` functions, so this suite is
 * headless: no React, no Redux, no store. Each verb is checked for BOTH halves of its
 * contract — the state delta the engine action produces, and the exact `[DEBUG]` line
 * appended on top of whatever the engine logged itself.
 *
 * Fixtures are local on purpose (mirroring src/engine/EngineStateActions.test.ts) so
 * this file has no dependency on debug-side test support that may move.
 */

function makeEntity(id: string, name: string, overrides: Partial<IBattleEntity> = {}): IBattleEntity {
    return {
        id, name, 
        maxHp: 100, attack: 10, defense: 10, maxEnergy: 10, cardDraw: 1,
        currentHp: 100, currentEnergy: 10,
        primaryElement: 'Fire', statusEffects: [],
        definitionId: 'fenrir', tempHp: 0, speed: 10, hooks: [],
        daemons: [], blueprintsCollected: 0, hpIV: 0, attackIV: 0, defenseIV: 0,
        ...overrides
    };
}

function makeState(player: IBattleEntity[], enemy: IBattleEntity[]): IBattleState {
    return {
        sessionId: 'test', seed: '123', turn: 3, phase: 'ACTION', activeSide: 'PLAYER',
        activeRelics: [],
        playerParty: player, enemyParty: enemy,
        playerDeck: { ownerId: 'PLAYER', deck: [], drawpile: [], hand: [], discard: [], exhaust: [] },
        enemyDeck: { ownerId: 'ENEMY', deck: [], drawpile: [], hand: [], discard: [], exhaust: [] },
        logs: ['existing engine log'],
        osLogs: [],
        procs: [],
        cardsPlayedThisTurn: 0,
        cardsDrawnThisTurn: 0,
        lastProgramPlayed: null,
        counters: {}
    };
}

const baseState = () => makeState([makeEntity('p1', 'Hero')], [makeEntity('e1', 'Villain')]);

/** The `[DEBUG]` line a verb wrote. Verbs append exactly one, always last. */
const debugLines = (state: IBattleState) => state.logs.filter((l) => l.startsWith(DEBUG_LOG_PREFIX));
const lastLog = (state: IBattleState) => state.logs[state.logs.length - 1];

describe('verb logging contract', () => {

    it('appends exactly one [DEBUG] line, last, without dropping the engine log', () => {
        const state = baseState();
        const next = setHp(state, { entityId: 'p1', hp: 40, sourceId: 'e1' });

        expect(debugLines(next)).toHaveLength(1);
        expect(lastLog(next).startsWith(DEBUG_LOG_PREFIX)).toBe(true);
        expect(next.logs[0]).toBe('existing engine log');
        // The engine wrote its own line for the vitals change; the debug line is on top.
        expect(next.logs.length).toBeGreaterThan(2);
    });

    it('does not mutate the state it was handed', () => {
        const state = baseState();
        setHp(state, { entityId: 'p1', hp: 40, sourceId: 'e1' });

        expect(state.playerParty[0].currentHp).toBe(100);
        expect(state.logs).toEqual(['existing engine log']);
    });

    it('marks the line as a no-op when the engine refuses the action', () => {
        const state = baseState();
        const next = setHp(state, { entityId: 'ghost', hp: 40, sourceId: 'e1' });

        expect(lastLog(next).endsWith(DEBUG_NO_OP_SUFFIX)).toBe(true);
        expect(next.logs).toHaveLength(2);
        expect(next.playerParty).toEqual(state.playerParty);
    });

    it('rejects a sourceId that is not a unit on this board, and says so', () => {
        const state = baseState();
        const next = setHp(state, { entityId: 'p1', hp: 40, sourceId: 'SYSTEM' });

        expect(next.playerParty[0].currentHp).toBe(100);
        expect(lastLog(next)).toBe(
            `${DEBUG_LOG_PREFIX} SET_VITALS: Hero (p1) HP → 40 (source: SYSTEM)${DEBUG_NO_OP_SUFFIX}`
        );
    });
});

describe('setHp / setEnergy / setTempHp (SET_VITALS)', () => {

    it('sets HP and credits the picked source', () => {
        const next = setHp(baseState(), { entityId: 'p1', hp: 40, sourceId: 'e1' });

        expect(next.playerParty[0].currentHp).toBe(40);
        expect(lastLog(next)).toBe(`${DEBUG_LOG_PREFIX} SET_VITALS: Hero (p1) HP → 40 (source: Villain (e1))`);
    });

    it('sets energy without touching HP or shield', () => {
        const next = setEnergy(baseState(), { entityId: 'p1', energy: 2, sourceId: 'e1' });

        expect(next.playerParty[0].currentEnergy).toBe(2);
        expect(next.playerParty[0].currentHp).toBe(100);
        expect(next.playerParty[0].tempHp).toBe(0);
        expect(lastLog(next)).toBe(`${DEBUG_LOG_PREFIX} SET_VITALS: Hero (p1) energy → 2`);
    });

    it('sets shield without touching HP or energy', () => {
        const next = setTempHp(baseState(), { entityId: 'p1', tempHp: 7, sourceId: 'e1' });

        expect(next.playerParty[0].tempHp).toBe(7);
        expect(next.playerParty[0].currentHp).toBe(100);
        expect(next.playerParty[0].currentEnergy).toBe(10);
        expect(lastLog(next)).toBe(`${DEBUG_LOG_PREFIX} SET_VITALS: Hero (p1) shield → 7`);
    });
});

describe('applyStatus (APPLY_STATUS, pre-existing action)', () => {

    it('applies stacks and records the attribution', () => {
        const next = applyStatus(baseState(), { targetId: 'p1', status: 'Burn', stacks: 3, sourceId: 'e1' });

        const burn = next.playerParty[0].statusEffects.find((s) => s.type === 'Burn');
        expect(burn?.stacks).toBe(3);
        expect(lastLog(next)).toBe(`${DEBUG_LOG_PREFIX} APPLY_STATUS: Burn x3 → Hero (p1) (source: Villain (e1))`);
    });

    it('says so when the caller deliberately left the source off', () => {
        const next = applyStatus(baseState(), { targetId: 'p1', status: 'Burn', stacks: 1 });

        expect(lastLog(next)).toBe(`${DEBUG_LOG_PREFIX} APPLY_STATUS: Burn x1 → Hero (p1) (unattributed)`);
    });
});

describe('clearStatus (REMOVE_STATUS)', () => {

    const withStatuses = () => makeState(
        [makeEntity('p1', 'Hero', {
            statusEffects: [
                { id: 's_burn', type: 'Burn', stacks: 2 },
                { id: 's_poison', type: 'Poison', stacks: 1 },
            ]
        })],
        [makeEntity('e1', 'Villain')]
    );

    it('clears one named status', () => {
        const next = clearStatus(withStatuses(), { entityId: 'p1', status: 'Burn' });

        expect(next.playerParty[0].statusEffects.map((s) => s.type)).toEqual(['Poison']);
        expect(lastLog(next)).toBe(`${DEBUG_LOG_PREFIX} REMOVE_STATUS: cleared Burn from Hero (p1)`);
    });

    it('clears everything when no status is named', () => {
        const next = clearStatus(withStatuses(), { entityId: 'p1' });

        expect(next.playerParty[0].statusEffects).toHaveLength(0);
        expect(lastLog(next)).toBe(`${DEBUG_LOG_PREFIX} REMOVE_STATUS: cleared all statuses from Hero (p1)`);
    });

    it('logs a no-op when there was nothing to clear', () => {
        const next = clearStatus(baseState(), { entityId: 'p1', status: 'Burn' });

        expect(lastLog(next).endsWith(DEBUG_NO_OP_SUFFIX)).toBe(true);
    });
});

describe('addCardToHand (ADD_CARD_TO_HAND)', () => {

    it('puts the card in the requested side hand', () => {
        const next = addCardToHand(baseState(), { side: 'PLAYER', dataId: 'strength_burst' });

        expect(next.playerDeck.hand).toHaveLength(1);
        expect(next.playerDeck.hand[0].dataId).toBe('strength_burst');
        expect(next.enemyDeck.hand).toHaveLength(0);
        expect(lastLog(next)).toBe(`${DEBUG_LOG_PREFIX} ADD_CARD_TO_HAND: strength_burst → PLAYER hand`);
    });

    it('routes to the enemy hand for the enemy side', () => {
        const next = addCardToHand(baseState(), { side: 'ENEMY', dataId: 'strength_burst' });

        expect(next.enemyDeck.hand).toHaveLength(1);
        expect(next.playerDeck.hand).toHaveLength(0);
        expect(lastLog(next)).toBe(`${DEBUG_LOG_PREFIX} ADD_CARD_TO_HAND: strength_burst → ENEMY hand`);
    });
});

describe('setIntent (SET_INTENT)', () => {

    const move: IMove = {
        id: 'move_slam', name: 'Slam', intentType: 'Attack', priority: 1,
        actions: [{ type: 'ATTACK', target: 'Single', power: 10, element: 'None' }]
    };

    it('telegraphs the move', () => {
        const next = setIntent(baseState(), { entityId: 'e1', move });

        expect(next.enemyParty[0].currentIntent).toEqual(move);
        expect(lastLog(next)).toBe(`${DEBUG_LOG_PREFIX} SET_INTENT: Villain (e1) → Slam`);
    });

    it('clears the telegraph with null', () => {
        const state = makeState([makeEntity('p1', 'Hero')], [makeEntity('e1', 'Villain', { currentIntent: move })]);
        const next = setIntent(state, { entityId: 'e1', move: null });

        expect(next.enemyParty[0].currentIntent).toBeNull();
        expect(lastLog(next)).toBe(`${DEBUG_LOG_PREFIX} SET_INTENT: Villain (e1) → (cleared)`);
    });
});

describe('executeIntent (EXECUTE_INTENT, pre-existing action)', () => {

    const move: IMove = {
        id: 'move_slam', name: 'Slam', intentType: 'Attack', priority: 1,
        actions: [{ type: 'ATTACK', target: 'Single', power: 40, element: 'None' }]
    };

    it('resolves the telegraphed move immediately', () => {
        const state = makeState([makeEntity('p1', 'Hero')], [makeEntity('e1', 'Villain', { currentIntent: move })]);
        const next = executeIntent(state, { entityId: 'e1' });

        expect(next.enemyParty[0].currentIntent).toBeNull();
        expect(next.playerParty[0].currentHp).toBeLessThan(100);
        expect(lastLog(next)).toBe(`${DEBUG_LOG_PREFIX} EXECUTE_INTENT: Villain (e1) acts now`);
    });

    it('is a no-op for a unit with no intent, and for a player-party unit', () => {
        const state = makeState([makeEntity('p1', 'Hero')], [makeEntity('e1', 'Villain')]);

        expect(lastLog(executeIntent(state, { entityId: 'e1' })).endsWith(DEBUG_NO_OP_SUFFIX)).toBe(true);
        expect(lastLog(executeIntent(state, { entityId: 'p1' })).endsWith(DEBUG_NO_OP_SUFFIX)).toBe(true);
    });
});

describe('skipTurn (END_TURN, pre-existing action)', () => {

    it('hands the turn over and names the side that was skipped', () => {
        const state = baseState();
        const next = skipTurn(state);

        expect(next.activeSide).toBe('ENEMY');
        expect(lastLog(next)).toBe(`${DEBUG_LOG_PREFIX} END_TURN: skipped PLAYER on turn 3`);
    });
});

describe('killEntity (KILL_ENTITY)', () => {

    it('drops the unit to 0 and credits the mandatory source', () => {
        const next = killEntity(baseState(), { entityId: 'e1', sourceId: 'p1' });

        expect(next.enemyParty[0].currentHp).toBe(0);
        expect(lastLog(next)).toBe(`${DEBUG_LOG_PREFIX} KILL_ENTITY: Villain (e1) killed by Hero (p1)`);
    });

    it('is a no-op against an already-dead unit', () => {
        const state = makeState([makeEntity('p1', 'Hero')], [makeEntity('e1', 'Villain', { currentHp: 0 })]);
        const next = killEntity(state, { entityId: 'e1', sourceId: 'p1' });

        expect(lastLog(next).endsWith(DEBUG_NO_OP_SUFFIX)).toBe(true);
    });
});

describe('GOD_VERBS catalog', () => {

    it('is the ten v1 verbs from ticket 05 section 1', () => {
        expect(GOD_VERBS).toHaveLength(10);
        expect(GOD_VERBS.map((v) => v.id)).toEqual([
            'setHp', 'setEnergy', 'setTempHp', 'applyStatus', 'clearStatus',
            'addCardToHand', 'setIntent', 'executeIntent', 'skipTurn', 'killEntity',
        ]);
        expect(Object.keys(GOD_VERBS_BY_ID)).toHaveLength(10);
    });

    it('marks exactly APPLY_STATUS / END_TURN / EXECUTE_INTENT as pre-existing engine actions', () => {
        const preExisting = GOD_VERBS.filter((v) => !v.isNewAction).map((v) => v.action);

        expect([...new Set(preExisting)].sort()).toEqual(['APPLY_STATUS', 'END_TURN', 'EXECUTE_INTENT']);
    });

    it('requires a source on the two verbs whose engine action mandates one', () => {
        const required = GOD_VERBS.filter((v) => v.source === 'required').map((v) => v.id);

        expect(required).toEqual(['setHp', 'killEntity']);
    });
});
