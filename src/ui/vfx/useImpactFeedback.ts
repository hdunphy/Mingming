/**
 * IMPACT FEEDBACK — ticket 146e's hit-stop and shake, since ticket 189d heard from the IMPACT.
 *
 * It used to subscribe to the engine's `DAMAGE_TAKEN`, so the freeze and the shake fired at the
 * moment of play, before the trail had left and with nothing on screen to freeze. It now listens for
 * the presenter's stage moment (`impact/stageMoments`), so it fires at the instant the hit is drawn:
 *
 * - the HIT-STOP freezes game time (`60 + 80 s` ms, 170 on a kill, scaled by effectiveness and by
 *   how many bodies the card hit), and the target and the attacker shudder while it holds;
 * - big hits and kills add camera TRAUMA, and small hits do not: a hit under 12% of the target's max
 *   HP shakes only the target's sprite (that is `StageSprite`, off the same moment's `hitKey`).
 *
 * ONLY an attack. Ruling 7 and 146f: *"Status damage looks different from card damage"*. A Poison
 * tick that froze the game and shook the screen every turn would make a damage-over-time deck
 * unplayable, and a recoil or a toll is a price the caster pays, not a hit. Those moments never
 * reach the freeze or the camera.
 *
 * MOUNT-SCOPED (ticket 155a): the subscription lives for the fight, and tearing it down on a state
 * change cancelled the stop the same tick it was requested.
 */

import { useEffect, type RefObject } from 'react';

import { loadSettings, resolveVfxGates } from '../settings/settings';
import { requestHitStop, resetHitStop } from './hitStop';
import {
    RESISTED_AT, SUPER_EFFECTIVE_AT, addsCameraTrauma, cameraTraumaFor, damageSeverity, hitStopLengthMs, vibratePx,
} from './impact/impactMath';
import { attachCamera, cameraPunch, cameraShake, resetImpactFx, setShakeStrength, spriteShakes, wakeImpactFx } from './impact/impactRuntime';
import { isBigHit } from './choreo/bigHit';
import { activeProfile } from './tiers/activeTier';
import { onStageMoment } from './impact/stageMoments';

/**
 * Subscribe for the life of a fight. `cameraRef` is the stage area: the thing the camera moves.
 */
export function useImpactFeedback(cameraRef: RefObject<HTMLElement | null>): void {
    useEffect(() => {
        /*
         * Read ONCE per fight rather than per event. The settings cannot change mid-battle (the
         * screen is a route away), and re-reading storage inside a handler would put a JSON parse on
         * the impact path of every hit.
         */
        const gates = resolveVfxGates(loadSettings());
        if (!gates.animations) return undefined;
        // 190a: the slider. Zero shakes nothing; reduced motion never gets here (animations is off).
        setShakeStrength(gates.shake);

        const camera = cameraRef.current;
        const detachCamera = camera ? attachCamera(camera) : undefined;

        const stopListening = onStageMoment((moment) => {
            if (moment.kind !== 'hit') return;
            if (moment.applied <= 0) return;   // Fully absorbed: the shield float is the feedback.

            const severity = damageSeverity(moment.applied, moment.maxHp);
            const resisted = moment.effectiveness <= RESISTED_AT;

            // 190a: the hit-stop has its own switch, and the shudder below follows the freeze's real length.
            if (gates.hitStop) {
                requestHitStop(hitStopLengthMs({
                    severity,
                    isKill: moment.isLethal,
                    superEffective: moment.effectiveness >= SUPER_EFFECTIVE_AT,
                    resisted,
                    targets: moment.targets,
                }));
            }
            // After the freeze was asked for: the shudder is as long as the freeze really is.
            spriteShakes.vibrate([moment.targetId, moment.sourceId], vibratePx(severity));

            if (gates.shake > 0 && addsCameraTrauma({ applied: moment.applied, maxHp: moment.maxHp, isKill: moment.isLethal, resisted })) {
                cameraShake.add(cameraTraumaFor(severity, moment.isLethal));
            }
            /*
             * TICKET 190g: the camera punch. A big hit (the damage scale the tier charges up from, or any kill)
             * zooms the picture by `cameraPunch x s` and eases it back; Snappy and Fast have none. It is
             * camera motion, so the shake slider at 0 and a resisted hit both leave it out (reduced motion
             * and Instant never get here at all).
             */
            const profile = activeProfile();
            if (gates.shake > 0 && !resisted && profile.cameraPunch > 0
                && (moment.isLethal || isBigHit(severity, profile.chargeFrom))) {
                cameraPunch.punch(profile.cameraPunch * severity);
            }
            wakeImpactFx();
        });

        return () => {
            stopListening();
            detachCamera?.();
            // Leaving a fight mid-stop would otherwise strand the clock and the next battle would
            // open frozen. Safe to do here because this only runs on UNMOUNT.
            resetHitStop();
            resetImpactFx();
        };
    }, [cameraRef]);
}
