// `Element` is in this list for a reason worth keeping: without it, `HookAction.element` below
// resolved to the DOM's global `Element` interface, because `lib: ["DOM"]` is on and the game's
// union was never imported here. Found by ticket 55 — the `(action as any).element` reaches in
// `HookFactory` were papering over it.
import type { Element, IBattleState, IBattleEntity, ProgramData, ProgramAction, StatusType, ActionType, ProgramCategory } from '../types';

/**
 * Counter scoping: 'OWNER' (the default for hook counters) namespaces the key
 * per hook-owning entity (`key:ownerId`) so two units running the same OS keep
 * independent counts. 'GLOBAL' uses the raw key for genuinely battle-wide
 * counters (e.g. deck_shuffles, last_overheal).
 */
export type CounterScope = 'GLOBAL' | 'OWNER' | 'SIDE';

export function resolveCounterKey(key: string, scope: CounterScope | undefined, owner: IBattleEntity): string {
    return scope === 'GLOBAL' ? key : `${key}:${owner.id}`;
}

/**
 * TICKET 71: the SIDE scope — one count shared by a whole party, and by nobody else.
 *
 * # WHY NEITHER EXISTING SCOPE COULD DO IT
 *
 * TIDAL SURGE counts *"every 10 cards this side plays"*. A Driver attaches its hooks to every
 * member, so:
 *
 * - **OWNER** (`key:entityId`) gives each of the three members a private count and the Driver fires
 *   at 30 cards instead of 10;
 * - **GLOBAL** (the raw key) is shared with the *opponent*, so the player's own plays would charge
 *   the boss's Driver.
 *
 * Both are wrong in a way that looks like a tuning problem rather than a bug, which is the class of
 * mistake this repo keeps paying for.
 *
 * # WHY IT IS A SEPARATE FUNCTION AND NOT A THIRD BRANCH ABOVE
 *
 * A side cannot be derived from an entity — `IBattleEntity` has no side field, by design; which
 * party an entity is in is a fact about the STATE. So resolving a SIDE key needs the state, and
 * folding it into `resolveCounterKey` would mean an optional `state` parameter that silently
 * degrades to an owner-scoped or global key when a caller forgets it. That is the exact failure
 * mode `HookSchema`'s comments keep warning about — a lever that looks connected and is not.
 *
 * A separate function with a REQUIRED state parameter makes the compiler ask for it.
 */
export function resolveSideCounterKey(key: string, owner: IBattleEntity, state: { playerParty: ReadonlyArray<IBattleEntity> }): string {
    const side = state.playerParty.some((e) => e.id === owner.id) ? 'PLAYER' : 'ENEMY';
    return `${key}@${side}`;
}

export enum HookPriority {
    SYSTEM = 100,
    GLOBAL = 75,
    ATTACKER = 50,
    PROGRAM = 40,
    DEFENDER = 25,
    LOGGING = 0
}

export type MutationRequest = {
    type: 'HP' | 'ENERGY' | 'MAX_ENERGY' | 'STATUS' | 'LOG' | 'EVENT' | 'GENERATE_CARD' | 'CLEANSE' | 'DISCARD' | 'EXHAUST' | 'RETURN' | 'SEARCH' | 'COUNTER' | 'DRAW';
    targetId: string;
    sourceId?: string; // Optional source of the mutation
    /*
     * The second and last `any` ticket 55 left, for `ProgramAction`'s reason at one remove.
     *
     * A mutation's payload shape is decided by its `type`, and the fourteen types carry genuinely
     * different ones — `{ amount, isHeal, element }` for HP, `{ key, operator, amount }` for
     * COUNTER, a whole event object for EVENT. The right type is a discriminated union keyed on
     * `type`, which is a day's work across `applyMutations`, `HookFactory` and every hook that
     * builds one, and it is only worth doing at the same time as `ProgramAction`'s.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payload: any;
};

export type HookResult = {
    state: IBattleState;
    isCancelled?: boolean;
};

export type HookContext = {
    source?: IBattleEntity;
    target?: IBattleEntity;
    program?: ProgramData;
    state: IBattleState;
    triggerDepth: number;
    isNaturalDraw?: boolean; // For Kraken's OS
    statusApplied?: StatusType; // For Fenrir's OS
    /**
     * TICKET 162e — **the ONE action this dispatch is about**, set at the three per-hit sites in
     * `battleReducer` (a card's action loop, a macro's, an enemy intent's).
     *
     * `program` is the whole card and is the wrong question for a per-hit hook: `actionType` in a
     * condition asks *"does this card have an ATTACK anywhere in it"*, which is true for the STATUS
     * half of an attack-plus-rider card too. A hook that must fire once per SWING needs the swing,
     * and this is it. Absent at the once-per-card dispatches (`onActionStart`, `onActionEnd`) and at
     * `runVitalsHook`, where there is no single action and `isAttack` therefore cannot pass.
     */
    action?: ProgramAction;
};

