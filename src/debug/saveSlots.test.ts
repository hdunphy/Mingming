/**
 * The Redux half of save slots.
 *
 * These tests use the *real* app store (`src/ui/store/store.ts`) on purpose — unlike
 * `saveEdit.test.ts`, which deliberately avoids it. The behaviour under test here IS the
 * autosave subscription that store installs: that a switch lands the next write in the new
 * slot and never in the old one, and that a live battle cannot survive the switch and end
 * into the wrong save.
 *
 * TICKET 23: the marker every assertion tracks used to be `scrapCount`. Scrap is run-scoped in
 * save v4 and is deliberately never written, so an unlocked SECTOR is the marker now — it
 * round-trips through the ranch as a gym clear, which is what these tests actually need: a
 * per-slot value that survives a write and a read.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { IBattleState } from '../engine/types';

import {
    FIRST_SLOT_ID,
    createSlot,
    getActiveSlotId,
    listSlots,
    readSlotRaw,
    slotRanchKey,
} from '../engine/SaveSlots';
import { saveRanch } from '../engine/SaveSystem';
import { resetSaveStorage, setSaveStorage, type ISaveStorage } from '../engine/save/storage';
import { createEmptyRanch, markGymCleared, resetSave } from '../ui/store/gameSlice';
import { setBattleState } from '../ui/store/battleSlice';
import { store } from '../ui/store/store';
import { createSlotOp, deleteSlotOp, readSlotSave, switchToSlot } from './saveSlots';

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

const dispatch = store.dispatch as unknown as (action: { type: string; payload?: unknown }) => void;

/** Only identity is read from the battle here, exactly as in `actionTape.test.ts`. */
const fakeBattle = (sessionId: string) => ({ sessionId }) as unknown as IBattleState;

/**
 * Seed the ACTIVE slot with a ranch carrying `marker` as a cleared gym.
 *
 * Ticket 11: the marker used to be an `unlockedSectors` entry projected into `gymsCleared`. It is
 * written directly now — the slice IS the ranch — which is why the three-default filter below is
 * gone: `gymsCleared` has no defaults to subtract.
 */
function seed(marker: string): void {
    saveRanch({ ...createEmptyRanch(), gymsCleared: [marker] });
}

/** The marker stored in a slot, or null when the slot is empty. */
function storedMarker(slotId: string): string | null {
    const raw = readSlotRaw(slotId);
    return raw === null ? null : (JSON.parse(raw).ranch.gymsCleared[0] ?? null);
}

/** The marker the store currently holds. */
function liveMarker(): string | null {
    return store.getState().game.gymsCleared[0] ?? null;
}

beforeEach(() => {
    storage = new MemoryStorage();
    setSaveStorage(storage);
    store.dispatch(setBattleState(null));
    store.dispatch(resetSave());
    // `resetSave` is itself a game-state change, so the autosave subscription has already written
    // a default ranch into the new backend by the time a test body runs. Clear it so each test
    // starts from genuinely empty storage.
    storage.map.clear();
});

afterEach(() => {
    resetSaveStorage();
});

