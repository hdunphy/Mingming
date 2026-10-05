/**
 * TICKET 190f - what a status landing needs to know, and what it hands back.
 */

import type { EmitAt } from '../emit';
import type { ParticleSeed } from '../particles';
import type { ReactionKind } from './spriteReaction';

export interface LandingInput {
    /** The body that got the status, in stage-box coordinates. */
    readonly at: EmitAt;
    /** Its plaque, where the HP bar is (Bark Shield settles toward it); null when it is not drawn. */
    readonly plaque: EmitAt | null;
    /** How many stacks this landing is for (the x N of the float). */
    readonly stacks: number;
    /** True when the status was already on the body and this only added to it (a hook's stack). */
    readonly stacksAdded: boolean;
    readonly rng?: () => number;
}

export interface Landing {
    readonly seeds: ParticleSeed[];
    /** What the sprite itself does, when the table says it reacts. */
    readonly reaction?: ReactionKind;
}

export type LandingMaker = (input: LandingInput) => Landing;