export type HookCondition = {
    /** 'ANY' = explicit always-match on this axis (ConditionValidator handles it by name). */
    source?: 'SELF' | 'ALLY' | 'OPPONENT' | 'ANY';
    target?: 'SELF' | 'ALLY' | 'OPPONENT' | 'ANY';
    actionType?: ActionType;
    /**
     * TICKET 162e — **passes when THIS action is an ATTACK.** Reads `context.action`, so it is
     * meaningful only at the per-hit dispatches (`onModifierPhase`, `onPostDamage`).
     *
     * It was in `HookSchema` from ticket 103 and READ BY NOTHING until now, which ticket 107's test
     * calls out by name: *"declared in the schema, read by nothing, and silently a no-op for
     * whoever tries it"*. Two shipped hooks had since tried it — `ember_ward` and `ember_ward+`,
     * whose printing is *"whenever an ally is hit BY AN ATTACK"* and which were firing on any
     * enemy action that resolved on an ally, a Weakened application included. Implementing the
     * field fixes both of them and is what lets EMBER_FUSE move to a per-hit trigger at all.
     *
     * Distinct from `actionType` on purpose, and the difference is the bug above: `actionType`
     * asks about the CARD, this asks about the SWING.
     */
    isAttack?: boolean;
    programElement?: string;
    baseCost?: number | { operator: 'LT' | 'GT' | 'LTE' | 'GTE' | 'EQ'; value: number };
    statusApplied?: StatusType;
    statusAppliedIn?: StatusType[]; // Passes when the applied status is any of these
    /**
     * TICKET 107: passes when the applied status is NOT any of these - the guard for a hook that
     * REACTS to a status application by APPLYING a status, which would otherwise re-trigger itself.
     * draugr_v2's Poison rider is the first: "statuses draugr applies to an enemy also apply
     * 1 Poison" would apply Poison, see its own Poison, and apply more.
     *
     * An allow-list (`statusAppliedIn`) can express the same guard today and was the cheaper
     * change, but it misstates the rule - the rider is "any status except my own" - and it rots
     * silently the moment a new card applies a status nobody remembered to add to the list.
     */
    statusAppliedNotIn?: StatusType[];
    programCategoryIn?: string[]; // Passes when a program is in context and its category matches one of these
    programCategoryNot?: string[]; // Passes when a program is in context and its category matches NONE of these
    programAppliesStatus?: boolean; // Passes when the program in context does (true) / does not (false) contain a STATUS action
    sourceDebuffCount?: { operator: 'LT' | 'GT' | 'LTE' | 'GTE' | 'EQ'; value: number }; // Number of negative statuses on context.source
    isNaturalDraw?: boolean;
    isToken?: boolean;
    targetStatus?: { status: StatusType; minStacks?: number };
    sourceStatus?: { status: StatusType; minStacks?: number };
    counter?: { key: string; operator: 'LT' | 'GT' | 'LTE' | 'GTE' | 'EQ'; value: number; scope?: CounterScope };
    /** Ticket 53: AND-list of counter checks, for hooks that need more than one (GENESIS_FIRMWARE). Composes with `counter`. */
    counters?: Array<{ key: string; operator: 'LT' | 'GT' | 'LTE' | 'GTE' | 'EQ'; value: number; scope?: CounterScope }>;
    currentEnergy?: { operator: 'LT' | 'GT' | 'LTE' | 'GTE' | 'EQ'; value: number };
    /**
     * TICKET 68: passes from battle turn `N` onward (`state.turn >= N`). The escalation clause of an
     * enemy Driver — WAR FOOTING grants 1 Strengthened a turn and 2 from turn 4 — and the first hook
     * condition that reads the CLOCK rather than the board.
     *
     * `state.turn` is a full round, not a side-turn: `processPreTurn` increments it only when the
     * active side flips back to PLAYER, so both sides see the same number and "turn 4" means the
     * same moment whoever is asking. An escalating aura written against side-turns would tick twice
     * as fast for the side that moves first.
     *
     * A floor rather than an operator pair, because escalation is the only thing anything has wanted
     * from the clock and a floor cannot be written backwards. If a hook ever needs "before turn N",
     * that grows a sibling here rather than an operator.
     */
    turnAtLeast?: number;
};

