import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { IPlayerSave } from './gameTypes';
import { createDefaultSave } from './gameTypes';

// Set up localStorage mock BEFORE importing SaveSystem
const store: Record<string, string> = {};
const localStorageMock = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
};
vi.stubGlobal('localStorage', localStorageMock);

import { saveGame, loadGame, deleteSave, hasSave, PlayerSaveSchema, migrateSave } from './SaveSystem';

// Vitest uses jsdom/happy-dom which provides localStorage mock

function makeValidSave(): IPlayerSave {
    return {
        version: 1,
        roster: [
            { id: 'mm1', definitionId: 'def_fire', level: 5, experience: 100, blueprintsCollected: 0, attackIV: 10, defenseIV: 8, hpIV: 12 }
        ],
        activeParty: ['mm1'],
        cardInventory: [
            { instanceId: 'c1', dataId: 'flamethrower' },
            { instanceId: 'c2', dataId: 'erupt' }
        ],
        activeDeck: { id: 'd1', name: 'Fire Deck', cards: ['c1', 'c2'] },
        scrapCount: 250,
        blueprints: [
            { architectureId: 'arch_fire', name: 'Fire Blueprint', compileCost: 100 }
        ],
        relics: [],
        gauntlet: null,
        unlockedSectors: ['Fire', 'Water', 'Nature'],
        baseDecksGranted: []
    };
}

describe('SaveSystem', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    describe('saveGame + loadGame round-trip', () => {
        it('saves and loads a valid save', () => {
            const save = makeValidSave();
            const saveResult = saveGame(save);
            expect(saveResult.success).toBe(true);

            const loadResult = loadGame();
            expect(loadResult.data).not.toBeNull();
            expect(loadResult.data!.scrapCount).toBe(250);
            expect(loadResult.data!.roster).toHaveLength(1);
            expect(loadResult.data!.roster[0].id).toBe('mm1');
            expect(loadResult.data!.cardInventory).toHaveLength(2);
            expect(loadResult.data!.blueprints).toHaveLength(1);
        });

        it('saves and loads default save', () => {
            const save = createDefaultSave();
            const saveResult = saveGame(save);
            expect(saveResult.success).toBe(true);

            const loadResult = loadGame();
            expect(loadResult.data).not.toBeNull();
            expect(loadResult.data!.scrapCount).toBe(0);
            expect(loadResult.data!.roster).toHaveLength(0);
        });
    });

    describe('Zod validation rejects bad data', () => {
        it('rejects string where number expected (scrapCount)', () => {
            const bad = { ...makeValidSave(), scrapCount: 'five' as any };
            const result = saveGame(bad);
            expect(result.success).toBe(false);
            expect(result.error).toContain('scrapCount');
        });

        it('rejects missing version field', () => {
            const bad = { ...makeValidSave() } as any;
            delete bad.version;
            const result = saveGame(bad);
            expect(result.success).toBe(false);
            expect(result.error).toContain('version');
        });

        it('rejects negative scrap count', () => {
            const bad = { ...makeValidSave(), scrapCount: -10 };
            const result = saveGame(bad);
            expect(result.success).toBe(false);
        });

        it('rejects IV > 31', () => {
            const bad = makeValidSave();
            (bad.roster as any)[0] = { ...bad.roster[0], attackIV: 50 };
            const result = saveGame(bad);
            expect(result.success).toBe(false);
            expect(result.error).toContain('attackIV');
        });

        it('rejects activeParty with more than 3 entries', () => {
            const bad = { ...makeValidSave(), activeParty: ['a', 'b', 'c', 'd'] };
            const result = saveGame(bad);
            expect(result.success).toBe(false);
        });

        it('rejects level < 1', () => {
            const bad = makeValidSave();
            (bad.roster as any)[0] = { ...bad.roster[0], level: 0 };
            const result = saveGame(bad);
            expect(result.success).toBe(false);
        });

        it('rejects corrupted JSON on load', () => {
            localStorage.setItem('mingming_save', '{not valid json!!!');
            const result = loadGame();
            expect(result.data).toBeNull();
            expect(result.error).toContain('invalid JSON');
        });

        it('rejects well-formed but schema-invalid JSON on load', () => {
            localStorage.setItem('mingming_save', JSON.stringify({ foo: 'bar' }));
            const result = loadGame();
            expect(result.data).toBeNull();
            expect(result.error).toBeDefined();
        });
    });

    describe('deleteSave / hasSave', () => {
        it('hasSave returns false when no save', () => {
            expect(hasSave()).toBe(false);
        });

        it('hasSave returns true after saving', () => {
            saveGame(makeValidSave());
            expect(hasSave()).toBe(true);
        });

        it('deleteSave removes the save', () => {
            saveGame(makeValidSave());
            expect(hasSave()).toBe(true);
            deleteSave();
            expect(hasSave()).toBe(false);
        });
    });

    describe('PlayerSaveSchema direct validation', () => {
        it('parses valid data', () => {
            const result = PlayerSaveSchema.safeParse(makeValidSave());
            expect(result.success).toBe(true);
        });

        it('provides detailed error path for nested failures', () => {
            const bad = makeValidSave();
            (bad.roster as any)[0] = { ...bad.roster[0], level: 'five' };
            const result = PlayerSaveSchema.safeParse(bad);
            expect(result.success).toBe(false);
            if (!result.success) {
                const paths = result.error.issues.map((e: any) => e.path.join('.'));
                expect(paths.some(p => p.includes('level'))).toBe(true);
            }
        });
    });
});

