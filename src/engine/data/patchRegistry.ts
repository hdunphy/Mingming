/**
 * TICKET 163c — **PATCHES: a rider that plugs into any OS, because it is written against the
 * grammar rather than against a firmware id.**
 *
 * 163 §3, RULED by Henry 2026-09-23 (shape B, tiers never, fork later; one slot per body):
 * *"A patch is a generic rider found in the run that any OS accepts... Patches are written against
 * the grammar, so they work on any OS because every OS is currency + trigger + ally output."*
 *
 * # WHY THIS FILE HOLDS TRANSFORMS AND NOT TWELVE TABLES
 *
 * The obvious build is a table per OS: what Amplifier does to UNBOUND_KERNEL, what it does to
 * TOXIN_FANG, and so on. Seventy-two cells of authored data, and seventy-two chances for a
 * repricing of one OS to leave its patch behind. §3 rejects that shape in its own words — *"each is
 * one hook-modifier keyed by the OS's trigger and output FIELDS rather than by OS id"* — and the
 * reason is the one this file is built on: a patch that names a field survives a firmware being
 * retuned, and a patch that names an OS does not.
 *
 * So a patch is a FUNCTION FROM HOOK DATA TO HOOK DATA. It reads the same `hooks.json` shape the
 * engine reads, changes the field it is about, and hands back something `HookFactory` can build.
 * `patchedHooks.test.ts` runs all six across all twelve and asserts every one of the seventy-two
 * results is a well-formed hook — which is the seventy-two-cell check the ticket asks for, except
 * that the cells are ASSERTED rather than authored.
 *
 * # WHAT A PATCH CANNOT DO, AND WHY THAT IS THE POINT
 *
 * A transform can only change what the data says. It cannot invent a trigger an OS does not have,
 * and it does not try: **a patch that finds nothing to change returns the hook unchanged**, and
 * `describePatch` says so. That is the scorer's flag in 163 §3 restated as behaviour — *"a Relay on
 * a self-only OS scores high and on an ally-reading OS scores zero"* — and it means the answer to
 * "what does Relay do to an OS that already reads allies" is *nothing*, out loud, rather than a
 * silent double application.
 *
 * # ONE SLOT PER BODY
 *
 * Henry, 163 §5 decision 4: one, and no second at the gym. `PATCH_SLOTS` is that number, and the
 * run state holds patches per member (run-scoped — §5 decision 5 rules no cross-run persistence,
 * and `IRanchMember` is the roster that survives a run).
 */
import type { DataHookDefinition, ModifierDataHookDefinition, HookAction } from '../core/HookTypes';
import { PATCH_OVERRIDES } from './patchOverrides';

/** Henry, 163 §5: ONE slot per body, and no second at the gym. */
export const PATCH_SLOTS = 1;

export type PatchId = 'amplifier' | 'repeater' | 'relay' | 'splitter' | 'overclock' | 'failsafe';

type AnyHook = DataHookDefinition | ModifierDataHookDefinition;

/**
 * A view of a hook that names every field a patch might touch, across BOTH hook shapes.
 *
 * `DataHookDefinition` has `do`; `ModifierDataHookDefinition` has `multiplier`/`bonus`; a patch
 * does not care which it was handed and asks about all of them. One alias here rather than a cast
 * at each of the eleven reads below, so "which fields can a patch see" is a list in one place.
 */
type PatchableHook = AnyHook & {
    do?: HookAction[];
    multiplier?: number;
    bonus?: number;
};

const asPatchable = (hook: AnyHook): PatchableHook => hook as PatchableHook;

export interface PatchDefinition {
    readonly id: PatchId;
    readonly name: string;
    /** What the player is told it does, in the grammar's own words rather than one OS's. */
    readonly text: string;
    /**
     * The field this patch is about — 163 §4's list. Carried as data rather than inferred from the
     * id so the scorer and the plaque can group patches without knowing what each one is called.
     */
    readonly field: 'amount' | 'triggers' | 'actor' | 'target' | 'stacks' | 'drawback';
    /**
     * TICKET 184d: what the patch acts on. `firmware` patches transform the OS's hook data, so
     * whether they do anything is a fact about the firmware (`patchDoesNothing`). OVERCLOCK is
     * `body`: it changes what a card's scaler counts on the member, not any hook, so no firmware
     * can make it a no-op.
     */
    readonly reach: 'firmware' | 'body';
    /** Hook data in, hook data out. Returns the SAME object when there is nothing to change. */
    readonly apply: (hook: AnyHook) => AnyHook;
}

