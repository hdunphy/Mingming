/**
 * TICKET 190e - what a burst needs to know about the hit it dresses.
 */

import type { EmitAt } from '../emit';
import type { Rgb } from '../trails';
import type { Matchup } from './impactCount';

export interface ImpactInput {
    /** The body that was hit, in stage-box coordinates. */
    readonly at: EmitAt;
    /** The damage scale of this hit, 0..1 (`damageScale`). */
    readonly s: number;
    readonly matchup: Matchup;
    readonly isKill: boolean;
    /** +1 when the attacker is to the left of the target (the spray goes right), -1 otherwise. */
    readonly direction: 1 | -1;
    /** The tier's multiplier on every burst. */
    readonly particleScale: number;
    /** The element's own colour. */
    readonly color: Rgb;
    readonly rng?: () => number;
}
