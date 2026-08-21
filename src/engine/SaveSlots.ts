/**
 * Save slots — a ranch and an optional run per named slot, with an index of what exists.
 *
 * Storage goes through `save/storage.ts`; nothing here names a backend.
 *
 * WHY THIS MODULE EXISTS
 *
 * Ending a battle is a write to the real save. `BattleArena` dispatches `syncPartyStats`,
 * `applyRewardBundle`, `addRelic` and the gauntlet actions into `gameSlice`, and
 * `src/ui/store/store.ts`'s subscription autosaves every `state.game` change straight to storage.
 * `syncPartyStats` matches roster members *by id*, and a fabricated debug battle can reuse
 * real roster ids — so a debug run that is allowed to end lands its levels, HP and rewards on
 * the player's actual mingmings. There is no undo.
 *
 * Slots are the containment: debug work happens in a slot the operator picked, and the real
 * save sits in a different key that nothing in that session writes.
 *
 * WHY `saveGame`/`loadGame`/`deleteSave`/`hasSave` DID NOT CHANGE SHAPE
 *
 * Those four are called from six places, one of which is the autosave subscription inside
 * `src/ui/store/store.ts` — a production file the debug toolkit is not allowed to edit
 * (the standing gate invariant: nothing outside `src/debug/` may import anything inside it,
 * and the toolkit earns that by never needing a production edit). So the slot lives *under*
 * the existing API: the four functions keep their exact signatures and silently address the
 * active slot. Every call site is untouched, and switching slots is a single write here.
 *
 * STORAGE LAYOUT (ticket 23: TWO keys per slot, not one)
 *
 *   mingming_saves             the index: { version, activeSlotId, slots: [{ id, name, createdAt }] }
 *   mingming_ranch__<slotId>   the ranch — roster, blueprint counts, codex, gyms/tier cleared
 *   mingming_run__<slotId>     the run in progress, absent when there is none
 *
 * The split is Henry's ruling (ticket 06) and its whole purpose is blast radius: a corrupt run
 * costs a run, never a blueprint or an individual. `SaveSystem` reads both and reconciles them.
 *
 * THE LEGACY ADOPTION IS GONE (ticket 23). It existed to copy a pre-slot `mingming_save` into the
 * first slot. Save v4 is a clean break with no migration — a pre-v4 blob reads as a new player —
 * so there is nothing left to rescue and keeping the copy would only resurrect a shape nothing can
 * parse.
 *
 * This module is engine code: no React, no Redux, and no import from `src/debug/`. It reads no
 * Vite build-env flags either, so it runs under plain node. Storage goes through
 * `save/storage.ts` so ticket 42 can swap in a file backend.
 */

import { z } from 'zod';

import { getSaveStorage, type ISaveStorage } from './save/storage';

/** Where the index lives. */
export const SLOT_INDEX_KEY = 'mingming_saves';

/** Per-slot ranch payload keys are this prefix plus the slot id. */
export const RANCH_KEY_PREFIX = 'mingming_ranch__';

/** Per-slot run payload keys are this prefix plus the slot id. */
export const RUN_KEY_PREFIX = 'mingming_run__';

export const CURRENT_SLOT_INDEX_VERSION = 1;

/**
 * The first slot's id, and the id assumed when storage is unavailable so key derivation stays a
 * total function. (It used to also be the slot the legacy save was adopted into; ticket 23 removed
 * that adoption along with the migration it fed.)
 */
export const FIRST_SLOT_ID = 'slot_1';

export interface SaveSlot {
    readonly id: string;
    readonly name: string;
    /** Epoch ms. Display only — ordering in the index is creation order already. */
    readonly createdAt: number;
}

export interface SlotIndex {
    readonly version: number;
    readonly activeSlotId: string;
    readonly slots: ReadonlyArray<SaveSlot>;
}

const SaveSlotSchema = z.object({
    id: z.string().min(1),
    name: z.string(),
    createdAt: z.number(),
});

/**
 * Validated on both read and write. An index that fails here is treated as absent and rebuilt
 * rather than half-trusted — a half-trusted index points `saveGame` at a key nobody can find
 * again, which is exactly the silent-data-loss shape this whole ticket exists to prevent.
 */
