/**
 * TICKET 184d — **PER-FIRMWARE PATCH EFFECTS, WRITTEN BY HAND WHERE THE GENERIC ONE IS WRONG.**
 *
 * Henry, 2026-10-01: *"the patches are lazily done, each patch should probably have a defined effect
 * per OS... They can be a modular thing in the backend."* The six patches stay generic transforms
 * (`patchRegistry.ts`) — that is still right for most cells. This table is the exception list: a
 * firmware/patch pair whose generic result is broken or not what Henry wants gets its effect
 * spelled out here, and every reader (the engine's `entityHooks`, the ranking, the no-op test, the
 * counter pips) goes through `applyPatchToFirmware`, so an override cannot be honoured in one place
 * and ignored in another.
 *
 * An override is a function over the firmware's WHOLE hook list, not one hook, because some
 * effects need a hook the firmware does not have (REPEATER on OUROBOROS_LOOP adds a second trigger).
 * `'none'` means the patch is not offered for that firmware at all.
 *
 * Henry's rulings, 2026-10-01:
 *
 * - **OUROBOROS_LOOP (jormungandr_v1).** The generic AMPLIFIER and SPLITTER switched it off (they
 *   stepped the counter by 2, so it never equalled 5) and REPEATER made it unlimited (its guard is
 *   written `SET 1`). Ruled: *"amplifier -> draw 2 cards, repeater -> draw cards on the 3rd and 5th
 *   water cards, splitter -> any element not just water"*.
 * - **GOSSIP_NODE (ratatoskr_v1).** The generic AMPLIFIER added 1 to a 10-power heal (+0.25%).
 *   Ruled: *"Rat_v1 go to 12 power."*
 * - **UNBOUND_KERNEL (fenrir_v1).** RELAY made Fenrir pay his 2% recoil whenever an ally attacked.
 *   Ruled: *"Fenrir_V1 Relay should be ignored."*
 */

import type { DataHookDefinition, HookAction, ModifierDataHookDefinition } from '../core/HookTypes';
import type { PatchId } from './patchRegistry';

type AnyHook = DataHookDefinition | ModifierDataHookDefinition;

/** A firmware's hook list in, the patched list out. Returns the SAME array when it changes nothing. */
export type FirmwarePatchFn = (hooks: ReadonlyArray<AnyHook>) => ReadonlyArray<AnyHook>;

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Replace one hook (by id) through `edit`; every other hook passes through untouched. */
function editHook(id: string, edit: (hook: AnyHook & { do?: HookAction[] }) => void): FirmwarePatchFn {
    return (hooks) => hooks.map((hook) => {
        if (hook.id !== id) return hook;
        const next = clone(hook) as AnyHook & { do?: HookAction[] };
        edit(next);
        return next;
    });
}

// ─── OUROBOROS_LOOP ──────────────────────────────────────────────────────────────────────────────

const OUROBOROS_TRIGGER = 'jorm_v1_trigger';
const OUROBOROS_COUNT = 'jorm_v1_count';

/** AMPLIFIER: the 5th Water card draws 2 instead of 1. The counter is left alone. */
const ouroborosAmplifier = editHook(OUROBOROS_TRIGGER, (hook) => {
    for (const action of hook.do ?? []) if (action.type === 'DRAW') action.amount = 2;
});

/**
 * REPEATER: the 3rd Water card draws too, as well as the 5th.
 *
 * A second trigger at 3, guarded by the same once-a-turn flag. It neither resets the count nor sets
 * the flag — the 5th card's trigger still does both — so the count runs 1 … 5 and fires twice, and
 * after the 5th the flag holds both triggers until the turn resets it.
 */
const ouroborosRepeater: FirmwarePatchFn = (hooks) => {
    const trigger = hooks.find((hook) => hook.id === OUROBOROS_TRIGGER) as (AnyHook & { do?: HookAction[] }) | undefined;
    if (!trigger) return hooks;
    const third = clone(trigger);
    third.id = `${OUROBOROS_TRIGGER}_third`;
    third.when = {
        ...third.when,
        counters: (third.when?.counters ?? []).map((gate) => (gate.key === 'jorm_water' ? { ...gate, value: 3 } : gate)),
    };
    third.do = (third.do ?? []).filter((action) => action.type === 'DRAW' || action.type === 'LOG');
    const at = hooks.indexOf(trigger);
    return [...hooks.slice(0, at), third, ...hooks.slice(at)];
};

/** SPLITTER: any card counts, not just Water — the 5th card of any element draws. */
const ouroborosSplitter: FirmwarePatchFn = (hooks) => hooks.map((hook) => {
    if (hook.id !== OUROBOROS_COUNT && hook.id !== OUROBOROS_TRIGGER) return hook;
    const next = clone(hook);
    if (next.when) delete next.when.programElement;
    return next;
});

// ─── GOSSIP_NODE ─────────────────────────────────────────────────────────────────────────────────

/** AMPLIFIER: the heal goes from 10 power (2.5% of max HP) to 12 (3%). */
const gossipAmplifier = editHook('ratatoskr_v1_hook', (hook) => {
    for (const action of hook.do ?? []) if (action.type === 'HEAL') action.power = 12;
});

// ─── THE TABLE ───────────────────────────────────────────────────────────────────────────────────

export const PATCH_OVERRIDES: Readonly<Partial<Record<string, Partial<Record<PatchId, FirmwarePatchFn | 'none'>>>>> = {
    jormungandr_v1: {
        amplifier: ouroborosAmplifier,
        repeater: ouroborosRepeater,
        splitter: ouroborosSplitter,
    },
    ratatoskr_v1: {
        amplifier: gossipAmplifier,
    },
    fenrir_v1: {
        relay: 'none',
    },
};
