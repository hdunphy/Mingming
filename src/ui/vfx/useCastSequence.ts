/**
 * THE CAST SEQUENCE — ticket 146c, *"the row most of the feel lives in"*.
 *
 * Ruling 5, in Henry's words: *"Player card flies to the lane, then the animations play, then go to
 * discard … on a fire card a flame shoots across the screen in front of the card in the lane, hits
 * the target and 'explodes', then statuses get applied, then the card zooms to the discard."*
 *
 * Five steps, in order, with the card sitting BEHIND the effects. This module owns steps 2-4 — the
 * trail, the impact and the status tells — which is where the feel actually is; the card's own
 * flight and discard are `PlayedCardReveal`'s, because the card is a React element and these are
 * particles.
 *
 * # WHY THE STATUSES HAVE TO BE BUFFERED
 *
 * The engine resolves a whole cast synchronously inside the reducer: `PROGRAM_PLAYED`,
 * `DAMAGE_TAKEN` and every `STATUS_APPLIED` arrive in the same tick, microseconds apart, before a
 * single frame has rendered. Played as they arrive, the entire sequence would happen at once and
 * ruling 5's ORDER — trail, then impact, then statuses — would be invisible.
 *
 * So a cast opens a window: every status that lands while the window is open belongs to that cast
 * and is replayed on the clock rather than on arrival. The window closes on the next
 * `PROGRAM_PLAYED` or when the sequence has played out.
 *
 * # WHY A QUEUE
 *
 * §2c: *"a second cast queues behind the first (the AI can cast faster than the sequence plays)"*.
 * The AI resolves its whole turn in one synchronous burst — at 3v3 that can be seven casts before
 * the browser paints once. Without a queue they would all animate on top of each other and the
 * player would see one composite flash instead of seven plays.
 */

import { useEffect, useRef } from 'react';

import { globalBattleEventBus, type BattleEvent } from '../../engine/events';
import { GetProgramData } from '../../engine/data/programRegistry';
import { getModifierBreakdown } from '../../engine/combatUtils';
import { loadSettings, resolveVfxGates } from '../settings/settings';
import type { IBattleEntity, IBattleState, StatusType } from '../../engine/types';
import { anchorFor, emitImpact, emitTrail } from './emit';
import { TRAIL_MS, TRAIL_STAGGER_MS, type TrailElement } from './trails';
import {
    emitSelfCost, emitShieldAbsorb, emitStatusApplied, emitStatusRemoved, emitStatusTick,
} from './statusTells';
import { emitHookTell } from './osTells';

/** §2c: the hand card reaches the lane in 180ms, and the trail leaves after it. */
export const FLIGHT_MS = 180;
/** §2c: status tells land this far apart, after the impact. */
export const STATUS_TELL_STAGGER_MS = 60;

/** Above this multiplier a hit is super-effective; below its reciprocal, resisted. */
const SUPER_EFFECTIVE_AT = 1.2;
const RESISTED_AT = 0.85;

interface PendingCast {
    readonly element: TrailElement;
    readonly sourceId: string;
    readonly targetIds: string[];
    readonly doubled: boolean;
    readonly resisted: boolean;
    readonly statuses: Array<{ targetId: string; status: StatusType }>;
}

/**
 * Steps 2-4 for one cast, on the clock.
 *
 * Returns how long it will take, so the queue knows when the next cast may start. That number is
 * also what §2c means by *"the hold extends to cover 2-4 so the sequence never truncates"* — the
 * reveal's 1200ms hold is longer than this in every case the game can produce, and the assertion
 * in the test file is what keeps that true if either number moves.
 */