export type HookAction = {
    // `'HP'` is here because `lib/hooks.json` uses it and `HookFactory` dispatches on it; it was
    // missing from this union, which is why that comparison needed a cast to compile (ticket 55).
    type: ActionType | 'HP' | 'LOG' | 'COUNTER' | 'DRAW' | 'MAX_ENERGY'; // Hooks can perform actions or log
    target?: 'SELF' | 'TARGET' | 'SOURCE' | 'ALLIES' | 'ENEMIES' | 'RANDOM_ENEMY';
    /**
     * Ticket 69 (`drip_feed`): apply this action ONLY to resolved targets that already carry this
     * status. Checked per target, so it is meaningful on the multi-target forms — `ALLIES` and
     * `ENEMIES` — where the group is resolved but its members differ.
     *
     * *"each POISONED ally gains 1 Regen"* is not expressible without it: `target: 'ALLIES'` runs the
     * executor once per ally with no way to skip the healthy ones, and a hook-level `when` clause
     * tests the CONTEXT's target rather than each member of a resolved group.
     */
    targetHasStatus?: StatusType;
    status?: StatusType;
    stacks?: number;
    amount?: number;
    power?: number;
    element?: Element;
    percentMaxHP?: number;
    /**
     * Ticket 36: multiply this action by `1 + escalatePerPlay x (plays already made by the
     * owner this turn)`. Composes with `scaling` rather than replacing it, and resets every
     * turn with `playsThisTurn`.
     *
     * It exists because hel_v2's UNDERWORLD_GATEWAY had a flat per-cast price and she has no
     * Energy limit, so nothing stopped her emptying and refilling her hand on turn one - 6.5
     * casts on the turn she scored a first-turn kill. A flat toll cannot brake that: doubling
     * it moved section 2.3 by 48 points and the FTK count by zero. An escalating one does,
     * without capping her casts, which is the OS's whole identity.
     */
    escalatePerPlay?: number;
    costReduction?: number;
    flatBonus?: number;
    /**
     * Ticket 52: raw power added to the primed card's FIRST ATTACK action only.
     *
     * Distinct from `flatBonus`, which the reducer adds to every `power` field on the card
     * AND to STATUS stacks AND to HEAL power. That is the right shape for "make the next card
     * bigger" and the wrong one for UNSTOPPABLE_MASS, which is meant to prime one hit.
     */
    powerBonus?: number;
    multiplier?: number;
    text?: string;
    count?: number;
    dataId?: string; // For GENERATE_CARD
    key?: string; // For COUNTER key
    operator?: 'ADD' | 'SET' | 'RESET'; // For COUNTER operation
    scope?: CounterScope; // For COUNTER: 'OWNER' (default, per-entity) or 'GLOBAL'
    appliesTo?: ProgramCategory; // For BUFF_NEXT_PROGRAM: restrict the buff to the next card of this category
    scaling?: 'CURRENT_ENERGY' | 'SHARP_STACKS' | 'STRENGTH_STACKS' | 'ALIVE_ALLIES' | 'MISSING_HP' | 'OVERHEAL' | 'BASE_COST' | 'COUNTER' | 'SOURCE_DEBUFF_COUNT' | 'HEAL_INTENDED' | 'TARGET_POISON_STACKS' | 'HEAL_POWER';
    scalingKey?: string; // e.g., the key if scaling is 'COUNTER'
};

export type DataHookDefinition = {
    id: string;
    trigger: keyof Omit<HookDefinition, 'id' | 'priority' | 'onDamageCalculated' | 'onStatusDamageCalculated' | 'onHealCalculated'>;
    priority: HookPriority;
    /**
     * TICKET 16 — the Driver law is PROC-VISIBLE: *"every Driver names a trigger moment and the UI
     * flashes it when it procs."* A hook flagged `proc` announces itself through a `DRIVER_PROC`
     * battle event whenever its `when` passes (`HookFactory.announceProc`). It is a flag rather
     * than "every `driver_` hook" because a Driver is usually SEVERAL hooks — a counter that
     * advances on every attack and a payoff that fires on the tenth — and only the payoff is the
     * moment the player is meant to see. Read on both hook kinds; meaningful only for hooks whose
     * definition belongs to a Driver (`driverRegistry.driverIdForHook`).
     */
    proc?: boolean;
    when?: HookCondition;
    condition?: (context: HookContext, owner: IBattleEntity) => boolean; // For custom complex logic
    do: HookAction[];
};

