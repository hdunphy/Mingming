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

import { useEffect } from 'react';
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
    useEffect(() => {
        /*
         * Read ONCE per fight rather than per event. The settings cannot change mid-battle (the
         * screen is a route away), and re-reading storage inside a bus handler would put a JSON
         * parse on the impact path of every hit.
         */
        const gates = resolveVfxGates(loadSettings());
        if (!gates.animations) return;

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

            const target = [...(battleState?.playerParty ?? []), ...(battleState?.enemyParty ?? [])]
                .find((e) => e.id === event.targetId);
            const maxHp = target?.maxHp ?? 0;

            // `battleState` here is the snapshot from the render that installed this subscription,
            // and events fire synchronously inside the reducer — so `currentHp` is the HP BEFORE
            // this hit, and a hit at or past it is lethal. Same reasoning `useBattleVfx` uses for
            // its own lethal check.
            const isKill = !!target && target.currentHp > 0 && applied >= target.currentHp;

            requestHitStop(hitStopMsFor(applied, maxHp, isKill));

            // AFTER the stop, never through it — a shake that plays during the pause turns
            // hit-stop into a stutter, which is the one way to get this wrong that still looks
            // like it is working.
            const amplitude = shakeAmplitudeFor(applied, maxHp, isKill);
            afterHitStop(() => {
                void stageControls.start({
                    x: shakeKeyframes(amplitude),
                    transition: { duration: SHAKE_DURATION_MS / 1000 },
                });
            });
        });

        return () => {
            unsubscribe();
            // Leaving a fight mid-stop would otherwise strand the clock and the next battle would
            // open frozen for up to 110ms.
            resetHitStop();
        };
    }, [battleState, stageControls]);
}