const SlotIndexSchema = z
    .object({
        version: z.number().int().min(1),
        activeSlotId: z.string().min(1),
        slots: z.array(SaveSlotSchema).min(1),
    })
    .refine(
        (index) => index.slots.some((slot) => slot.id === index.activeSlotId),
        { message: 'activeSlotId is not one of slots[]' },
    )
    .refine(
        (index) => new Set(index.slots.map((slot) => slot.id)).size === index.slots.length,
        { message: 'duplicate slot id' },
    );

// --- Storage access (ticket 23: through the adapter, so nothing here names localStorage) ---

type Store = ISaveStorage;

function storage(): Store | null {
    return getSaveStorage();
}

function safeGet(store: Store, key: string): string | null {
    return store.read(key);
}

function safeSet(store: Store, key: string, value: string): boolean {
    try {
        store.write(key, value);
        return true;
    } catch {
        return false;
    }
}

function safeRemove(store: Store, key: string): void {
    store.remove(key);
}

// --- Key derivation ---

/** `mingming_ranch__<slotId>`. Total: callers never have to handle a missing slot here. */
export function slotRanchKey(slotId: string): string {
    return `${RANCH_KEY_PREFIX}${slotId}`;
}

/** `mingming_run__<slotId>`. Absent while the slot has no run in progress. */
export function slotRunKey(slotId: string): string {
    return `${RUN_KEY_PREFIX}${slotId}`;
}

// --- Index read / write ---

function readIndex(store: Store): SlotIndex | null {
    const raw = safeGet(store, SLOT_INDEX_KEY);
    if (!raw) return null;
    try {
        const parsed = SlotIndexSchema.safeParse(JSON.parse(raw));
        return parsed.success ? (parsed.data as SlotIndex) : null;
    } catch {
        return null;
    }
}

function writeIndex(store: Store, index: SlotIndex): boolean {
    const parsed = SlotIndexSchema.safeParse(index);
    if (!parsed.success) return false;
    return safeSet(store, SLOT_INDEX_KEY, JSON.stringify(parsed.data));
}

/**
 * Create the index when there is none (a new player, or a corrupted index being rebuilt).
 *
 * Ticket 23 removed the legacy-adoption copy that used to live here. It existed to rescue a
 * pre-slot `mingming_save`, and save v4's clean break means such a blob can no longer be parsed by
 * anything — copying it forward would only plant bytes that read as a new player anyway.
 */
function createIndex(store: Store): SlotIndex {
    const index: SlotIndex = {
        version: CURRENT_SLOT_INDEX_VERSION,
        activeSlotId: FIRST_SLOT_ID,
        slots: [{ id: FIRST_SLOT_ID, name: 'Main', createdAt: Date.now() }],
    };
    writeIndex(store, index);
    return index;
}

function ensureIndex(store: Store): SlotIndex {
    return readIndex(store) ?? createIndex(store);
}

/** Lowest unused `slot_N`, skipping ids whose payload key somehow still exists. */
function nextSlotId(store: Store, index: SlotIndex): string {
    const taken = new Set(index.slots.map((slot) => slot.id));
    for (let n = 1; ; n++) {
        const candidate = `slot_${n}`;
        if (!taken.has(candidate) && safeGet(store, slotRanchKey(candidate)) === null) {
            return candidate;
        }
    }
}

// --- Public slot API ---

/** Every slot, in creation order. Empty only when storage is unavailable. */
export function listSlots(): ReadonlyArray<SaveSlot> {
    const store = storage();
    if (!store) return [];
    return ensureIndex(store).slots;
}

/**
 * The slot `saveGame`/`loadGame`/`deleteSave`/`hasSave` address.
 *
 * Falls back to `FIRST_SLOT_ID` with no storage so key derivation stays total; the subsequent
 * read or write fails on its own and reports that, exactly as it did before slots existed.
 */
export function getActiveSlotId(): string {
    const store = storage();
    if (!store) return FIRST_SLOT_ID;
    return ensureIndex(store).activeSlotId;
}

/** The concrete storage key the ranch is written to. */
export function getActiveRanchKey(): string {
    return slotRanchKey(getActiveSlotId());
}

/** The run key for the active slot. Absent from storage while no run is in progress. */
export function getActiveRunKey(): string {
    return slotRunKey(getActiveSlotId());
}

/**
 * Point the save API at another existing slot. Returns false for an unknown slot rather than
 * inventing one — a typo must not silently strand the save in an unreachable key.
 *
 * Callers with a live battle must clear it *before* this returns; see
 * `src/debug/saveSlots.ts`, which owns that ordering.
 */
