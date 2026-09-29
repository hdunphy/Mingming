/**
 * TICKET 169h — No Recruits: you can't recruit. The party you start with is the party you finish with.
 *
 * One question, asked from the places that would grow the party: `workshop.planRecruit` (the choke
 * point every workshop and event recruit passes through), Stray Mingming's eligibility check (which
 * does not call `planRecruit`), the two run reducers that add a member, and the workshop screen.
 *
 * It does NOT block blueprint drops, Wild Tracks or the market's blueprint slot: those bank to the
 * ranch, which is meta progress, not recruiting. Benching or swapping members you already have, and
 * reflashing, still work.
 */

import type { IRunState } from '../../runTypes';
import { hasModifier } from './modifierRegistry';

export function recruitingBlocked(run: Pick<IRunState, 'modifiers'>): boolean {
    return hasModifier(run, 'no_recruits');
}