// =================================================================================================
// The helpers every transform shares.
// =================================================================================================

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Numeric payload fields a `do` action can carry. The same list `descriptionData` calls printed. */
const AMOUNT_FIELDS = ['power', 'stacks', 'amount'] as const;

/** Does this hook harm its own owner? The Failsafe's question, asked of the data. */
function isDrawback(action: HookAction): boolean {
    const self = action.target === 'SELF';
    if (!self) return false;
    /*
     * BOTH HP SHAPES. `amount` is flat HP; `percentMaxHP` is a fraction of the pool, and it is the
     * one UNBOUND_KERNEL's recoil actually uses (`percentMaxHP: -2`) — §3's own worked example of
     * what FAILSAFE is for. Checking only `amount` made the patch inert on every launch firmware,
     * which `patches.test.ts` caught by asking whether each patch changes anything on anybody.
     */
    const hp = action as unknown as Record<string, unknown>;
    if (action.type === 'HP') {
        for (const field of ['amount', 'percentMaxHP', 'percentMaxHp']) {
            const value = hp[field];
            if (typeof value === 'number' && value < 0) return true;
        }
    }
    // A self-applied debuff is the other shape a cost takes — Undertow's self-Weakened, and the
    // recoil daemons. Named by the status rather than by a flag, because the data has no flag.
    const DEBUFFS = ['Burn', 'Poison', 'Weakened', 'Dazed', 'Stunned', 'Asleep', 'Bleed'];
    return action.type === 'STATUS' && typeof action.status === 'string' && DEBUFFS.includes(action.status);
}

// =================================================================================================
// THE SIX.
// =================================================================================================

