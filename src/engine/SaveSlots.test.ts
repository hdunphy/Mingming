/**
 * Save slot storage.
 *
 * The obligations here are the ones from the ticket that can be proved without Redux:
 *   1. the save API writes to the active slot and to nothing else;
 *   2. switching the active slot does not cross-write either slot's payload;
 *   3. deleting a slot leaves neither an orphaned index entry nor an orphaned payload key —
 *      and, since ticket 23, that means BOTH of a slot's keys;
 *   4. nothing adopts a pre-slot save any more (v4 is the floor).
 *
 * The Redux half — clearing a live battle before the pointer moves, and moving `state.game`
 * with it — is covered in `src/debug/saveSlots.test.ts`.
 *
 * Driven through the storage adapter (`save/storage.ts`) rather than a global `localStorage` stub,
 * so ticket 42's file backend inherits this suite unchanged.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    FIRST_SLOT_ID,
    SLOT_INDEX_KEY,
    createSlot,
    deleteSlot,
    getActiveRanchKey,
    getActiveRunKey,
    getActiveSlotId,
    hasSlotData,
    listSlots,
    readSlotRaw,
    renameSlot,
    setActiveSlotId,
    slotRanchKey,
    slotRunKey,
} from './SaveSlots';
import { deleteSave, hasSave, loadGameState, saveRanch, saveRun } from './SaveSystem';
import { resetSaveStorage, setSaveStorage, type ISaveStorage } from './save/storage';
import type { IRanchState, IRunState } from './runTypes';

class MemoryStorage implements ISaveStorage {
    readonly map = new Map<string, string>();
    read(key: string): string | null {
        return this.map.get(key) ?? null;
    }
    write(key: string, value: string): void {
        this.map.set(key, value);
    }
    remove(key: string): void {
        this.map.delete(key);
    }
    keys(): string[] {
        return [...this.map.keys()];
    }
}

let storage: MemoryStorage;

beforeEach(() => {
    storage = new MemoryStorage();
    setSaveStorage(storage);
});

afterEach(() => {
    resetSaveStorage();
});

/** `tier` is the marker each assertion below tracks from slot to slot. */
function makeRanch(tier: number): IRanchState {
    return {
        roster: [{ id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1', attackIV: 10, defenseIV: 8, hpIV: 12 }],
        blueprints: {},
        codex: { seen: [], played: [] , species: [], assembled: [], os: [] },
        gymsCleared: [],
        highestTierCleared: tier,
        seenTips: [],
        codexMilestones: [],
    };
}

function makeRun(): IRunState {
    return {
        seed: 'seed-1',
        gymId: 'gym_water',
        biomes: [
            { id: 'b0', name: 'A', elements: ['Fire'] },
            { id: 'b1', name: 'B', elements: ['Water'] },
            { id: 'b2', name: 'C', elements: ['Nature'] },
        ],
        nodes: [{ id: 'n0', kind: 'wild', biomeIndex: 0, layer: 0, pocket: false, edges: [], visited: 1 }],
        currentNodeId: 'n0',
        partyIds: ['mm1'],
        deck: [],
        scrap: 10,
        macros: [null, null, null],
        drivers: [],
        tier: 0,
        modifiers: [],
        phase: 'map',
        gauntlet: null,
        outcome: null,
        fightsResolved: 0,
        startedAt: 1,
    };
}

/** Every storage key currently set, sorted — used to prove nothing is orphaned. */
function keys(): string[] {
    return storage.keys().sort();
}

const tier = (): number | undefined => loadGameState().ranch?.highestTierCleared;

describe('v4 is the floor — nothing is adopted from before slots existed', () => {
    it('starts a new player rather than rescuing a pre-slot `mingming_save`', () => {
        // The adoption-by-copy is gone with the migration chain (ticket 23). These bytes are not
        // parseable by anything now, so copying them into a slot would only plant a payload that
        // reads as "no save" anyway.
        storage.write('mingming_save', JSON.stringify({ version: 3, scrapCount: 250 }));

        expect(loadGameState().ranch).toBeNull();
        expect(hasSlotData(FIRST_SLOT_ID)).toBe(false);
        expect(keys()).not.toContain(slotRanchKey(FIRST_SLOT_ID));
    });

    it('leaves the legacy key alone rather than deleting it — it is not ours to remove', () => {
        storage.write('mingming_save', 'legacy bytes');
        loadGameState();
        expect(storage.read('mingming_save')).toBe('legacy bytes');
    });

    it('creates a single empty slot when there is nothing at all', () => {
        expect(loadGameState().ranch).toBeNull();
        expect(listSlots().map((slot) => slot.id)).toEqual([FIRST_SLOT_ID]);
        expect(hasSlotData(FIRST_SLOT_ID)).toBe(false);
    });

    it('rebuilds a corrupted index without clobbering the payload it points at', () => {
        saveRanch(makeRanch(5));
        storage.write(SLOT_INDEX_KEY, '{not json');

        expect(tier()).toBe(5);
    });
});

describe('the save API addresses the active slot', () => {
    it('derives both keys from the active slot', () => {
        expect(getActiveRanchKey()).toBe(slotRanchKey(FIRST_SLOT_ID));
        expect(getActiveRunKey()).toBe(slotRunKey(FIRST_SLOT_ID));

        const second = createSlot('scratch')!;
        setActiveSlotId(second.id);

        expect(getActiveRanchKey()).toBe(slotRanchKey(second.id));
        expect(getActiveRunKey()).toBe(slotRunKey(second.id));
    });

    it('writes to the active slot and to no other key', () => {
        const main = listSlots()[0];
        saveRanch(makeRanch(100));
        const scratch = createSlot('scratch')!;

        setActiveSlotId(scratch.id);
        saveRanch(makeRanch(7));

        expect(JSON.parse(readSlotRaw(main.id)!).ranch.highestTierCleared).toBe(100);
        expect(JSON.parse(readSlotRaw(scratch.id)!).ranch.highestTierCleared).toBe(7);
    });

    it('reads back the slot that is active, not the one that was', () => {
        saveRanch(makeRanch(100));
        const scratch = createSlot('scratch')!;
        setActiveSlotId(scratch.id);
        saveRanch(makeRanch(7));

        expect(tier()).toBe(7);
        setActiveSlotId(listSlots()[0].id);
        expect(tier()).toBe(100);
    });

    it('keeps each slot’s run under its own key', () => {
        saveRanch(makeRanch(1));
        saveRun(makeRun());
        const scratch = createSlot('scratch')!;

        setActiveSlotId(scratch.id);
        expect(loadGameState().run).toBeNull();
        expect(storage.read(slotRunKey(listSlots()[0].id))).not.toBeNull();
    });

    it('deleteSave/hasSave only touch the active slot', () => {
        saveRanch(makeRanch(100));
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
        saveRanch(makeRanch(100));
        const slot = createSlot('empty one')!;

        expect(slot.name).toBe('empty one');
        expect(hasSlotData(slot.id)).toBe(false);
        expect(listSlots()).toHaveLength(2);
    });

    it('duplicates BOTH payloads byte-for-byte when branching', () => {
        // "Branch this run" has to mean the whole game state, or the branch starts with the right
        // ranch and someone else's run.
        saveRanch(makeRanch(100));
        saveRun(makeRun());
        const source = listSlots()[0];
        const branch = createSlot('branch', source.id)!;

        expect(readSlotRaw(branch.id)).toBe(readSlotRaw(source.id));
        expect(storage.read(slotRunKey(branch.id))).toBe(storage.read(slotRunKey(source.id)));
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
        saveRanch(makeRanch(100));
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
    it('removes the index entry and BOTH payload keys together', () => {
        saveRanch(makeRanch(100));
        saveRun(makeRun());
        const scratch = createSlot('scratch', FIRST_SLOT_ID)!;
        expect(keys()).toContain(slotRanchKey(scratch.id));
        expect(keys()).toContain(slotRunKey(scratch.id));

        expect(deleteSlot(scratch.id)).toBe(true);

        expect(listSlots().map((s) => s.id)).not.toContain(scratch.id);
        expect(keys()).toEqual(
            [SLOT_INDEX_KEY, slotRanchKey(FIRST_SLOT_ID), slotRunKey(FIRST_SLOT_ID)].sort(),
        );
    });

    it('moves the active pointer off a deleted active slot', () => {
        saveRanch(makeRanch(100));
        const scratch = createSlot('scratch')!;
        setActiveSlotId(scratch.id);

        expect(deleteSlot(scratch.id)).toBe(true);
        expect(getActiveSlotId()).toBe(FIRST_SLOT_ID);
        expect(tier()).toBe(100);
    });

    it('refuses to delete the last remaining slot', () => {
        saveRanch(makeRanch(100));
        expect(deleteSlot(FIRST_SLOT_ID)).toBe(false);
        expect(listSlots()).toHaveLength(1);
        expect(tier()).toBe(100);
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
