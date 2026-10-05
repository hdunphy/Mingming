/**
 * THE IMPACT FEEDBACK, ASSEMBLED — ticket 189d. The camera and the sprites' shudder, hooked to the
 * battle's one frame loop. Module-level for the reason `battleClock` is.
 */

import { battleDriver, battleHitStop } from '../clock/battleClockRuntime';
import { CameraPunch } from './CameraPunch';
import { CameraShake, ZERO_OFFSET, type CameraOffset } from './CameraShake';
import { SHAKE_SETTING } from './impactMath';
import { SpriteShakes } from './SpriteShakes';
import { StageDim } from './StageDim';

/*
 * The camera's strength, 0-1: the shake slider (ticket 190a), set once per fight by
 * `useImpactFeedback`. Starts at the ruled default of 60%.
 */
let strength = SHAKE_SETTING;
export const setShakeStrength = (value: number): void => { strength = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : SHAKE_SETTING; };
export const shakeStrength = (): number => strength;

export const cameraShake = new CameraShake(() => strength);
export const spriteShakes = new SpriteShakes(() => battleHitStop.remainingMs);
/** 190g: the zoom on a big hit, and the dark layer over a huge one's wind-up. Both ride the one frame loop. */
export const cameraPunch = new CameraPunch();
export const stageDim = new StageDim();

/** The element the camera moves (the stage area), set by the battle screen. */
interface CameraTarget { readonly style: { translate: string; rotate: string; scale?: string } }
/** The dark layer 190g draws over the stage. */
interface DimTarget { readonly style: { opacity: string } }
let cameraTarget: CameraTarget | null = null;
let cameraWritten = '';
let dimTarget: DimTarget | null = null;
let dimWritten = '';

function writeCamera(offset: CameraOffset, scale: number = 1): void {
    if (!cameraTarget) return;
    const moving = offset !== ZERO_OFFSET && (offset.x !== 0 || offset.y !== 0 || offset.degrees !== 0);
    const zoomed = scale !== 1;
    const key = `${moving ? `${offset.x.toFixed(2)}|${offset.y.toFixed(2)}|${offset.degrees.toFixed(3)}` : ''}#${zoomed ? scale.toFixed(4) : ''}`;
    if (key === cameraWritten) return;
    cameraWritten = key;
    cameraTarget.style.translate = moving ? `${offset.x.toFixed(2)}px ${offset.y.toFixed(2)}px` : '';
    cameraTarget.style.rotate = moving ? `${offset.degrees.toFixed(3)}deg` : '';
    // Back at 1 the property is cleared, not set to "1": the picture is exactly as it was.
    cameraTarget.style.scale = zoomed ? scale.toFixed(4) : '';
}

function writeDim(opacity: number): void {
    if (!dimTarget) return;
    const value = opacity > 0 ? opacity.toFixed(3) : '0';
    if (value === dimWritten) return;
    dimWritten = value;
    dimTarget.style.opacity = value;
}

/** The dark layer the stage dim writes to; `null` target on unmount. */
export function attachDim(target: DimTarget): () => void {
    dimTarget = target;
    dimWritten = '';
    return () => {
        if (dimTarget === target) {
            target.style.opacity = '0';
            dimTarget = null;
            dimWritten = '';
        }
    };
}

export function attachCamera(target: CameraTarget): () => void {
    cameraTarget = target;
    return () => {
        if (cameraTarget === target) {
            target.style.translate = '';
            target.style.rotate = '';
            target.style.scale = '';
            cameraTarget = null;
            cameraWritten = '';
        }
    };
}

battleDriver.addConsumer((frame) => {
    const sprites = spriteShakes.step(frame);
    writeCamera(cameraShake.step(frame), cameraPunch.step(frame));
    writeDim(stageDim.step(frame));
    return sprites || cameraShake.active || cameraPunch.active || stageDim.active;
});

/** A body or the camera has something to play: make sure the loop is running. */
export function wakeImpactFx(): void {
    battleDriver.wake();
}

/** Leaving a battle: nothing shakes, nothing is left offset. */
export function resetImpactFx(): void {
    cameraShake.reset();
    cameraPunch.reset();
    stageDim.reset();
    spriteShakes.reset();
    strength = SHAKE_SETTING;
    writeCamera(ZERO_OFFSET);
    writeDim(0);
}