export function setActiveSlotId(slotId: string): boolean {
    const store = storage();
    if (!store) return false;
    const index = ensureIndex(store);
    if (!index.slots.some((slot) => slot.id === slotId)) return false;
    if (index.activeSlotId === slotId) return true;
    return writeIndex(store, { ...index, activeSlotId: slotId });
}

/**
 * Create a slot. With `copyFromSlotId` the source slot's stored bytes are duplicated into the
 * new key — "branch this run": the branch starts byte-identical and diverges from there.
 *
 * Does not switch to the new slot. Switching is a separate, battle-clearing operation.
 * Returns null for an unknown source slot or when the index write fails.
 */
export function createSlot(name: string, copyFromSlotId?: string): SaveSlot | null {
    const store = storage();
    if (!store) return null;
    const index = ensureIndex(store);

    let payload: string | null = null;
    let runPayload: string | null = null;
    if (copyFromSlotId !== undefined) {
        if (!index.slots.some((slot) => slot.id === copyFromSlotId)) return null;
        payload = safeGet(store, slotRanchKey(copyFromSlotId));
        runPayload = safeGet(store, slotRunKey(copyFromSlotId));
    }

    const slot: SaveSlot = {
        id: nextSlotId(store, index),
        name: normalizeName(name, index),
        createdAt: Date.now(),
    };

    // Index first: a payload with no index entry is an orphan nothing will ever clean up,
    // whereas an index entry with no payload is just an empty slot, which is a legal state.
    if (!writeIndex(store, { ...index, slots: [...index.slots, slot] })) return null;
    if (payload !== null) safeSet(store, slotRanchKey(slot.id), payload);
    // A branched slot carries the run too, so "copy this slot" means the whole game state.
    if (runPayload !== null) safeSet(store, slotRunKey(slot.id), runPayload);
    return slot;
}

export function renameSlot(slotId: string, name: string): boolean {
    const store = storage();
    if (!store) return false;
    const index = ensureIndex(store);
    if (!index.slots.some((slot) => slot.id === slotId)) return false;
    const renamed = normalizeName(name, index);
    return writeIndex(store, {
        ...index,
        slots: index.slots.map((slot) => (slot.id === slotId ? { ...slot, name: renamed } : slot)),
    });
}

/**
 * Delete a slot: its payload key AND its index entry, never one without the other.
 *
 * Refuses to delete the last remaining slot — the save API must always have somewhere to
 * write, and an empty index would just be rebuilt by the next read, silently re-adopting the
 * legacy save. Wiping a slot's contents without removing the slot is what `deleteSave` is for.
 *
 * Deleting the *active* slot moves the active pointer to the first survivor here, so no
 * orphan is possible even if the caller forgot. Callers holding live game state should still
 * switch away first (`src/debug/saveSlots.ts`), otherwise the next autosave writes that state
 * into the survivor.
 */
export function deleteSlot(slotId: string): boolean {
    const store = storage();
    if (!store) return false;
    const index = ensureIndex(store);
    if (!index.slots.some((slot) => slot.id === slotId)) return false;
    if (index.slots.length <= 1) return false;

    const remaining = index.slots.filter((slot) => slot.id !== slotId);
    const next: SlotIndex = {
        ...index,
        activeSlotId: index.activeSlotId === slotId ? remaining[0].id : index.activeSlotId,
        slots: remaining,
    };
    if (!writeIndex(store, next)) return false;
    safeRemove(store, slotRanchKey(slotId));
    safeRemove(store, slotRunKey(slotId));
    return true;
}

/** Raw stored text for a slot, or null when the slot is empty/unknown. */
export function readSlotRaw(slotId: string): string | null {
    const store = storage();
    if (!store) return null;
    return safeGet(store, slotRanchKey(slotId));
}

export function hasSlotData(slotId: string): boolean {
    return readSlotRaw(slotId) !== null;
}


// --- Naming ---

const MAX_SLOT_NAME = 40;

/** Trim, bound the length, and fall back to a positional name so no slot is nameless. */
function normalizeName(name: string, index: SlotIndex): string {
    const trimmed = name.trim().slice(0, MAX_SLOT_NAME);
    return trimmed === '' ? `Slot ${index.slots.length + 1}` : trimmed;
}
