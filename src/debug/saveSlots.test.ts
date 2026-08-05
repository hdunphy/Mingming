/**
 * The Redux half of save slots.
 *
 * These tests use the *real* app store (`src/ui/store/store.ts`) on purpose — unlike
 * `saveEdit.test.ts`, which deliberately avoids it. The behaviour under test here IS the
 * autosave subscription that store installs: that a switch lands the next write in the new
 * slot and never in the old one, and that a live battle cannot survive the switch and end
 * into the wrong save.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IBattleState } from '../engine/types';

// The default vitest environment here is `node`, which has no localStorage. Stub it before
// anything reads a save.
const backing: Record<string, string> = {};
vi.stubGlobal('localStorage', {
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
});

import {
    FIRST_SLOT_ID,
    createSlot,
    getActiveSlotId,
    listSlots,
    readSlotRaw,
    slotStorageKey,
} from '../engine/SaveSlots';
import { saveGame } from '../engine/SaveSystem';
import { createDefaultSave } from '../engine/gameTypes';
import type { IPlayerSave } from '../engine/gameTypes';
import { setBattleState } from '../ui/store/battleSlice';
import { addScrap, resetSave } from '../ui/store/gameSlice';
import { store } from '../ui/store/store';
import { createSlotOp, deleteSlotOp, readSlotSave, switchToSlot } from './saveSlots';

const dispatch = store.dispatch as unknown as (action: { type: string; payload?: unknown }) => void;

/** Only identity is read from the battle here, exactly as in `actionTape.test.ts`. */
const fakeBattle = (sessionId: string) => ({ sessionId }) as unknown as IBattleState;

function saveWithScrap(scrapCount: number): IPlayerSave {
    return { ...createDefaultSave(), scrapCount };
}

function storedScrap(slotId: string): number | null {
    const raw = readSlotRaw(slotId);
    return raw === null ? null : JSON.parse(raw).scrapCount;
}

beforeEach(() => {
    store.dispatch(setBattleState(null));
    store.dispatch(resetSave());
    localStorage.clear();
});

describe('switchToSlot', () => {
    it('clears a live battle before the active pointer moves', () => {
        saveGame(saveWithScrap(100));
        const scratch = createSlot('scratch')!;
        store.dispatch(setBattleState(fakeBattle('debug-battle')));

        const result = switchToSlot(scratch.id, dispatch);

        expect(result.ok).toBe(true);
        expect(store.getState().battle.battle).toBeNull();
        expect(getActiveSlotId()).toBe(scratch.id);
    });

    it('loads the target slot into the store', () => {
        saveGame(saveWithScrap(100));
        const branch = createSlot('branch', FIRST_SLOT_ID)!;
        saveGame(saveWithScrap(1)); // still on the first slot

        switchToSlot(branch.id, dispatch);

        expect(store.getState().game.scrapCount).toBe(100);
    });

    it('resets the store for an empty slot rather than carrying the old save in', () => {
        saveGame(saveWithScrap(100));
        store.dispatch(addScrap(5));
        const scratch = createSlot('scratch')!;

        switchToSlot(scratch.id, dispatch);

        expect(store.getState().game.scrapCount).toBe(0);
    });

    it('does not cross-write: the next autosave lands only in the new slot', () => {
        saveGame(saveWithScrap(100));
        const scratch = createSlot('scratch')!;

        switchToSlot(scratch.id, dispatch);
        store.dispatch(addScrap(50));

        expect(storedScrap(FIRST_SLOT_ID)).toBe(100);
        expect(storedScrap(scratch.id)).toBe(50);
    });

    it('leaves the first slot recoverable after a round trip', () => {
        saveGame(saveWithScrap(100));
        const scratch = createSlot('scratch')!;

        switchToSlot(scratch.id, dispatch);
        store.dispatch(addScrap(50));
        switchToSlot(FIRST_SLOT_ID, dispatch);

        expect(store.getState().game.scrapCount).toBe(100);
        expect(storedScrap(scratch.id)).toBe(50);
    });

    it('refuses a slot whose payload fails the schema, changing nothing', () => {
        saveGame(saveWithScrap(100));
        const broken = createSlot('broken')!;
        localStorage.setItem(slotStorageKey(broken.id), JSON.stringify({ scrapCount: 'lots' }));
        store.dispatch(setBattleState(fakeBattle('still-running')));

        const result = switchToSlot(broken.id, dispatch);

        expect(result.ok).toBe(false);
        expect(result.issues.join('\n')).toContain('PlayerSaveSchema');
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
        saveGame(saveWithScrap(100));
        const empty = createSlot('empty')!;
        const broken = createSlot('broken')!;
        localStorage.setItem(slotStorageKey(broken.id), '{not json');

        expect(readSlotSave(FIRST_SLOT_ID).kind).toBe('valid');
        expect(readSlotSave(empty.id).kind).toBe('empty');
        expect(readSlotSave(broken.id).kind).toBe('invalid');
    });
});

describe('createSlotOp', () => {
    it('branches the active slot and leaves the active slot alone', () => {
        saveGame(saveWithScrap(100));

        const result = createSlotOp('branch', FIRST_SLOT_ID);

        expect(result.ok).toBe(true);
        expect(getActiveSlotId()).toBe(FIRST_SLOT_ID);
        expect(storedScrap(result.slot!.id)).toBe(100);
    });

    it('refuses to branch a slot whose stored save is invalid', () => {
        saveGame(saveWithScrap(100));
        const broken = createSlot('broken')!;
        localStorage.setItem(slotStorageKey(broken.id), JSON.stringify({ nope: true }));

        const result = createSlotOp('branch of broken', broken.id);

        expect(result.ok).toBe(false);
        expect(listSlots()).toHaveLength(2);
    });
});

describe('deleteSlotOp', () => {
    it('switches away first when deleting the active slot', () => {
        saveGame(saveWithScrap(100));
        const scratch = createSlot('scratch')!;
        switchToSlot(scratch.id, dispatch);
        store.dispatch(addScrap(50));
        store.dispatch(setBattleState(fakeBattle('scratch-battle')));

        const result = deleteSlotOp(scratch.id, dispatch);

        expect(result.ok).toBe(true);
        expect(getActiveSlotId()).toBe(FIRST_SLOT_ID);
        expect(store.getState().battle.battle).toBeNull();
        // The scratch run is gone and the real save is what the store now holds.
        expect(store.getState().game.scrapCount).toBe(100);
        expect(readSlotRaw(scratch.id)).toBeNull();
        expect(listSlots().map((slot) => slot.id)).toEqual([FIRST_SLOT_ID]);
    });

    it('leaves no orphaned key and no orphaned index entry', () => {
        saveGame(saveWithScrap(100));
        const scratch = createSlot('scratch', FIRST_SLOT_ID)!;

        expect(deleteSlotOp(scratch.id, dispatch).ok).toBe(true);

        expect(readSlotRaw(scratch.id)).toBeNull();
        expect(listSlots().some((slot) => slot.id === scratch.id)).toBe(false);
        expect(Object.keys(backing)).not.toContain(slotStorageKey(scratch.id));
    });

    it('refuses to delete the last slot', () => {
        saveGame(saveWithScrap(100));
        expect(deleteSlotOp(FIRST_SLOT_ID, dispatch).ok).toBe(false);
        expect(listSlots()).toHaveLength(1);
    });
});