function playCast(cast: PendingCast, timers: number[]): number {
    let last = 0;

    cast.targetIds.forEach((targetId, index) => {
        const from = anchorFor(cast.sourceId);
        const to = anchorFor(targetId);
        if (!from || !to) return;

        // §2c: *"Side/All cards send one trail per target, 40 ms apart."* The stagger is what makes
        // a three-target card read as three hits rather than as one wide flash.
        const offset = FLIGHT_MS + index * TRAIL_STAGGER_MS;

        timers.push(window.setTimeout(() => emitTrail(cast.element, from, to), offset));
        timers.push(window.setTimeout(
            () => emitImpact(cast.element, to, cast.doubled, cast.resisted),
            offset + TRAIL_MS,
        ));
        last = Math.max(last, offset + TRAIL_MS);
    });

    // Step 4: the statuses, after the last impact, 60ms apart. Ruling 5's order is the point —
    // a status tell that fires before the thing that caused it lands reads as unrelated.
    cast.statuses.forEach((entry, index) => {
        const at = last + STATUS_TELL_STAGGER_MS * (index + 1);
        timers.push(window.setTimeout(() => {
            const anchor = anchorFor(entry.targetId);
            if (anchor) emitStatusApplied(entry.status, entry.targetId);
        }, at));
        last = Math.max(last, at);
    });

    return last;
}