export type ModifierDataHookDefinition = {
    id: string;
    trigger: 'onDamageCalculated' | 'onPowerCalculated' | 'onStatusDamageCalculated' | 'onCostCalculated' | 'onHealCalculated';
    priority: HookPriority;
    /** Ticket 16: see `DataHookDefinition.proc`. */
    proc?: boolean;
    when?: HookCondition;
    condition?: (context: HookContext, owner: IBattleEntity) => boolean; // For custom complex logic
    multiplier?: number;
    bonus?: number;
    scaling?: 'CURRENT_ENERGY' | 'SHARP_STACKS' | 'STRENGTH_STACKS' | 'ALIVE_ALLIES' | 'MISSING_HP' | 'OVERHEAL' | 'BASE_COST' | 'COUNTER' | 'SOURCE_DEBUFF_COUNT' | 'HEAL_INTENDED' | 'TARGET_POISON_STACKS' | 'HEAL_POWER';
    scalingKey?: string;
};

export type DamageModifierHook = (
    currentDamage: number,
    context: HookContext,
    owner: IBattleEntity
) => number;

export type EventHook = (
    context: HookContext,
    owner: IBattleEntity
) => HookResult;

export type HookDefinition = {
    id: string;
    priority: number;
    onDamageCalculated?: DamageModifierHook;
    /**
     * TICKET 150b — THE POWER-SIDE TWIN OF `onDamageCalculated`.
     *
     * Ticket 26's law: *a bonus that rides the POWER is the only kind `powerscale` can price, and
     * the only kind that behaves the same at every level.* `onDamageCalculated` fires at step 5 of
     * `calculateDamage` — after the attack/defense ratio, the /45 pace divisor, STAB and type
     * effectiveness — so a `bonus` there is flat HP that none of those dials can reach. The 149b
     * census measured what that does: TOXIN_FANG's +10 HP per Poison stack delivers **x3.93 on the
     * attack it rides**, a size the pace dial and the frame cannot move and the scorer cannot see.
     *
     * This fires at step 1 instead, on the raw power, where the duality statuses already ride
     * (`statusPower`). Same `multiplier`/`bonus`/`scaling` shape, same priority sort, same
     * dedupe-by-id — the only difference is WHERE in the pipeline the number lands, which is the
     * whole point.
     */
    onPowerCalculated?: DamageModifierHook;
    onStatusDamageCalculated?: DamageModifierHook; // New hook for Burn/Poison scaling
    onCostCalculated?: DamageModifierHook; // Same signature as damage hook (returns a number)
    /** Ticket 36: healing had NO modifier path at all - `onHeal` fires after the heal resolves
     *  and is a reaction hook. Same signature as the damage modifier (takes a number, returns
     *  one) so it slots into the existing modifier family unchanged. */
    onHealCalculated?: DamageModifierHook;
    onActionStart?: EventHook;
    /** Ticket 36: symmetric partner to onActionStart, dispatched ONCE PER PROGRAM after the
     *  multi-hit action loop finishes - never once per action, or a multi-action card would
     *  flip Hel's stance mid-card. End-of-action rather than start is the whole design: the
     *  card that sets a stance must not benefit from it, only the next card does. */
    onActionEnd?: EventHook;
    onModifierPhase?: EventHook;
    onPostDamage?: EventHook;
    onCardDraw?: EventHook;
    onStatusApplied?: EventHook;
    onStatusRemoved?: EventHook;
    onTurnStart?: EventHook;
    onTurnEnd?: EventHook;
    onDeckShuffled?: EventHook;
    onHeal?: EventHook;
    onUnitFainted?: EventHook;
    onDiscarded?: EventHook;
    /**
     * General-purpose threshold event (ticket 12): fires once whenever any unit
     * crosses from >=50% to <50% of maxHp via any HP loss (attack, DoT tick,
     * recoil, self-damage). Healing back above the line re-arms the unit
     * naturally, since only downward crossings are detected. context.source and
     * context.target are both the unit that crossed. First consumer: nidhoggr_v2
     * BLOOD_SCENT_OS.
     */
    onHpThresholdCrossed?: EventHook;
    data?: DataHookDefinition | ModifierDataHookDefinition; // Reference to original data
};