export const PATCHES: Readonly<Record<PatchId, PatchDefinition>> = Object.freeze({
    /**
     * AMPLIFIER — *"the OS's number +1 (or +50%)."* §3 calls it *"the boring one every OS can take
     * and the workshop's default stock"*, which is exactly why it is written first and simplest.
     *
     * +1 to a COUNT, ×1.5 to a MULTIPLIER, and the split is the grammar's: a stack is a thing you
     * have one more of, and a percentage is a thing that scales. Applying +1 to a 1.2 multiplier
     * would be a 120% damage buff, which is the failure a single rule would have shipped.
     */
    amplifier: {
        id: 'amplifier',
        name: 'AMPLIFIER',
        text: 'Your firmware\'s number goes up: one more stack, or half again as much.',
        field: 'amount',
        reach: 'firmware',
        apply: (hook) => {
            const next = asPatchable(clone(hook));
            let touched = false;
            if (typeof next.multiplier === 'number') {
                // ×1.5 on the BONUS the multiplier carries, not on the multiplier itself: 1.2 is
                // "+20%", and half again as much is +30%, not ×1.8.
                next.multiplier = Math.round((1 + (next.multiplier - 1) * 1.5) * 100) / 100;
                touched = true;
            }
            if (typeof next.bonus === 'number') {
                next.bonus = Math.round(next.bonus * 1.5 * 10) / 10;
                touched = true;
            }
            for (const action of next.do ?? []) {
                for (const field of AMOUNT_FIELDS) {
                    const value = (action as unknown as Record<string, unknown>)[field];
                    if (typeof value === 'number' && value !== 0) {
                        // +1 toward whatever sign it already had: a removal of 1 becomes a removal
                        // of 2, not a removal of nothing.
                        (action as unknown as Record<string, unknown>)[field] = value + Math.sign(value);
                        touched = true;
                    }
                }
            }
            return touched ? next : hook;
        },
    },

    /**
     * REPEATER — *"the trigger fires one extra time per turn (for once-a-turn OSes) or on a second
     * event."*
     *
     * A once-a-turn OS says so with a COUNTER in its `when`, which is the only way the data can
     * express "not again this turn" (`reactive_plating` is the pattern). So the transform raises
     * that ceiling by one, and an OS with no ceiling gets nothing — correctly, because an OS that
     * already fires on every event has no extra time to be given.
     */
    repeater: {
        id: 'repeater',
        name: 'REPEATER',
        text: 'A firmware that holds itself to once a turn gets one more.',
        field: 'triggers',
        reach: 'firmware',
        apply: (hook) => {
            const gates = [
                ...(hook.when?.counter ? [hook.when.counter] : []),
                ...(hook.when?.counters ?? []),
            ];
            // Only a CEILING is a rate limit. `GT`/`GTE` gates are "once you have enough", and
            // raising one of those would make the OS harder to fire, not easier.
            if (!gates.some((gate) => gate.operator === 'LT' || gate.operator === 'LTE')) return hook;
            const next = clone(hook);
            if (next.when?.counter && (next.when.counter.operator === 'LT' || next.when.counter.operator === 'LTE')) {
                next.when.counter.value += 1;
            }
            for (const gate of next.when?.counters ?? []) {
                if (gate.operator === 'LT' || gate.operator === 'LTE') gate.value += 1;
            }
            return next;
        },
    },

    /**
     * RELAY — *"the trigger also counts allies' actions (for OSes that read only self)."*
     *
     * §3 names this and Splitter as *"the upgrade layer's answer to 158: they are how a run turns a
     * solitaire OS into a party one."* The transform is one field: a `when.source` of `SELF` widens
     * to `ALLY`, which in `ConditionValidator` means "anyone on the owner's side, the owner
     * included". An OS already reading `ALLY`, `OPPONENT` or `ANY` is untouched, and that zero is
     * the flag 163 §3 asks the scorer to print.
     */
    relay: {
        id: 'relay',
        name: 'RELAY',
        text: 'Firmware that only watches you now watches your whole side.',
        field: 'actor',
        reach: 'firmware',
        apply: (hook) => {
            if (hook.when?.source !== 'SELF') return hook;
            const next = clone(hook);
            next.when!.source = 'ALLY';
            return next;
        },
    },

    /**
     * SPLITTER — *"the OS's output goes to an ally instead of / as well as self."*
     *
     * AS WELL AS, not instead of, and that is a design call worth saying out loud. §3 offers both;
     * "instead of" would make the patch a downgrade for the body carrying it, which is a strange
     * thing to find in a treasure chest. So a self-targeted output is DUPLICATED onto the side, and
     * the host keeps what it had.
     */
    splitter: {
        id: 'splitter',
        name: 'SPLITTER',
        text: 'What your firmware gives you, the rest of your side gets too.',
        field: 'target',
        reach: 'firmware',
        apply: (hook) => {
            const selfward = (asPatchable(hook).do ?? []).filter((a: HookAction) => a.target === 'SELF' && !isDrawback(a));
            if (selfward.length === 0) return hook;
            const next = asPatchable(clone(hook));
            // 184: OTHER_ALLIES, not ALLIES — the host keeps what it had and the rest of the side
            // gains it too. Henry, 2026-10-01: "Splitter doesn't double up on Fenrir_V1."
            const echoes = selfward.map((a: HookAction) => ({ ...clone(a), target: 'OTHER_ALLIES' as const }));
            // After the originals, so the host is paid first and an ally cannot be paid by a hook
            // whose own cost has not resolved.
            next.do = [...(next.do ?? []), ...echoes];
            return next;
        },
    },

    /**
     * OVERCLOCK — *"the OS's currency stacks are worth one more in every payoff that reads them."*
     *
     * §4 calls this *"a status-value modifier on the member"* rather than a hook change, and that
     * is what it is: nothing in the hook data says what a Sharp stack is worth to a scaler. So its
     * `apply` is the IDENTITY, deliberately, and the work is done where scalers read a pile —
     * `ActionExecutors`, via `overclockBonus`. Kept in this table anyway so the six are one list
     * with one shape: a patch the player can be offered, priced and shown, whose implementation
     * happens to live elsewhere.
     */
    overclock: {
        id: 'overclock',
        name: 'OVERCLOCK',
        text: 'Every stack you hold counts for one more when a card cashes it.',
        field: 'stacks',
        reach: 'body',
        apply: (hook) => hook,
    },

    /**
     * FAILSAFE — *"the OS's drawback is removed or halved."*
     *
     * REMOVED, on §4's first word. Halving a 5-HP toll is a change the player cannot feel, and a
     * patch nobody notices is worse than one that does not exist. A drawback is read off the data —
     * self-damage, or a self-applied debuff — rather than flagged, because the data has no flag and
     * inventing one would mean touching twelve firmware entries to describe a patch.
     */
    failsafe: {
        id: 'failsafe',
        name: 'FAILSAFE',
        text: 'Whatever your firmware costs you, it stops costing.',
        field: 'drawback',
        reach: 'firmware',
        apply: (hook) => {
            const kept = (asPatchable(hook).do ?? []).filter((a: HookAction) => !isDrawback(a));
            if (kept.length === (asPatchable(hook).do ?? []).length) return hook;
            const next = asPatchable(clone(hook));
            next.do = kept;
            return next;
        },
    },
});

