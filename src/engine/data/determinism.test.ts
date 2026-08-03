import { describe, it, expect } from 'vitest';
import { createBattleState, createMockEntity, instantiateDeck } from './battleFactories';
import type { BattleOptions } from './battleFactories';
import { generateEncounter } from './EncounterGenerator';
import { SeedStream, rollSeed } from '../core/SeedStream';
import type { IPlayerSave } from '../gameTypes';
import type { IMingmingState } from '../types';

/**
 * Ticket 09 "done when": same seed + same inputs => deep-equal IBattleState.
 *
 * The save must be a fixed literal, not createStarterSave(): that factory rolls
 * crypto.randomUUID() ids and Math.random() IVs, so it is an *input* that
 * differs between calls. Determinism of creation cannot paper over that.
 */
const FIXED_MEMBER: IMingmingState = {
    id: 'mm_fixed_1',
    definitionId: 'fenrir',
    nickname: 'Iggy',
    level: 5,
    experience: 100,
    blueprintsCollected: 0,
    attackIV: 12,
    defenseIV: 13,
    hpIV: 14
};

const FIXED_SAVE: IPlayerSave = {
    version: 2,
    roster: [FIXED_MEMBER],
    activeParty: [FIXED_MEMBER.id],
    cardInventory: [],
    activeDeck: null,
    scrapCount: 0,
    blueprints: [],
    relics: [],
    gauntlet: null,
    unlockedSectors: ['Fire'],
    baseDecksGranted: []
};

const gymSave = (currentBattleIndex: number): IPlayerSave => ({
    ...FIXED_SAVE,
    gauntlet: {
        type: 'Gym',
        element: 'Fire',
        currentBattleIndex,
        totalBattles: 3,
        persistedStats: {}
    }
});

const SEED: BattleOptions = { seed: 'ticket-09-seed' };

describe('createBattleState is deterministic under a threaded seed', () => {
    // Every creation branch: fixed enemyIds, procedural sector, and all three
    // gym tiers (each of which used its own Date.now() seed source).
    const branches: Array<[string, () => ReturnType<typeof createBattleState>]> = [
        ['fixed enemyIds fallback', () => createBattleState(FIXED_SAVE, ['ratatoskr'], undefined, SEED)],
        ['procedural sector encounter', () => createBattleState(FIXED_SAVE, [], 'Fire', SEED)],
        ['gym tier 1 (grunt, random count)', () => createBattleState(gymSave(0), [], undefined, SEED)],
        ['gym tier 2 (elite)', () => createBattleState(gymSave(1), [], undefined, SEED)],
        ['gym tier 3 (warden boss)', () => createBattleState(gymSave(2), [], undefined, SEED)],
        ['enemyMode CARDS', () => createBattleState(FIXED_SAVE, [], 'Fire', { ...SEED, enemyMode: 'CARDS' })]
    ];

    for (const [name, build] of branches) {
        it(`${name}: two calls with the same seed are deep-equal`, () => {
            expect(build()).toEqual(build());
        });
    }

    it('a different seed produces a different battle', () => {
        const a = createBattleState(FIXED_SAVE, [], 'Fire', { seed: 'seed-a' });
        const b = createBattleState(FIXED_SAVE, [], 'Fire', { seed: 'seed-b' });
        expect(a).not.toEqual(b);
    });

    it('no seed still works, and rolls a fresh one per call', () => {
        const a = createBattleState(FIXED_SAVE, [], 'Fire');
        const b = createBattleState(FIXED_SAVE, [], 'Fire');
        expect(a.enemyParty.length).toBeGreaterThan(0);
        expect(a).not.toEqual(b);
    });

    it('sessionId is seed-derived, not wall-clock (it lives inside IBattleState)', () => {
        const a = createBattleState(FIXED_SAVE, [], 'Fire', SEED);
        const b = createBattleState(FIXED_SAVE, [], 'Fire', SEED);
        expect(a.sessionId).toBe(b.sessionId);
        expect(a.sessionId).toContain('ticket-09-seed');
        expect(Number(a.sessionId.replace('battle_', ''))).toBeNaN();
    });

    it('card instance ids are stable across a replay and unique within a battle', () => {
        const a = createBattleState(FIXED_SAVE, [], 'Fire', { ...SEED, enemyMode: 'CARDS' });
        const b = createBattleState(FIXED_SAVE, [], 'Fire', { ...SEED, enemyMode: 'CARDS' });

        const idsOf = (s: typeof a) => [
            ...s.playerDeck.drawpile, ...s.playerDeck.hand,
            ...s.enemyDeck.drawpile, ...s.enemyDeck.hand
        ].map(c => c.id);

        const ids = idsOf(a);
        expect(ids.length).toBeGreaterThan(0);
        expect(idsOf(b)).toEqual(ids);
        expect(new Set(ids).size).toBe(ids.length);
    });
});

describe('generateEncounter is deterministic', () => {
    const party = [createMockEntity('P1', 'fenrir', 10, 0, new SeedStream('party'))];

    it('same seed => same encounter', () => {
        const a = generateEncounter({ sectorElement: 'Fire', playerParty: party, seed: 'enc' });
        const b = generateEncounter({ sectorElement: 'Fire', playerParty: party, seed: 'enc' });
        expect(a).toEqual(b);
    });
});

describe('SeedStream', () => {
    it('replays identically from the same seed', () => {
        const draw = () => {
            const s = new SeedStream('abc');
            return [s.nextInt(0, 100), s.next(), s.nextId('x'), s.shuffle([1, 2, 3, 4, 5]), s.fork('label'), s.seed];
        };
        expect(draw()).toEqual(draw());
    });

    it('diverges on a different seed', () => {
        expect(new SeedStream('abc').nextId('x')).not.toBe(new SeedStream('def').nextId('x'));
    });

    it('mints collision-free ids in bulk (the counter, not the 31-bit token, guarantees it)', () => {
        const s = new SeedStream('bulk');
        const ids = Array.from({ length: 2000 }, () => s.nextId('c'));
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('adopt() re-anchors the thread on a seed produced elsewhere', () => {
        const s = new SeedStream('start');
        s.adopt('elsewhere');
        expect(s.seed).toBe('elsewhere');
        expect(s.nextInt(0, 9)).toBe(new SeedStream('elsewhere').nextInt(0, 9));
    });

    it('instantiateDeck sharing one stream never repeats an id across decks', () => {
        const s = new SeedStream('decks');
        const a = instantiateDeck(['fire_poke', 'fire_poke'], s);
        const b = instantiateDeck(['fire_poke', 'fire_poke'], s);
        const ids = [...a, ...b].map(c => c.id);
        expect(new Set(ids).size).toBe(4);
    });

    it('rollSeed returns a fresh seed each call', () => {
        expect(rollSeed()).not.toBe(rollSeed());
    });
});
