/**
 * TICKET 184c — reading a counter the way the engine reads it.
 *
 * Two reads, both copied from the engine's own rules rather than re-imagined:
 *
 * - **The value.** `state.counters` keys are scoped (`ConditionValidator`, `HookFactory`): OWNER is
 *   `key:ownerId` and the default, SIDE is `key@PLAYER|ENEMY`, GLOBAL is the bare key. The same two
 *   resolver functions are called here, so a pip can never read a different key from the one the
 *   hook writes.
 * - **The limit.** Read off the hook's own gate (`when.counter`/`when.counters`) instead of being
 *   typed in a second time. That is what makes a patch show: REPEATER moves OUROBOROS_LOOP's
 *   `LT 1` to `LT 2`, and the pip says "2 a turn" because the gate does.
 */

import { resolveCounterKey, resolveSideCounterKey, type CounterScope } from '../../engine/core/HookTypes';
import type { IBattleEntity, IBattleState } from '../../engine/types';
import type { HookData } from './counterTypes';

export interface CounterRef {
    readonly key: string;
    /** Defaults to OWNER, as the engine's does. */
    readonly scope?: CounterScope;
}

export function counterValue(state: IBattleState, owner: IBattleEntity, ref: CounterRef): number {
    const resolved = ref.scope === 'SIDE'
        ? resolveSideCounterKey(ref.key, owner, state)
        : resolveCounterKey(ref.key, ref.scope, owner);
    return (state.counters ?? {})[resolved] ?? 0;
}

type GateOperator = 'LT' | 'LTE' | 'GT' | 'GTE' | 'EQ';

/**
 * The number a hook compares this counter against, for the first gate on `key` whose operator is
 * one of `operators`. Undefined when no hook gates on it (a patch may have changed the shape).
 */
export function gateValue(hooks: ReadonlyArray<HookData>, key: string, operators: ReadonlyArray<GateOperator>): number | undefined {
    for (const hook of hooks) {
        const gates = [...(hook.when?.counter ? [hook.when.counter] : []), ...(hook.when?.counters ?? [])];
        for (const gate of gates) {
            if (gate.key === key && operators.includes(gate.operator as GateOperator)) return gate.value;
        }
    }
    return undefined;
}

/**
 * TICKET 184d: EVERY number a hook compares this counter against, smallest first. REPEATER on
 * OUROBOROS_LOOP gives the count two triggers (3 and 5), so a pip needs the next one, not the first.
 */
export function gateValues(hooks: ReadonlyArray<HookData>, key: string, operators: ReadonlyArray<GateOperator>): number[] {
    const values = new Set<number>();
    for (const hook of hooks) {
        const gates = [...(hook.when?.counter ? [hook.when.counter] : []), ...(hook.when?.counters ?? [])];
        for (const gate of gates) {
            if (gate.key === key && operators.includes(gate.operator as GateOperator)) values.add(gate.value);
        }
    }
    return [...values].sort((a, b) => a - b);
}

/**
 * A once-per-turn style limit as a COUNT of fires: `LT n` allows n, `LTE n` allows n + 1. This is
 * the form REPEATER edits.
 */
export function usesAllowed(hooks: ReadonlyArray<HookData>, key: string): number | undefined {
    const lt = gateValue(hooks, key, ['LT']);
    if (lt !== undefined) return lt;
    const lte = gateValue(hooks, key, ['LTE']);
    return lte === undefined ? undefined : lte + 1;
}
