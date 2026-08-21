/**
 * Save slot storage.
 *
 * The obligations here are the ones from the ticket that can be proved without Redux:
 *   1. a pre-slot `mingming_save` is adopted on first read — copied, never moved;
 *   2. the save API writes to the active slot and to nothing else;
 *   3. switching the active slot does not cross-write either slot's payload;
 *   4. deleting a slot leaves neither an orphaned index entry nor an orphaned payload key.
 *
 * The Redux half — clearing a live battle before the pointer moves, and moving `state.game`
 * with it — is covered in `src/debug/saveSlots.test.ts`.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IPlayerSave } from './gameTypes';

// localStorage must exist before SaveSystem/SaveSlots run: the default vitest environment
// here is `node`, which has none. Same stub shape as SaveSystem.test.ts.
const backing: Record<string, string> = {};
const localStorageMock = {
    getItem: (key: string) => backing[key] ?? null,
    setItem: (key: string, value: string) => {
        backing[key] = value;
    },
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
};
vi.stubGlobal('localStorage', localStorageMock);

import {
    FIRST_SLOT_ID,
    LEGACY_SAVE_KEY,
    SLOT_INDEX_KEY,
    createSlot,
    deleteSlot,
    getActiveSaveKey,
    getActiveSlotId,
    hasSlotData,
    listSlots,
    readSlotRaw,
    renameSlot,
    setActiveSlotId,
    slotStorageKey,
} from './SaveSlots';
import { deleteSave, hasSave, loadGame, saveGame } from './SaveSystem';

function makeSave(scrapCount: number): IPlayerSave {
    return {
        version: 2,
        roster: [
            {
                id: 'mm1',
                definitionId: 'def_fire',
                blueprintsCollected: 0,
                attackIV: 10,
                defenseIV: 8,
                hpIV: 12,
            },
        ],
        activeParty: ['mm1'],
        cardInventory: [],
        activeDeck: null,
        scrapCount,
        blueprints: [],
        relics: [],
        gauntlet: null,
        unlockedSectors: ['Fire'],
        baseDecksGranted: [],
    };
}

/** Every localStorage key currently set, sorted — used to prove nothing is orphaned. */
function keys(): string[] {
    return Object.keys(backing).sort();
}

beforeEach(() => {
    localStorage.clear();
});

describe('legacy adoption', () => {
    it('adopts a pre-slot save into the first slot on the first read', () => {
        localStorage.setItem(LEGACY_SAVE_KEY, JSON.stringify(makeSave(250)));

        const loaded = loadGame();

        expect(loaded.data).not.toBeNull();
        expect(loaded.data!.scrapCount).toBe(250);
        expect(getActiveSlotId()).toBe(FIRST_SLOT_ID);
        expect(listSlots()).toHaveLength(1);
    });

    it('copies rather than moves — the legacy key survives untouched as a recovery net', () => {
        const legacyJson = JSON.stringify(makeSave(250));
        localStorage.setItem(LEGACY_SAVE_KEY, legacyJson);

        loadGame();

        expect(localStorage.getItem(LEGACY_SAVE_KEY)).toBe(legacyJson);
        expect(readSlotRaw(FIRST_SLOT_ID)).toBe(legacyJson);
    });

    it('leaves the legacy copy frozen while the adopted slot moves on', () => {
        const legacyJson = JSON.stringify(makeSave(250));
        localStorage.setItem(LEGACY_SAVE_KEY, legacyJson);
        loadGame();

        saveGame(makeSave(999));

        expect(localStorage.getItem(LEGACY_SAVE_KEY)).toBe(legacyJson);
        expect(loadGame().data!.scrapCount).toBe(999);
    });

    it('adopts exactly once — a second launch reads the slot, not the legacy key', () => {
        localStorage.setItem(LEGACY_SAVE_KEY, JSON.stringify(makeSave(250)));
        loadGame();
        saveGame(makeSave(10));

        // "Second launch": the index already exists, so nothing is re-adopted.
        localStorage.setItem(LEGACY_SAVE_KEY, JSON.stringify(makeSave(777)));

        expect(loadGame().data!.scrapCount).toBe(10);
    });

    it('creates a single empty slot when there is no legacy save at all', () => {
        expect(loadGame().data).toBeNull();
        expect(listSlots().map((slot) => slot.id)).toEqual([FIRST_SLOT_ID]);
        expect(hasSlotData(FIRST_SLOT_ID)).toBe(false);
    });

    it('does not paste the legacy save over a slot that already has a payload', () => {
        // A corrupted index with intact payloads: rebuilding must not clobber real progress.
        saveGame(makeSave(500));
        localStorage.setItem(LEGACY_SAVE_KEY, JSON.stringify(makeSave(1)));
        localStorage.setItem(SLOT_INDEX_KEY, '{not json');

        expect(loadGame().data!.scrapCount).toBe(500);
    });
});