export const PATCH_IDS: ReadonlyArray<PatchId> = Object.keys(PATCHES) as PatchId[];

/** A patch by id, or undefined for an id that is not one. */
export function getPatch(id: string): PatchDefinition | undefined {
    return (PATCHES as Record<string, PatchDefinition>)[id];
}

/**
 * How much a patch would change about this firmware's hooks — 0 when it finds nothing.
 *
 * The honest answer to *"what does Relay do to an OS that already reads allies"*, and the number
 * 163 §3 wants the scorer and the offer screen to be able to see before either of them promises
 * the player anything.
 */
export function patchTouchCount(patch: PatchDefinition, hooks: ReadonlyArray<AnyHook>): number {
    return hooks.reduce((n: number, hook: AnyHook) => n + (patch.apply(hook) === hook ? 0 : 1), 0);
}

/**
 * TICKET 184d — **one patch on one firmware, the way every reader must see it.**
 *
 * The firmware's own hand-written effect for this patch if `patchOverrides.ts` has one, else the
 * generic transform on each hook. The engine (`entityHooks`), the ranking, the no-op test and the
 * counter pips all call this, so an override can never be honoured in one of them and missed in
 * another. Returns the SAME array when the patch changes nothing (and for a `'none'` override).
 */
export function applyPatchToFirmware(
    osId: string,
    patch: PatchDefinition,
    hooks: ReadonlyArray<AnyHook>,
): ReadonlyArray<AnyHook> {
    const override = PATCH_OVERRIDES[osId]?.[patch.id];
    if (override === 'none') return hooks;
    if (override) return override(hooks);
    const out = hooks.map((hook) => patch.apply(hook));
    return out.every((hook, i) => hook === hooks[i]) ? hooks : out;
}

/** Every patch a body carries, applied in order — `applyPatchToFirmware` folded over the list. */
export function applyPatchesToFirmware(
    osId: string,
    patches: ReadonlyArray<PatchDefinition>,
    hooks: ReadonlyArray<AnyHook>,
): ReadonlyArray<AnyHook> {
    return patches.reduce((acc, patch) => applyPatchToFirmware(osId, patch, acc), hooks);
}

/**
 * TICKET 184d — **a patch that changes nothing on this firmware is never offered for it.**
 *
 * Henry, 2026-10-01, on patches that do nothing on a body: *"Hide them I think."* A `firmware`
 * patch that finds nothing to change in any of the OS's hooks is a prize the body cannot use — and
 * a hand-written firmware (`CustomFirmware`, e.g. huldra_v2) has no hook data at all, so every
 * firmware patch is a no-op on it. A `body` patch (OVERCLOCK) is never a no-op by this test. A
 * `'none'` override (fenrir_v1's RELAY, ruled "ignored") is hidden whatever its reach.
 */
export function patchDoesNothing(patch: PatchDefinition, osId: string, hooks: ReadonlyArray<AnyHook>): boolean {
    if (PATCH_OVERRIDES[osId]?.[patch.id] === 'none') return true;
    return patch.reach === 'firmware' && applyPatchToFirmware(osId, patch, hooks) === hooks;
}

/*
 * ══ THE RANKING LIVES IN `patchRanking.ts`, AND THE SPLIT IS A CYCLE, NOT A TIDY-UP. ══
 *
 * `bestPatchFor` and `gatePatchChoices` moved out under ticket 163g. They rank by the 149c-scored
 * delta, which means importing `debug/balance/powerscale` — and that closes a loop:
 *
 *     patchRegistry → powerscale → core/Hooks → core/entityHooks → patchRegistry
 *
 * ESM tolerates the loop and then hands the second module a half-initialised first one, so
 * `STATUS_MODEL` read as `undefined` at module scope and `powerscale` threw on load. It failed
 * loudly, which was luck: a cycle that resolves to `undefined` inside a function would have shipped.
 *
 * **This file is the half `entityHooks` needs** — the six transforms, `getPatch`, the slot count
 * and `patchTouchCount` — and it imports nothing that can reach back. The ranking is the half
 * nothing in the hook path needs, so it can see the scorer. Anything that ranks imports
 * `patchRanking`; anything that APPLIES imports this.
 */