describe('Gauntlet persistence (HP-only by design)', () => {
    // Writing `mingming_save` directly now exercises the legacy-adoption path in SaveSlots:
    // it is copied into the first slot only when no slot index exists yet. These blocks used
    // to inherit whatever localStorage the block above left behind, so they clear it first.
    beforeEach(() => {
        localStorage.clear();
    });

    it('accepts persistedStats with hp only — matches what the game writes', () => {
        const save: IPlayerSave = {
            ...makeValidSave(),
            gauntlet: {
                type: 'Gym',
                element: 'Fire',
                currentBattleIndex: 1,
                totalBattles: 3,
                persistedStats: { mm1: { hp: 42 } }
            }
        };
        expect(saveGame(save).success).toBe(true);

        const loaded = loadGame();
        expect(loaded.data).not.toBeNull();
        expect(loaded.data!.gauntlet).not.toBeNull();
        expect(loaded.data!.gauntlet!.persistedStats['mm1'].hp).toBe(42);
    });

    it('still loads old saves whose persistedStats carried energy (ignored)', () => {
        const raw = {
            ...makeValidSave(),
            gauntlet: {
                type: 'Gym',
                element: 'Fire',
                currentBattleIndex: 1,
                totalBattles: 3,
                persistedStats: { mm1: { hp: 42, energy: 3 } }
            }
        };
        localStorage.setItem('mingming_save', JSON.stringify(raw));
        const loaded = loadGame();
        expect(loaded.data).not.toBeNull();
        expect(loaded.data!.gauntlet!.persistedStats['mm1'].hp).toBe(42);
    });
});

describe('Save migration', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('loads a legacy v1 save missing blueprints/relics/gauntlet/unlockedSectors', () => {
        const legacy: any = makeValidSave();
        delete legacy.blueprints;
        delete legacy.relics;
        delete legacy.gauntlet;
        delete legacy.unlockedSectors;
        localStorage.setItem('mingming_save', JSON.stringify(legacy));

        const loaded = loadGame();
        expect(loaded.data).not.toBeNull();
        expect(loaded.data!.blueprints).toEqual([]);
        expect(loaded.data!.relics).toEqual([]);
        expect(loaded.data!.gauntlet).toBeNull();
        expect(loaded.data!.unlockedSectors).toEqual([]);
        expect(loaded.data!.version).toBe(2);
        expect(loaded.data!.scrapCount).toBe(250);
    });

    it('migrateSave upgrades version and leaves modern saves intact', () => {
        const modern = { ...makeValidSave(), version: 2 };
        expect(migrateSave(modern)).toEqual(modern);
    });

    it('loads a save missing baseDecksGranted (defaults to [] via catch)', () => {
        const legacy: any = { ...makeValidSave(), version: 2 };
        delete legacy.baseDecksGranted;
        localStorage.setItem('mingming_save', JSON.stringify(legacy));

        const loaded = loadGame();
        expect(loaded.data).not.toBeNull();
        expect(loaded.data!.baseDecksGranted).toEqual([]);
        expect(loaded.data!.scrapCount).toBe(250);
    });
});
