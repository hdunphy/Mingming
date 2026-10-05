/**
 * TICKET 184c — the four kinds of counter, each a small reader factory.
 *
 * Every counter in the game is one of these. The registry (`counterDisplays.ts`) only says which
 * kind, which key and what the words are; how a kind reads the battle is written once, here.
 */

import { counterValue, gateValues, usesAllowed, type CounterRef } from './counterReads';
import type { CounterContext, CounterReader, CounterReading } from './counterTypes';

/** Where a progress counter's target comes from: a number, or the hook's own gate on the key. */
export type TargetSource = number | 'gate';

/**
 * The NEXT number the count fires at: the smallest gate above the current value (the count fires
 * when it reaches a gate, so at rest it sits below the next one). With one gate that is just the
 * gate; with REPEATER's 3-and-5 it is 3, then 5.
 */
function targetOf(context: CounterContext, ref: CounterRef, target: TargetSource, value: number): number | undefined {
    if (target !== 'gate') return target;
    const gates = gateValues(context.hooks, ref.key, ['EQ', 'GTE']);
    return gates.find((gate) => gate > value) ?? gates[gates.length - 1];
}

/**
 * PROGRESS — counting up to a trigger: `3/5`. Lit `ready` when the next one fires it.
 *
 * `uses`, when given, is a per-turn fire limit (OUROBOROS_LOOP's once a turn). Once it is used up
 * the pip says `USED` until the turn resets it, rather than counting toward a fire that cannot
 * happen.
 */
export function progressCounter(spec: {
    readonly count: CounterRef;
    readonly target: TargetSource;
    readonly uses?: CounterRef;
    /** The hover sentence, given the count and the target (and the battle, for words that depend on a patch). */
    readonly describe: (value: number, target: number, context: CounterContext) => string;
    /** The hover sentence once the per-turn limit is used up. */
    readonly spentText?: (allowed: number) => string;
}): CounterReader {
    return (context) => {
        const value = counterValue(context.state, context.owner, spec.count);
        const target = targetOf(context, spec.count, spec.target, value);
        if (target === undefined || target <= 0) return null;
        if (spec.uses) {
            const allowed = usesAllowed(context.hooks, spec.uses.key) ?? 1;
            const used = counterValue(context.state, context.owner, spec.uses);
            if (used >= allowed) {
                return { text: 'USED', state: 'spent', tooltip: spec.spentText?.(allowed) ?? 'Used this turn; back next turn.' };
            }
        }
        return {
            text: `${value}/${target}`,
            state: value >= target - 1 ? 'ready' : 'counting',
            tooltip: spec.describe(value, target, context),
        };
    };
}

/**
 * PER TURN — fires a limited number of times a turn: `READY` / `USED`, or `2 LEFT` when the limit
 * is more than one. The limit comes from the gate unless a number is given.
 */
export function perTurnCounter(spec: {
    readonly used: CounterRef;
    readonly limit: TargetSource;
    /** The hover sentence while it can still fire, given how many fires are left of how many. */
    readonly readyText: (left: number, allowed: number) => string;
    readonly spentText: string;
}): CounterReader {
    return (context) => {
        const allowed = spec.limit === 'gate' ? usesAllowed(context.hooks, spec.used.key) : spec.limit;
        if (allowed === undefined || allowed <= 0) return null;
        const used = counterValue(context.state, context.owner, spec.used);
        const left = Math.max(0, allowed - used);
        if (left === 0) return { text: 'USED', state: 'spent', tooltip: spec.spentText };
        return {
            text: allowed === 1 ? 'READY' : `${left} LEFT`,
            state: 'ready',
            tooltip: spec.readyText(left, allowed),
        };
    };
}

/** ONE SHOT — a once-a-battle effect: `ARMED` until it goes off, then nothing at all. */
export function oneShotCounter(spec: {
    readonly fired: CounterRef;
    /** The hover sentence; a function when the words depend on the battle (which side owns it). */
    readonly armedText: string | ((context: CounterContext) => string);
}): CounterReader {
    return (context) => (counterValue(context.state, context.owner, spec.fired) > 0
        ? null
        : {
            text: 'ARMED',
            state: 'armed',
            tooltip: typeof spec.armedText === 'function' ? spec.armedText(context) : spec.armedText,
        });
}

/** LIVE — a value that is true right now. The reader decides when there is nothing to show. */
export function liveCounter(read: (context: CounterContext) => CounterReading | null): CounterReader {
    return read;
}
