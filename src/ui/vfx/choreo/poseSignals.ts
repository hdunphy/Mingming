/**
 * TICKET 190c — THE ATTACKER'S POSE, SENT TO ITS SPRITE. The presenter sends one signal when a cast's
 * wind-up (or wiggle) begins; the caster's `StageSprite` plays the whole pose from it, on the battle
 * clock. Same shape as `presenter/cardSignals`: a module, not a hook, because the sender is a timed
 * action with no React tree to reach through.
 */

import type { Pose } from './attackPose';

export interface AttackPoseSignal {
    readonly sourceId: string;
    readonly pose: Pose;
}

type Listener = (signal: AttackPoseSignal) => void;
const listeners = new Set<Listener>();

export function onAttackPose(listener: Listener): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

export function emitAttackPose(signal: AttackPoseSignal): void {
    for (const listener of [...listeners]) listener(signal);
}
