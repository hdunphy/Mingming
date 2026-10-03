/**
 * TICKET 190f - THE x N OF A LANDING. The more stacks, the more it throws: 1 to 2 times the base from
 * one stack to five, then no more (a sixth stack is a number on the plaque, not a bigger cloud). A
 * stack added to a status already there lands at half.
 */

export const MAX_COUNTED_STACKS = 5;
export const ADDED_SHARE = 0.5;

export function stackFactor(stacks: number, stacksAdded: boolean): number {
    const counted = Math.max(1, Math.min(MAX_COUNTED_STACKS, Math.round(stacks)));
    const grown = 1 + (counted - 1) / (MAX_COUNTED_STACKS - 1);
    return stacksAdded ? grown * ADDED_SHARE : grown;
}

/** `base` particles, grown by the stacks; never fewer than one. */
export const countFor = (base: number, stacks: number, stacksAdded: boolean): number =>
    Math.max(1, Math.round(base * stackFactor(stacks, stacksAdded)));
