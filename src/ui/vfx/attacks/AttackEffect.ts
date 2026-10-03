/**
 * TICKET 190d — WHAT AN ELEMENT ATTACK IS. Each one is a small object that, while it is alive, throws
 * particles each frame (`step`) and draws the shapes particles cannot be (`draw`: a beam, a jet, a
 * vine, a wall of fire, a wave). It lives on the battle clock like everything else, so a hit-stop
 * holds it and Instant never starts it.
 *
 * Each effect is built from where the bodies are and how long it should run, and returns ONE HIT TIME
 * PER TARGET: the moment the beam, the wall or the crest reaches that body. The cast sequence lands
 * the damage, the number and the freeze on those moments.
 */

import type { ParticleSeed } from '../particles';
import type { Point } from './curves';

/** A body on the stage: its sprite box, in stage-box coordinates, and who it is. */
export interface Body {
    readonly id: string;
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
}

export type Spawn = (seeds: ParticleSeed[]) => void;

export interface AttackInput {
    readonly caster: Body;
    /** Who it reaches. Side and All attacks list every body they hit. */
    readonly targets: ReadonlyArray<Body>;
    /** +1 when the caster acts toward the right (an ally), -1 toward the left. */
    readonly direction: 1 | -1;
    /** Milliseconds for the head of the attack to reach the target. */
    readonly headMs: number;
    /** Milliseconds it keeps pouring on the target after that. */
    readonly sustainMs: number;
    /** The damage scale, 0..1. */
    readonly s: number;
    /** The tier's particle multiplier. */
    readonly particleScale: number;
    /** Shake a target slightly while an attack pours on it. */
    readonly tremble?: (targetId: string, px: number) => void;
    readonly rng?: () => number;
}

export interface AttackEffect {
    /** How long the effect is alive, ms. */
    readonly durationMs: number;
    /** One frame: `ageMs` since it began, `dtMs` since the last frame. */
    step(ageMs: number, dtMs: number, spawn: Spawn): void;
    draw(ctx: CanvasRenderingContext2D, ageMs: number): void;
}

export interface HitTime {
    readonly targetId: string;
    /** Milliseconds after the effect begins. */
    readonly atMs: number;
}

export interface AttackBuild {
    readonly effect: AttackEffect;
    readonly hits: ReadonlyArray<HitTime>;
}

export type AttackMaker = (input: AttackInput) => AttackBuild;

export const centerOf = (body: Body): Point => ({ x: body.x + body.w / 2, y: body.y + body.h / 2 });

/** Where an attack leaves the caster: its front, a little above centre. */
export const muzzleOf = (body: Body, direction: 1 | -1): Point => ({
    x: body.x + body.w / 2 + direction * body.w * 0.33,
    y: body.y + body.h / 2 - body.h * 0.06,
});

/** Where the caster stands. */
export const feetOf = (body: Body): Point => ({ x: body.x + body.w / 2, y: body.y + body.h * 0.92 });

/** A frame is 1 at 60 fps: the lab tuned its spawn rates per frame. */
export const framesOf = (dtMs: number): number => dtMs / (1000 / 60);
