/**
 * THE EMIT API — ticket 146a.
 *
 * *"an `emit(kind, at, opts)` API driven by the same `globalBattleEventBus` subscription
 * `useBattleVfx` uses."*
 *
 * # WHY THIS IS A MODULE AND NOT A HOOK
 *
 * The callers are event handlers, not components. 146c fires a trail when a card is played, 146f a
 * ring when a status lands, 146g a puff when a hook resolves — all of them inside a bus
 * subscription, none of them with a React tree to reach through. A hook would force every one of
 * those call sites to become a component that re-renders to emit, which is the opposite of the
 * ticket's *"No React state per frame"*.
 *
 * So the layer REGISTERS itself as the sink while it is mounted, and `emit` is a plain function.
 * With no layer mounted — every test that does not render the stage, the balance harness, a
 * headless run — `emit` is a no-op rather than an error. A visual effect is never load-bearing, and
 * a missing one must never be able to break a fight.
 *
 * # WHY NOT PERSISTENT EMITTERS
 *
 * Henry's ruling 3: *"For now no persistent status emitters; it was the apply status or remove
 * status that should get an emitter."* Everything here is a MOMENT — you call `emit` when
 * something happens. Nothing in this file can subscribe to a standing condition, and the layer has
 * no path to the battle state to poll one. That is deliberate: the first build of 146a kept every
 * burning unit on fire for as long as the status was on them, which is exactly the thing the
 * ticket rules out in §1.3 and again in §4. The plaque badge is the standing read.
 */

import type { ParticleSeed } from './particles';
import type { StageAnchors } from '../hooks/useStageAnchors';
/*
 * `emitters.ts` imports the types below back from here, which is a cycle on paper and not one at
 * runtime: every import in that direction is `import type`, and TypeScript erases those. The
 * alternative — a third module holding four type declarations — buys nothing.
 */
import { burstFor } from './emitters';

/**
 * The whole particle vocabulary of ticket 146 — §2a names these seven and no others.
 *
 * Keeping it closed is what stops the later rows inventing a shape each: 146d's three element
 * trails, 146f's status tells and 146g's OS signatures are all spelled with this alphabet, and a
 * row that genuinely needs an eighth has to come back to the ticket to add it.
 */
export type ParticleKind = 'flame' | 'drop' | 'leaf' | 'spark' | 'puff' | 'ring' | 'streak';

/** Where a burst happens: a point, or a box when the burst should fill one (a sprite slot). */
export interface EmitAt {
    readonly x: number;
    readonly y: number;
    readonly w?: number;
    readonly h?: number;
}

export interface EmitOpts {
    /** How much of it. Per-kind meaning — tongues for `flame`, particles for the rest. */
    readonly intensity?: number;
    /** Overrides the kind's own colour. 146f passes `STATUS_COLORS[status]`. */
    readonly color?: { readonly r: number; readonly g: number; readonly b: number };
    /** For directional kinds (`streak`, `spark`): where it is heading. */
    readonly toward?: EmitAt;
    /** Injected randomness, so a test or a capture can be deterministic. */
    readonly rng?: () => number;
}

/** What a mounted `ParticleLayer` offers the module. */
export interface ParticleSink {
    spawn(seeds: ReadonlyArray<ParticleSeed>): void;
    /** Wake the rAF loop — the layer parks itself when nothing is alive. */
    wake(): void;
}

let sink: ParticleSink | null = null;
let anchors: StageAnchors | null = null;

/**
 * The stage anchors, published by the mounted layer.
 *
 * Here rather than on the component for two reasons. The lint rule is the shallow one (a file that
 * exports a component may not also export helpers, or fast refresh breaks). The real one is that
 * this belongs beside `emit`: a bus handler that wants to fire a ring at a unit needs to turn an
 * entity id into a rectangle, and it has no more access to the React tree than `emit` does. Both
 * halves of "where" and "what" now come from the same module.
 */
export function setStageAnchors(next: StageAnchors | null): void {
    anchors = next;
}

/** The slot rectangle for an entity, or `null` when the stage is not mounted or the id is unknown. */
export function anchorFor(entityId: string): EmitAt | null {
    return anchors?.slots[entityId] ?? null;
}

/** The plaque rectangle for an entity — 146f lands status pops here rather than on the sprite. */
export function plaqueFor(entityId: string): EmitAt | null {
    return anchors?.plaques[entityId] ?? null;
}

/**
 * Called by `ParticleLayer` on mount and with `null` on unmount.
 *
 * Last one wins, and in practice there is only ever one: the layer lives inside `BattleStage`, and
 * there is one stage. A second would mean two fights on screen at once, which is not a state this
 * game has.
 */
export function setParticleSink(next: ParticleSink | null): void {
    sink = next;
}

/** Whether anything is listening. For tests, and for a caller that wants to skip building a burst. */
export const hasParticleSink = (): boolean => sink !== null;

/**
 * Fire a burst. No-op when no layer is mounted or particles are switched off — see the header.
 *
 * The seeds come from `burstFor`, which owns every number; this function owns only the plumbing,
 * so a new kind is a new recipe rather than a change here.
 */
export function emit(kind: ParticleKind, at: EmitAt, opts: EmitOpts = {}): void {
    if (!sink) return;
    const seeds = burstFor(kind, at, opts);
    if (seeds.length === 0) return;
    sink.spawn(seeds);
    sink.wake();
}
