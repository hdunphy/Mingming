/**
 * TICKET 184c — the shapes every counter readout shares.
 *
 * Henry, 2026-10-01: *"jorm draw on 5th water card needs a counter next to his OS. Any other OS
 * that have a counter or something should have visual feedback."* Ruled the same day: every
 * firmware, Driver and daemon that tracks something gets one, in this ticket.
 */

import type { DataHookDefinition, ModifierDataHookDefinition } from '../../engine/core/HookTypes';
import type { IBattleEntity, IBattleState } from '../../engine/types';

/**
 * - `counting` — working toward a trigger (`3/5`).
 * - `ready`    — the next qualifying play fires it.
 * - `spent`    — fired as often as it may this turn; back next turn.
 * - `armed`    — a one-time effect that has not gone off yet.
 * - `live`     — a number that is true right now (Fenrir v1's Fire bonus).
 */
export type CounterState = 'counting' | 'ready' | 'spent' | 'armed' | 'live';

/** What a pip shows: a few characters, a state for its colour, and a sentence for its hover. */
export interface CounterReading {
    readonly text: string;
    readonly state: CounterState;
    readonly tooltip: string;
}

/** Hook data as the engine reads it — for a firmware, AFTER the body's patch has been applied. */
export type HookData = DataHookDefinition | ModifierDataHookDefinition;

export interface CounterContext {
    /** The body the counter belongs to. For a Driver, the first member of the party. */
    readonly owner: IBattleEntity;
    readonly state: IBattleState;
    /** The hooks whose gates set the counter's limits — patched, so a REPEATER reads as two. */
    readonly hooks: ReadonlyArray<HookData>;
}

/** One counter's whole behaviour: given the battle, what does the pip say (or nothing at all). */
export type CounterReader = (context: CounterContext) => CounterReading | null;
