/**
 * Ticket 04 (steam-release map): autosave must never write a save that fails
 * `PlayerSaveSchema.parse()`, and a quota / write failure must not lose the run.
 *
 * The guarantee under test is an *ordering* one — validate, then serialize, then write — so every
 * case here asserts the same thing from a different angle: after the failure, the bytes in
 * storage are still the last save that was known good.
 *
 * The reporting half (a failed write becoming visible to the player) lives in
 * `src/ui/store/saveHealth.test.ts`; the engine has no business importing from `src/ui`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { saveGame, loadGame, CURRENT_SAVE_VERSION } from './SaveSystem';
import { getActiveSaveKey } from './SaveSlots';
import type { IPlayerSave } from './gameTypes';

const backing: Record<string, string> = {};
let setItemImpl: (key: string, value: string) => void = (key, value) => {
    backing[key] = value;
};

vi.stubGlobal('localStorage', {
    getItem: (key: string) => backing[key] ?? null,
    setItem: (key: string, value: string) => setItemImpl(key, value),
    removeItem: (key: string) => {
        delete backing[key];
    },
    clear: () => {
        Object.keys(backing).forEach((k) => delete backing[k]);
    },
    get length() {
        return Object.keys(backing).length;
    },
    key: (i: number) => Object.keys(backing)[i] ?? null,
});

function goodSave(overrides: Partial<IPlayerSave> = {}): IPlayerSave {
    return {
        version: CURRENT_SAVE_VERSION,
        roster: [],
        activeParty: [],
        cardInventory: [],
        activeDeck: null,
        scrapCount: 100,
        blueprints: [],
        relics: [],
        gauntlet: null,
        unlockedSectors: ['Fire'],
        baseDecksGranted: [],
        ...overrides,
    } as IPlayerSave;
}

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
    Object.keys(backing).forEach((k) => delete backing[k]);
    setItemImpl = (key, value) => {
        backing[key] = value;
    };
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    consoleError.mockRestore();
});

describe('saveGame — a bad write never overwrites a good save', () => {
    it('writes a valid save and reports success', () => {
        const result = saveGame(goodSave({ scrapCount: 7 }));
        expect(result.success).toBe(true);
        expect(result.kind).toBeUndefined();
        expect(loadGame().data?.scrapCount).toBe(7);
    });

    it('refuses a schema-invalid state and leaves the last good save in place', () => {
        saveGame(goodSave({ scrapCount: 500 }));
        const lastGoodBytes = backing[getActiveSaveKey()];

        // `scrapCount: -1` fails `z.number().int().min(0)`.
        const result = saveGame(goodSave({ scrapCount: -1 }));

        expect(result.success).toBe(false);
        expect(result.kind).toBe('validation');
        expect(result.error).toContain('scrapCount');
        expect(backing[getActiveSaveKey()]).toBe(lastGoodBytes);
        expect(loadGame().data?.scrapCount).toBe(500);
    });

    it('refuses an over-size activeParty (the 3-member cap) without writing', () => {
        saveGame(goodSave({ scrapCount: 11 }));
        const lastGoodBytes = backing[getActiveSaveKey()];

        const result = saveGame(goodSave({ activeParty: ['a', 'b', 'c', 'd'] }));

        expect(result.success).toBe(false);
        expect(result.kind).toBe('validation');
        expect(backing[getActiveSaveKey()]).toBe(lastGoodBytes);
    });

    it('classifies a full quota as `quota` and keeps the run loadable', () => {
        saveGame(goodSave({ scrapCount: 900 }));
        const lastGoodBytes = backing[getActiveSaveKey()];

        setItemImpl = () => {
            throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
        };

        const result = saveGame(goodSave({ scrapCount: 950 }));

        expect(result.success).toBe(false);
        expect(result.kind).toBe('quota');
        expect(result.error).toMatch(/storage is full/i);
        // The write threw, so storage still holds the previous value — the run is not lost.
        expect(backing[getActiveSaveKey()]).toBe(lastGoodBytes);
        expect(loadGame().data?.scrapCount).toBe(900);
    });

    it('classifies a Firefox-style quota error too', () => {
        saveGame(goodSave());
        setItemImpl = () => {
            const err = new Error('persistent storage maximum size reached');
            err.name = 'NS_ERROR_DOM_QUOTA_REACHED';
            throw err;
        };
        expect(saveGame(goodSave({ scrapCount: 3 })).kind).toBe('quota');
    });

    it('classifies an unavailable localStorage as `storage`, not `quota`', () => {
        saveGame(goodSave({ scrapCount: 12 }));
        const lastGoodBytes = backing[getActiveSaveKey()];

        setItemImpl = () => {
            throw new Error('SecurityError: access to storage is denied');
        };

        const result = saveGame(goodSave({ scrapCount: 13 }));

        expect(result.success).toBe(false);
        expect(result.kind).toBe('storage');
        expect(backing[getActiveSaveKey()]).toBe(lastGoodBytes);
    });
});
