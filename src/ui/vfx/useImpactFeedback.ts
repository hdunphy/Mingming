/**
 * IMPACT FEEDBACK — ticket 146e's wiring: the hit-stop request and the scaled stage shake.
 *
 * # WHY A NEW SUBSCRIBER AND NOT `useBattleVfx`
 *
 * `useBattleVfx` already subscribes to this bus and already keeps a `shakeKey`. Two reasons not to
 * put this there:
 *
 * 1. 146's gate for every row is *"no change to any `useBattleVfx` test"*. That hook owns the
 *    floats, the flashes and the lunges — the feedback that says WHAT happened — and it is covered
 *    by tests that would have to be reasoned about on every juice row. Keeping impact weight out
 *    of it means those tests keep meaning what they meant.
 * 2. `shakeKey` cannot express this anyway. It is a counter that increments past a threshold
 *    (33% of max HP), which is a boolean with extra steps; 146e's shake is CONTINUOUS in damage and
 *    needs the fraction, the kill flag and the cause — none of which a counter carries.
 *
 * The old threshold shake in `BattleArena` is replaced by this hook rather than left beside it:
 * two shake sources on one motion control is a race, and the loser is whichever `start()` was
 * called second.
 */

import { useEffect, useRef } from 'react';
import type { useAnimation } from 'framer-motion';

/** What `useAnimation()` returns — framer-motion stopped exporting the name. */
type StageControls = ReturnType<typeof useAnimation>;

import { globalBattleEventBus } from '../../engine/events';
import { loadSettings, resolveVfxGates } from '../settings/settings';
import type { IBattleState } from '../../engine/types';
import {
    SHAKE_DURATION_MS, afterHitStop, hitStopMsFor, requestHitStop, resetHitStop, shakeAmplitudeFor,
    shakeKeyframes,
} from './hitStop';

/**
 * Subscribe for the life of a fight. `stageControls` is the `.stage-area` motion control, which
 * also owns the mount fade — the shake keyframes end at 0 so they compose rather than fight.
 */
export function useImpactFeedback(
    battleState: IBattleState | null,
    stageControls: StageControls,
): void {
    /*
     * TICKET 155a — mount-scoped, for the reason written out in `useCastSequence`.
     *
     * The failure here was quieter and arguably worse. `requestHitStop` ran inside the dispatch;
     * the re-render that dispatch caused then ran this effect's cleanup, whose `resetHitStop()`
     * cancelled the stop in the same tick. So the shake still played — just with no pause in front
     * of it, which is indistinguishable from the pre-146 threshold shake unless you are looking for
     * it. 146e's whole point is the pause, and it had never once happened in a real fight.
     */
    const stateRef = useRef(battleState);
    useEffect(() => {
        stateRef.current = battleState;
    });

    useEffect(() => {
        /*
         * Read ONCE per fight rather than per event. The settings cannot change mid-battle (the
         * screen is a route away), and re-reading storage inside a bus handler would put a JSON
         * parse on the impact path of every hit.
         */
        const gates = resolveVfxGates(loadSettings());
        if (!gates.animations) return;

        /*
         * TICKET 155a, found by the re-render test this row added.
         *
         * The shake is DEFERRED past the hit-stop (146e: a shake that plays through the pause turns
         * hit-stop into a stutter), so up to 110ms can pass between the hit and
         * `stageControls.start()`. If the component goes away in that window — a fight ending on
         * the killing blow, which is exactly when the stop is longest — framer-motion throws
         * `controls.start() should only be called after a component has mounted`.
         *
         * An unhandled exception on the most dramatic hit in a run. It surfaced here as an
         * unhandled error in the suite only because 155a's tests unmount while a stop is standing;
         * nothing before them ever did.
         */
        let mounted = true;

        const unsubscribe = globalBattleEventBus.subscribe((event) => {
            if (event.type !== 'DAMAGE_TAKEN') return;

            /*
             * ONLY an attack. Ruling 7 and 146f: *"Status damage looks different from card
             * damage"*, and 146e says it outright — never on `cause: 'status'`. A Poison tick that
             * froze the game and shook the screen every turn would make a damage-over-time deck
             * unplayable, and it is the single most important line in this file.
             *
             * A recoil and a toll are also not hits: they are prices the caster pays, and 146f
             * draws them as a red pulse on the caster. An absent `cause` is an older hand-built
             * event and reads as `attack`, which is what it was before this field existed.
             */
            const cause = event.cause ?? 'attack';
            if (cause !== 'attack') return;

            const applied = event.damage?.applied ?? event.amount;
            if (applied <= 0) return;   // Fully absorbed: the shield float is the feedback.

            const state = stateRef.current;
            const target = [...(state?.playerParty ?? []), ...(state?.enemyParty ?? [])]
                .find((e) => e.id === event.targetId);
            const maxHp = target?.maxHp ?? 0;

            // The ref holds the state from the last COMMITTED render, and events fire
            // synchronously inside the reducer — so `currentHp` is the HP BEFORE this hit, and a
            // hit at or past it is lethal. Same reasoning `useBattleVfx` uses for its own lethal
            // check, now reading through the same kind of ref.
            const isKill = !!target && target.currentHp > 0 && applied >= target.currentHp;

            requestHitStop(hitStopMsFor(applied, maxHp, isKill));

            // AFTER the stop, never through it — a shake that plays during the pause turns
            // hit-stop into a stutter, which is the one way to get this wrong that still looks
            // like it is working.
            const amplitude = shakeAmplitudeFor(applied, maxHp, isKill);
            afterHitStop(() => {
                if (!mounted) return;
                void stageControls.start({
                    x: shakeKeyframes(amplitude),
                    transition: { duration: SHAKE_DURATION_MS / 1000 },
                });
            });
        });

        return () => {
            mounted = false;
            unsubscribe();
            // Leaving a fight mid-stop would otherwise strand the clock and the next battle would
            // open frozen for up to 110ms. Safe to do here now that this only runs on UNMOUNT —
            // when it ran on every state change it was cancelling stops it had just requested.
            resetHitStop();
        };
        // MOUNT-SCOPED — see the note at the top of this hook. `stageControls` comes from
        // `useAnimation()`, which returns a stable object for the life of the component, so
        // listing it changes nothing except to document that it was considered.
    }, [stageControls]);
}
