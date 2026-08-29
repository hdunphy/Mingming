/**
 * Slot operations that touch Redux — the half of save slots that cannot live in the engine.
 *
 * `src/engine/SaveSlots.ts` owns storage: keys, the index, migration. It is engine code and
 * therefore knows nothing about the store. But two slot operations are only correct if the
 * *live game state* moves with the pointer, and that needs a dispatch. Those two live here.
 *
 * THE LIVE-BATTLE HAZARD (the reason this file is not just three lines in the panel)
 *
 * A battle in flight is a pending write to whatever slot is active *when it ends*, not the
 * one that was active when it started. `BattleArena` dispatches `addBlueprint`,
 * `markGymCleared` and `recordTierCleared` on victory (ticket 11: the scrap, cards and drivers
 * go to the run instead), and the autosave in `src/ui/store/store.ts` follows them into
 * localStorage. Start a debug battle in slot A, switch to the real save, finish the battle: the
 * fabricated rewards land on the real ranch.
 *
 * So `switchToSlot` dispatches `setBattleState(null)` BEFORE `setActiveSlotId`. Ordering is
 * the whole guarantee: while the battle still exists the old slot is still the active one, and
 * the instant the pointer moves there is no battle left that could end. The debug layer can
 * dispatch `setBattleState(null)` freely (God Tools and the snapshot panel already write the
 * battle slice this way), so no new production action is needed.
 *
 * The same reasoning applies to `state.game`: after the pointer moves, the store still holds
 * the *previous* slot's save, and the very next game-state change would autosave it into the
 * new slot. So the load is dispatched immediately and synchronously after the switch, with
 * nothing in between that can touch `gameSlice`.
 *
 * VALIDATION
 *
 * A slot's stored payload is a save v4 **ranch envelope** (ticket 23), so reads validate it with
 * `RanchSaveSchema` and hand the inner ranch straight to `loadSave` — since ticket 11 that is
 * literally the slice's state type, so there is no projection step left. There is no migration
 * step either: v4 is the floor, and a payload that fails is refused *before* the pointer moves, so
 * a corrupt slot cannot become the active slot and wedge the autosave with nothing but a
 * console.error.
 *
 * React-free on purpose: `dispatch` is a parameter, so all of this is testable headlessly.
 */

import {
    createSlot,
    deleteSlot,
    getActiveSlotId,
    listSlots,
    readSlotRaw,
    setActiveSlotId,
    type SaveSlot,
} from '../engine/SaveSlots';
import { RanchSaveSchema, type IRanchState } from '../engine/runTypes';
import { setBattleState } from '../ui/store/battleSlice';
import { loadSave, resetSave } from '../ui/store/gameSlice';
import { type SaveEditAction } from './saveEdit';

/** Same shape every debug write reports: applied, or refused with reasons and no side effect. */
export interface SlotOpResult {
    readonly ok: boolean;
    readonly issues: ReadonlyArray<string>;
    /** Set on success where an operation produced a slot (`createSlotOp`). */
    readonly slot?: SaveSlot;
}

const ok = (slot?: SaveSlot): SlotOpResult => ({ ok: true, issues: [], slot });
const refuse = (...issues: string[]): SlotOpResult => ({ ok: false, issues });

/** Anything that accepts the slice actions used here. `store.dispatch` satisfies it. */
export type SlotDispatch = (action: SaveEditAction) => void;

export type SlotSaveRead =
    | { readonly kind: 'empty' }
    | { readonly kind: 'valid'; readonly save: IRanchState }
    | { readonly kind: 'invalid'; readonly issues: ReadonlyArray<string> };

/**
 * Read and vet a slot's payload without touching the store.
 *
 * "Empty" is a legal, useful state: a brand-new slot with no save is how you get a clean run
 * to break things in. It is not an error, and switching into it is allowed.
 */
