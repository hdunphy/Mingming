import { describe, it, expect } from 'vitest';
import type { IBattleEntity, IBattleState } from '../../engine/types';
import { defaultSourceId, sideOf, sourceCandidates } from './sourceDefaults';

/**
 * The source picker's pre-fill rule (ticket 05 section 4). The load-bearing assertion in
 * this file is the negative one: the default is never the target itself, because
 * retaliation and thorns hooks compare source to target to decide whether to fire.
 */

function makeEntity(id: string, name: string, overrides: Partial<IBattleEntity> = {}): IBattleEntity {
    return {
        id, name, level: 5, experience: 0,
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
        sessionId: 'test', seed: '123', turn: 1, phase: 'ACTION', activeSide: 'PLAYER',
        activeRelics: [],
        playerParty: player, enemyParty: enemy,
        playerDeck: { ownerId: 'PLAYER', deck: [], drawpile: [], hand: [], discard: [], exhaust: [] },
        enemyDeck: { ownerId: 'ENEMY', deck: [], drawpile: [], hand: [], discard: [], exhaust: [] },
        logs: [], osLogs: [], procs: [], levelUpQueue: [],
        cardsPlayedThisTurn: 0, cardsDrawnThisTurn: 0, lastProgramPlayed: null, counters: {}
    };
}

const twoOnTwo = () => makeState(
    [makeEntity('p1', 'Hero'), makeEntity('p2', 'Sidekick')],
    [makeEntity('e1', 'Villain'), makeEntity('e2', 'Minion')]
);

describe('sideOf', () => {

    it('resolves both parties and nothing else', () => {
        const state = twoOnTwo();

        expect(sideOf(state, 'p2')).toBe('PLAYER');
        expect(sideOf(state, 'e2')).toBe('ENEMY');
        expect(sideOf(state, 'ghost')).toBeNull();
        expect(sideOf(state, null)).toBeNull();
    });
});

describe('defaultSourceId', () => {

    it('pre-fills the opposing party active unit for a player target', () => {
        expect(defaultSourceId(twoOnTwo(), 'p1')).toBe('e1');
    });

    it('pre-fills the opposing party active unit for an enemy target', () => {
        expect(defaultSourceId(twoOnTwo(), 'e1')).toBe('p1');
    });

    it('never self-attributes, even when the target is the only living unit on its side', () => {
        const state = makeState(
            [makeEntity('p1', 'Hero')],
            [makeEntity('e1', 'Villain', { currentHp: 0 }), makeEntity('e2', 'Minion', { currentHp: 0 })]
        );

        // Every opponent is down: fall through to any other living unit, or to null —
        // but under no circumstances back to the target.
        expect(defaultSourceId(state, 'p1')).toBeNull();
    });

    it('skips dead opponents to reach the first living one', () => {
        const state = makeState(
            [makeEntity('p1', 'Hero')],
            [makeEntity('e1', 'Villain', { currentHp: 0 }), makeEntity('e2', 'Minion')]
        );

        expect(defaultSourceId(state, 'p1')).toBe('e2');
    });

    it('honours a preferred id when it is a living opponent', () => {
        expect(defaultSourceId(twoOnTwo(), 'p1', 'e2')).toBe('e2');
    });

    it('ignores a preferred id that is an ally, dead, the target, or off-board', () => {
        const state = makeState(
            [makeEntity('p1', 'Hero'), makeEntity('p2', 'Sidekick')],
            [makeEntity('e1', 'Villain'), makeEntity('e2', 'Minion', { currentHp: 0 })]
        );

        expect(defaultSourceId(state, 'p1', 'p2')).toBe('e1');
        expect(defaultSourceId(state, 'p1', 'e2')).toBe('e1');
        expect(defaultSourceId(state, 'p1', 'p1')).toBe('e1');
        expect(defaultSourceId(state, 'p1', 'ghost')).toBe('e1');
    });

    it('falls back to any living unit when the target is not on the board', () => {
        expect(defaultSourceId(twoOnTwo(), 'ghost')).toBe('p1');
        expect(defaultSourceId(twoOnTwo(), null)).toBe('p1');
    });

    it('returns null when nothing is alive', () => {
        const state = makeState(
            [makeEntity('p1', 'Hero', { currentHp: 0 })],
            [makeEntity('e1', 'Villain', { currentHp: 0 })]
        );

        expect(defaultSourceId(state, 'p1')).toBeNull();
    });
});

describe('sourceCandidates', () => {

    it('lists living opponents first, then living allies, then the dead — never the target', () => {
        const state = makeState(
            [makeEntity('p1', 'Hero'), makeEntity('p2', 'Sidekick'), makeEntity('p3', 'Ghost', { currentHp: 0 })],
            [makeEntity('e1', 'Villain', { currentHp: 0 }), makeEntity('e2', 'Minion')]
        );

        expect(sourceCandidates(state, 'p1').map((e) => e.id)).toEqual(['e2', 'p2', 'e1', 'p3']);
    });

    it('offers every unit when the target is unknown', () => {
        expect(sourceCandidates(twoOnTwo(), null).map((e) => e.id)).toEqual(['p1', 'p2', 'e1', 'e2']);
    });
});