describe('the save API addresses the active slot', () => {
    it('derives the key from the active slot', () => {
        expect(getActiveSaveKey()).toBe(slotStorageKey(FIRST_SLOT_ID));
        const second = createSlot('scratch')!;
        setActiveSlotId(second.id);
        expect(getActiveSaveKey()).toBe(slotStorageKey(second.id));
    });

    it('writes to the active slot and to no other key', () => {
        const main = listSlots()[0];
        saveGame(makeSave(100));
        const scratch = createSlot('scratch')!;

        setActiveSlotId(scratch.id);
        saveGame(makeSave(7));

        expect(JSON.parse(readSlotRaw(main.id)!).scrapCount).toBe(100);
        expect(JSON.parse(readSlotRaw(scratch.id)!).scrapCount).toBe(7);
        expect(localStorage.getItem(LEGACY_SAVE_KEY)).toBeNull();
    });

    it('reads back the slot that is active, not the one that was', () => {
        saveGame(makeSave(100));
        const scratch = createSlot('scratch')!;
        setActiveSlotId(scratch.id);
        saveGame(makeSave(7));

        expect(loadGame().data!.scrapCount).toBe(7);
        setActiveSlotId(listSlots()[0].id);
        expect(loadGame().data!.scrapCount).toBe(100);
    });

    it('deleteSave/hasSave only touch the active slot', () => {
        saveGame(makeSave(100));
        const scratch = createSlot('scratch', listSlots()[0].id)!;
        setActiveSlotId(scratch.id);

        expect(hasSave()).toBe(true);
        deleteSave();

        expect(hasSave()).toBe(false);
        // The slot itself survives an emptying — only `deleteSlot` removes it.
        expect(listSlots().map((s) => s.id)).toContain(scratch.id);
        expect(readSlotRaw(listSlots()[0].id)).not.toBeNull();
    });

    it('refuses to make an unknown slot active', () => {
        expect(setActiveSlotId('slot_nope')).toBe(false);
        expect(getActiveSlotId()).toBe(FIRST_SLOT_ID);
    });
});

describe('createSlot', () => {
    it('creates an empty slot by default', () => {
        saveGame(makeSave(100));
        const slot = createSlot('empty one')!;

        expect(slot.name).toBe('empty one');
        expect(hasSlotData(slot.id)).toBe(false);
        expect(listSlots()).toHaveLength(2);
    });

    it('duplicates the source payload byte-for-byte when branching', () => {
        saveGame(makeSave(100));
        const source = listSlots()[0];
        const branch = createSlot('branch', source.id)!;

        expect(readSlotRaw(branch.id)).toBe(readSlotRaw(source.id));
    });

    it('does not switch to the new slot', () => {
        const branch = createSlot('branch')!;
        expect(getActiveSlotId()).not.toBe(branch.id);
    });

    it('returns null for an unknown source slot and creates nothing', () => {
        expect(createSlot('branch', 'slot_nope')).toBeNull();
        expect(listSlots()).toHaveLength(1);
    });

    it('falls back to a positional name when given only whitespace', () => {
        expect(createSlot('   ')!.name).toBe('Slot 2');
    });
});

describe('renameSlot', () => {
    it('renames without moving the payload', () => {
        saveGame(makeSave(100));
        const before = readSlotRaw(FIRST_SLOT_ID);

        expect(renameSlot(FIRST_SLOT_ID, 'Real Save')).toBe(true);
        expect(listSlots()[0].name).toBe('Real Save');
        expect(readSlotRaw(FIRST_SLOT_ID)).toBe(before);
    });

    it('refuses an unknown slot', () => {
        expect(renameSlot('slot_nope', 'x')).toBe(false);
    });
});

describe('deleteSlot', () => {
    it('removes the index entry and the payload key together', () => {
        saveGame(makeSave(100));
        const scratch = createSlot('scratch', FIRST_SLOT_ID)!;
        expect(keys()).toContain(slotStorageKey(scratch.id));

        expect(deleteSlot(scratch.id)).toBe(true);

        expect(listSlots().map((s) => s.id)).not.toContain(scratch.id);
        expect(keys()).not.toContain(slotStorageKey(scratch.id));
        expect(keys()).toEqual([SLOT_INDEX_KEY, slotStorageKey(FIRST_SLOT_ID)].sort());
    });

    it('moves the active pointer off a deleted active slot', () => {
        saveGame(makeSave(100));
        const scratch = createSlot('scratch')!;
        setActiveSlotId(scratch.id);

        expect(deleteSlot(scratch.id)).toBe(true);
        expect(getActiveSlotId()).toBe(FIRST_SLOT_ID);
        expect(loadGame().data!.scrapCount).toBe(100);
    });

    it('refuses to delete the last remaining slot', () => {
        saveGame(makeSave(100));
        expect(deleteSlot(FIRST_SLOT_ID)).toBe(false);
        expect(listSlots()).toHaveLength(1);
        expect(loadGame().data!.scrapCount).toBe(100);
    });

    it('refuses an unknown slot', () => {
        createSlot('scratch');
        expect(deleteSlot('slot_nope')).toBe(false);
        expect(listSlots()).toHaveLength(2);
    });

    it('reuses the freed id only when its payload key is also gone', () => {
        createSlot('a');
        const b = createSlot('b')!;
        expect(b.id).toBe('slot_3');

        deleteSlot('slot_2');
        expect(createSlot('c')!.id).toBe('slot_2');
    });
});