export function readSlotSave(slotId: string): SlotSaveRead {
    const raw = readSlotRaw(slotId);
    if (raw === null) return { kind: 'empty' };

    let json: unknown;
    try {
        json = JSON.parse(raw);
    } catch (err) {
        return { kind: 'invalid', issues: [`not valid JSON: ${String(err)}`] };
    }

    const parsed = RanchSaveSchema.safeParse(json);
    if (!parsed.success) {
        return {
            kind: 'invalid',
            issues: parsed.error.issues.map((issue) => `[${issue.path.join('.')}] ${issue.message}`),
        };
    }

    // Ticket 11: the envelope's `ranch` IS the slice's state. There is no projection step left —
    // `loadSave` takes it verbatim, exactly as `App.tsx`'s boot effect does.
    return { kind: 'valid', save: parsed.data.ranch };
}

function slotExists(slotId: string): boolean {
    return listSlots().some((slot) => slot.id === slotId);
}

/**
 * Move the active slot and bring the live game state with it.
 *
 * Order is load-bearing:
 *   1. vet the target payload — a refusal here changes nothing at all;
 *   2. clear the battle, while the OLD slot is still active, so an in-flight battle can never
 *      end into the new slot;
 *   3. move the pointer;
 *   4. replace `state.game` immediately, so the first autosave after the switch writes the new
 *      slot's own save rather than the previous slot's state.
 */
export function switchToSlot(slotId: string, dispatch: SlotDispatch): SlotOpResult {
    if (!slotExists(slotId)) return refuse(`unknown slot: ${slotId}`);
    if (getActiveSlotId() === slotId) return refuse(`already the active slot: ${slotId}`);

    const target = readSlotSave(slotId);
    if (target.kind === 'invalid') {
        return refuse(
            `slot ${slotId} holds a payload that fails RanchSaveSchema — not switched, so the ` +
                'autosave is not wedged:',
            ...target.issues,
        );
    }

    // (2) before (3): see the module header. This is the containment.
    dispatch(setBattleState(null));

    if (!setActiveSlotId(slotId)) {
        return refuse(`could not write the slot index — still on ${getActiveSlotId()}`);
    }

    // (4) An empty slot resets to an empty ranch, which is the correct fresh-run state and also
    // stops the previous slot's roster from being autosaved into this one.
    dispatch(target.kind === 'valid' ? loadSave(target.save) : resetSave());
    return ok();
}

/**
 * Create a slot, optionally duplicating another slot's stored save ("branch this run").
 *
 * The source is vetted first: branching a corrupt save would just manufacture a second slot
 * that cannot be switched into. Does not switch — the caller decides, because switching
 * discards a live battle and that should never be a surprise.
 */
export function createSlotOp(name: string, copyFromSlotId?: string): SlotOpResult {
    if (copyFromSlotId !== undefined) {
        if (!slotExists(copyFromSlotId)) return refuse(`unknown source slot: ${copyFromSlotId}`);
        const source = readSlotSave(copyFromSlotId);
        if (source.kind === 'invalid') {
            return refuse(`source slot ${copyFromSlotId} fails RanchSaveSchema — nothing branched:`, ...source.issues);
        }
    }

    const slot = createSlot(name, copyFromSlotId);
    return slot ? ok(slot) : refuse('could not write the slot index — no slot created');
}

/**
 * Delete a slot, switching away first when it is the active one.
 *
 * Deleting the active slot without switching would leave the store holding a save whose key no
 * longer exists; the next game-state change would autosave it straight into whichever slot the
 * index promoted. So the switch (battle clear included) happens first, and only then the delete.
 */
export function deleteSlotOp(slotId: string, dispatch: SlotDispatch): SlotOpResult {
    if (!slotExists(slotId)) return refuse(`unknown slot: ${slotId}`);
    const slots = listSlots();
    if (slots.length <= 1) {
        return refuse('cannot delete the last slot — the save API always needs somewhere to write');
    }

    if (getActiveSlotId() === slotId) {
        const survivor = slots.find((slot) => slot.id !== slotId);
        if (!survivor) return refuse('no other slot to fall back to');
        const switched = switchToSlot(survivor.id, dispatch);
        if (!switched.ok) {
            return refuse(`cannot leave the slot being deleted — nothing deleted:`, ...switched.issues);
        }
    }

    return deleteSlot(slotId) ? ok() : refuse(`could not delete slot ${slotId}`);
}
