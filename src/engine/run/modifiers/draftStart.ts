/**
 * TICKET 169i — Draft Start: draft your starting cards instead of being dealt them.
 *
 * Each party member drafts `DRAFT_PICKS` cards, one pick at a time, from three offers. The offers
 * come from that member's TUNED DECK for its OS (`getDeckForOS`), one entry per copy in the deck. A
 * picked entry leaves the pool; offered-but-not-picked entries stay in it. The three generic hits the
 * first member brings are dealt as usual, and the payoff is not guaranteed (default D5): that is the
 * risk of drafting.
 *
 * This file is the pure half: the pool and the offers. The screen (`ui/screens/DraftStart.tsx`) holds
 * the picks, and `createRun` takes the finished kits as `startKitOverrides`.
 *
 * `DRAFT_PICKS` is `START_KIT_SIZE`. `createRun` checks its overrides against `START_KIT_SIZE`
 * directly rather than importing this constant, because this file reads `START_KIT_SIZE` from
 * `createRun` and the two importing each other would be a cycle; a test pins them equal.
 */

import { SeedStream } from '../../core/SeedStream';
import { GetMingmingData, getDeckForOS } from '../../data/mingmingRegistry';
import type { IMingmingState } from '../../types';
import { START_KIT_SIZE } from '../createRun';

/** How many cards each member drafts. */
export const DRAFT_PICKS = START_KIT_SIZE;

/** How many cards each pick offers. */
const OFFER_SIZE = 3;

/** The member's tuned deck for the OS it runs, one entry per copy. */
export function draftPool(member: Pick<IMingmingState, 'definitionId' | 'activeOS'>): string[] {
    const os = member.activeOS ?? GetMingmingData(member.definitionId).availableOS[0];
    return getDeckForOS(member.definitionId, os);
}

/**
 * The cards offered at one pick: three distinct POSITIONS of `remaining`, so two copies of the same
 * card can both be offered. Fewer than three only when fewer remain.
 *
 * Seeded by (seed, member, pick) so the same draft offers the same cards, and a member's pick n does
 * not shift when another member's picks change.
 */
export function draftOffer(
    seed: string,
    memberIndex: number,
    pickIndex: number,
    remaining: ReadonlyArray<string>,
): string[] {
    const stream = new SeedStream(new SeedStream(seed).fork(`draft:${memberIndex}:${pickIndex}`));
    const positions = remaining.map((_, index) => index);
    const count = Math.min(OFFER_SIZE, positions.length);
    // A partial Fisher-Yates: the first `count` slots end up holding distinct positions.
    for (let i = 0; i < count; i++) {
        const j = stream.nextInt(i, positions.length - 1);
        [positions[i], positions[j]] = [positions[j], positions[i]];
    }
    return positions.slice(0, count).map((position) => remaining[position]);
}

/** The pool after one copy of the picked card leaves it. A card the pool does not hold changes nothing. */
export function takePick(remaining: ReadonlyArray<string>, picked: string): string[] {
    const at = remaining.indexOf(picked);
    return at === -1 ? [...remaining] : [...remaining.slice(0, at), ...remaining.slice(at + 1)];
}