export function useCastSequence(battleState: IBattleState | null): void {
    /*
     * ── TICKET 155a — WHY THIS IS A REF AND THE EFFECT IS MOUNT-SCOPED ───────────────────────
     *
     * This hook shipped with `[battleState]` as its dependency, and that one array made every
     * row of 146 dead on arrival. The sequence is worth spelling out because it fails in a way
     * that leaves the whole suite green:
     *
     *   1. A card is played. The reducer emits `PROGRAM_PLAYED` SYNCHRONOUSLY inside the dispatch.
     *   2. The handler below opens a cast window and arms `setTimeout(…, 0)` to close it at the
     *      end of the reducer's burst.
     *   3. The dispatch returns a NEW `battleState`. React re-renders and, because the dependency
     *      changed, runs this effect's CLEANUP FIRST — which nulls `open`, empties the queue and
     *      clears every timer.
     *   4. The 0ms closure fires, sees a closed window, and drops the cast.
     *
     * Every play. No trail, no impact, no queued status tell — while `useBattleVfx` kept working,
     * because it is mount-scoped with a `stateRef`, which is the pattern this now copies.
     *
     * The tests passed because `useImpactFeedback.test.tsx` mounted once with a constant state
     * object and never re-rendered. A test that never does the thing the user does cannot fail the
     * way the user does; the re-render is now part of both test files.
     */
    const stateRef = useRef(battleState);
    useEffect(() => {
        stateRef.current = battleState;
    });

    useEffect(() => {
        // Read once per fight, as `useImpactFeedback` does and for the same reason.
        const gates = resolveVfxGates(loadSettings());
        if (gates.vfx !== 'full') return;

        const timers: number[] = [];
        const queue: PendingCast[] = [];
        let open: PendingCast | null = null;
        let busyUntil = 0;

        const findEntity = (id: string): IBattleEntity | undefined => {
            const state = stateRef.current;
            return state?.playerParty.find((e) => e.id === id)
                ?? state?.enemyParty.find((e) => e.id === id);
        };

        /** Start the next cast if nothing is playing, or schedule the attempt for when it is. */
        const pump = (): void => {
            const now = performance.now();
            if (now < busyUntil || queue.length === 0) return;
            const cast = queue.shift();
            if (!cast) return;
            busyUntil = now + playCast(cast, timers);
            if (queue.length > 0) {
                timers.push(window.setTimeout(pump, Math.max(16, busyUntil - now)));
            }
        };

        const enqueue = (cast: PendingCast): void => {
            queue.push(cast);
            pump();
        };

        const handle = (event: BattleEvent): void => {
            switch (event.type) {
                case 'PROGRAM_PLAYED': {
                    // The previous cast's window closes here: anything still open belonged to it.
                    if (open) enqueue(open);

                    const data = GetProgramData(event.programId);
                    const source = findEntity(event.sourceId);
                    const target = findEntity(event.targetId);

                    /*
                     * The effectiveness read, from the engine's own decomposition rather than a
                     * second type chart in the UI. §2c makes this a gameplay tell — a player who
                     * can see the matchup landing does not have to hold the chart in their head —
                     * so it has to agree with the damage, not merely look plausible.
                     */
                    const breakdown = source && target
                        ? getModifierBreakdown(source, target, data)
                        : null;
                    const effectiveness = breakdown?.effectiveness ?? 1;

                    open = {
                        element: (data.element ?? 'None') as TrailElement,
                        sourceId: event.sourceId,
                        targetIds: [event.targetId],
                        doubled: effectiveness >= SUPER_EFFECTIVE_AT,
                        resisted: effectiveness <= RESISTED_AT,
                        statuses: [],
                    };
                    return;
                }
                case 'STATUS_APPLIED': {
                    // Belongs to the cast whose window is open. A status that lands with no window
                    // is an engine expiry or a turn-boundary effect, and 146f plays it immediately
                    // rather than queueing it behind a cast that is not happening.
                    if (open) open.statuses.push({ targetId: event.targetId, status: event.status });
                    else emitStatusApplied(event.status, event.targetId);
                    return;
                }
                case 'STATUS_REMOVED': {
                    // §2f: the badge shrinks and a grey puff leaves the sprite. Immediate rather
                    // than queued — a removal is usually an expiry at a turn boundary, with no
                    // cast to sequence it behind.
                    emitStatusRemoved(event.targetId);
                    return;
                }
                case 'DAMAGE_TAKEN': {
                    /*
                     * §2f's tick, and the recoil/toll pulse. Played AT ARRIVAL rather than through
                     * the cast queue, on purpose: a DoT tick happens at a turn boundary with no
                     * cast in flight, and a recoil is simultaneous with its own card rather than
                     * downstream of it. Queueing either would delay it behind a sequence it is not
                     * part of.
                     */
                    if (event.cause === 'status' && event.status) {
                        emitStatusTick(event.status, event.targetId);
                        return;
                    }
                    if (event.cause === 'recoil' || event.cause === 'toll') {
                        emitSelfCost(event.targetId);
                        return;
                    }
                    if ((event.damage?.absorbed ?? 0) > 0) emitShieldAbsorb(event.targetId);

                    /*
                     * A Side or All card hits several targets, and the engine tells us who only
                     * through the damage. Collected here rather than read off the card's `target`
                     * field, because the card says "Side" and the BOARD says which three bodies
                     * that was — after deaths, after a taunt redirect, after everything.
                     */
                    if (open && event.cause !== 'status' && !open.targetIds.includes(event.targetId)) {
                        open.targetIds.push(event.targetId);
                    }
                    return;
                }
                case 'HOOK_FIRED': {
                    /*
                     * TICKET 146g. Played at arrival rather than queued behind a cast: a hook fires
                     * DURING the cast that triggered it, and the whole point of the tell is that
                     * the player connects the two. Delaying it past the sequence would break the
                     * only link it has to its cause.
                     *
                     * The event is already guarded against AI lookahead in the engine (146b), so
                     * everything reaching here happened in the real fight.
                     */
                    emitHookTell(
                        findEntity(event.ownerId),
                        event.osId,
                        event.daemonId,
                        open?.targetIds[0],
                    );
                    return;
                }
                case 'TURN_END':
                case 'TURN_START': {
                    // A turn boundary closes any window: nothing more is coming for that cast.
                    if (open) { enqueue(open); open = null; }
                    return;
                }
                default:
            }
        };

        const unsubscribe = globalBattleEventBus.subscribe((event) => {
            handle(event);
            /*
             * The window closes at the end of the synchronous burst the reducer produced, which is
             * what a zero-delay timeout waits for: every event of one cast has arrived by the time
             * the task queue gets a turn. Cheaper and more honest than guessing a duration.
             */
            if (open) {
                const closing = open;
                setTimeout(() => {
                    if (open === closing) { open = null; enqueue(closing); }
                }, 0);
            }
        });

        return () => {
            unsubscribe();
            for (const id of timers) window.clearTimeout(id);
            timers.length = 0;
            queue.length = 0;
            open = null;
        };
        // MOUNT-SCOPED. See the note at the top of this hook: a dependency here tears the cast
        // window down inside the dispatch that opened it.
    }, []);
}