describe('switchToSlot', () => {
    it('clears a live battle before the active pointer moves', () => {
        seed('Alpha');
        const scratch = createSlot('scratch')!;
        store.dispatch(setBattleState(fakeBattle('debug-battle')));

        const result = switchToSlot(scratch.id, dispatch);

        expect(result.ok).toBe(true);
        expect(store.getState().battle.battle).toBeNull();
        expect(getActiveSlotId()).toBe(scratch.id);
    });

    it('loads the target slot into the store', () => {
        seed('Alpha');
        const branch = createSlot('branch', FIRST_SLOT_ID)!;
        seed('Beta'); // still on the first slot

        switchToSlot(branch.id, dispatch);

        expect(liveMarker()).toBe('Alpha');
    });

    it('resets the store for an empty slot rather than carrying the old save in', () => {
        seed('Alpha');
        store.dispatch(markGymCleared('Gamma'));
        const scratch = createSlot('scratch')!;

        switchToSlot(scratch.id, dispatch);

        expect(liveMarker()).toBeNull();
    });

    it('does not cross-write: the next autosave lands only in the new slot', () => {
        seed('Alpha');
        const scratch = createSlot('scratch')!;

        switchToSlot(scratch.id, dispatch);
        store.dispatch(markGymCleared('Delta'));

        expect(storedMarker(FIRST_SLOT_ID)).toBe('Alpha');
        expect(storedMarker(scratch.id)).toBe('Delta');
    });

    it('leaves the first slot recoverable after a round trip', () => {
        seed('Alpha');
        const scratch = createSlot('scratch')!;

        switchToSlot(scratch.id, dispatch);
        store.dispatch(markGymCleared('Delta'));
        switchToSlot(FIRST_SLOT_ID, dispatch);

        expect(liveMarker()).toBe('Alpha');
        expect(storedMarker(scratch.id)).toBe('Delta');
    });

    it('refuses a slot whose payload fails the schema, changing nothing', () => {
        seed('Alpha');
        const broken = createSlot('broken')!;
        storage.write(slotRanchKey(broken.id), JSON.stringify({ version: 4, ranch: { roster: 'lots' } }));
        store.dispatch(setBattleState(fakeBattle('still-running')));

        const result = switchToSlot(broken.id, dispatch);

        expect(result.ok).toBe(false);
        expect(result.issues.join('\n')).toContain('RanchSaveSchema');
        expect(getActiveSlotId()).toBe(FIRST_SLOT_ID);
        // The refusal happens before anything is dispatched, so the battle is untouched.
        expect(store.getState().battle.battle).not.toBeNull();
    });

    it('refuses an unknown slot and the slot that is already active', () => {
        expect(switchToSlot('slot_nope', dispatch).ok).toBe(false);
        expect(switchToSlot(getActiveSlotId(), dispatch).ok).toBe(false);
    });
});

describe('readSlotSave', () => {
    it('reports empty, valid and invalid distinctly', () => {
        seed('Alpha');
        const empty = createSlot('empty')!;
        const broken = createSlot('broken')!;
        storage.write(slotRanchKey(broken.id), '{not json');

        expect(readSlotSave(FIRST_SLOT_ID).kind).toBe('valid');
        expect(readSlotSave(empty.id).kind).toBe('empty');
        expect(readSlotSave(broken.id).kind).toBe('invalid');
    });
});

describe('createSlotOp', () => {
    it('branches the active slot and leaves the active slot alone', () => {
        seed('Alpha');

        const result = createSlotOp('branch', FIRST_SLOT_ID);

        expect(result.ok).toBe(true);
        expect(getActiveSlotId()).toBe(FIRST_SLOT_ID);
        expect(storedMarker(result.slot!.id)).toBe('Alpha');
    });

    it('refuses to branch a slot whose stored save is invalid', () => {
        seed('Alpha');
        const broken = createSlot('broken')!;
        storage.write(slotRanchKey(broken.id), JSON.stringify({ nope: true }));

        const result = createSlotOp('branch of broken', broken.id);

        expect(result.ok).toBe(false);
        expect(listSlots()).toHaveLength(2);
    });
});

describe('deleteSlotOp', () => {
    it('switches away first when deleting the active slot', () => {
        seed('Alpha');
        const scratch = createSlot('scratch')!;
        switchToSlot(scratch.id, dispatch);
        store.dispatch(markGymCleared('Delta'));
        store.dispatch(setBattleState(fakeBattle('scratch-battle')));

        const result = deleteSlotOp(scratch.id, dispatch);

        expect(result.ok).toBe(true);
        expect(getActiveSlotId()).toBe(FIRST_SLOT_ID);
        expect(store.getState().battle.battle).toBeNull();
        // The scratch run is gone and the real save is what the store now holds.
        expect(liveMarker()).toBe('Alpha');
        expect(readSlotRaw(scratch.id)).toBeNull();
        expect(listSlots().map((slot) => slot.id)).toEqual([FIRST_SLOT_ID]);
    });

    it('leaves no orphaned key and no orphaned index entry', () => {
        seed('Alpha');
        const scratch = createSlot('scratch', FIRST_SLOT_ID)!;

        expect(deleteSlotOp(scratch.id, dispatch).ok).toBe(true);

        expect(readSlotRaw(scratch.id)).toBeNull();
        expect(listSlots().some((slot) => slot.id === scratch.id)).toBe(false);
        expect(storage.keys()).not.toContain(slotRanchKey(scratch.id));
    });

    it('refuses to delete the last slot', () => {
        seed('Alpha');
        expect(deleteSlotOp(FIRST_SLOT_ID, dispatch).ok).toBe(false);
        expect(listSlots()).toHaveLength(1);
    });
});
