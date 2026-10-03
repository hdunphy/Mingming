/**
 * THE IMPACT FEEDBACK, ASSEMBLED — ticket 189d. The camera and the sprites' shudder, hooked to the
 * battle's one frame loop. Module-level for the reason `battleClock` is.
 */

import { battleDriver, battleHitStop } from '../clock/battleClockRuntime';
import { CameraShake, ZERO_OFFSET, type CameraOffset } from './CameraShake';
import { SpriteShakes } from './SpriteShakes';

export const cameraShake = new CameraShake();
export const spriteShakes = new SpriteShakes(() => battleHitStop.remainingMs);

/** The element the camera moves (the stage area), set by the battle screen. */
interface CameraTarget { readonly style: { translate: string; rotate: string } }
let cameraTarget: CameraTarget | null = null;
let cameraWritten = '';

function writeCamera(offset: CameraOffset): void {
    if (!cameraTarget) return;
    const moving = offset !== ZERO_OFFSET && (offset.x !== 0 || offset.y !== 0 || offset.degrees !== 0);
    const key = moving ? `${offset.x.toFixed(2)}|${offset.y.toFixed(2)}|${offset.degrees.toFixed(3)}` : '';
    if (key === cameraWritten) return;
    cameraWritten = key;
    cameraTarget.style.translate = moving ? `${offset.x.toFixed(2)}px ${offset.y.toFixed(2)}px` : '';
    cameraTarget.style.rotate = moving ? `${offset.degrees.toFixed(3)}deg` : '';
}

export function attachCamera(target: CameraTarget): () => void {
    cameraTarget = target;
    return () => {
        if (cameraTarget === target) {
            target.style.translate = '';
            target.style.rotate = '';
            cameraTarget = null;
            cameraWritten = '';
        }
    };
}

battleDriver.addConsumer((frame) => {
    const sprites = spriteShakes.step(frame);
    writeCamera(cameraShake.step(frame));
    return sprites || cameraShake.active;
});

/** A body or the camera has something to play: make sure the loop is running. */
export function wakeImpactFx(): void {
    battleDriver.wake();
}

/** Leaving a battle: nothing shakes, nothing is left offset. */
export function resetImpactFx(): void {
    cameraShake.reset();
    spriteShakes.reset();
    writeCamera(ZERO_OFFSET);
}
