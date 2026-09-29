/**
 * TICKET 168e — the outcomes that grant a power (a Driver, a patch) or spend a blueprint.
 */

import { addDriver, fitPatch } from '../store/runSlice';
import { spendBlueprint } from '../store/gameSlice';
import { patchOffers } from '../../engine/run/events/eventPatch';
import type { OutcomeContext, OutcomeDispatch } from './applyOutcome';

/** `DRIVER_PICK`: the chosen Driver joins the run's Drivers (the reducer refuses a duplicate). */
export function applyDriverPick(dispatch: OutcomeDispatch, driverId: string): void {
    dispatch(addDriver(driverId));
}

/**
 * `PATCH`: the chosen body's BEST patch, fitted. The patch is re-derived here from the body rather
 * than trusted from the payload, so a stale screen cannot fit the wrong one. `price` is the choice's
 * scrap price (30), riding the fit as one action; the "give up a Rare" choice has none.
 */
export function applyPatch(dispatch: OutcomeDispatch, ctx: OutcomeContext, memberId: string, price: number): void {
    const offer = patchOffers({ ...ctx, ranch: ctx.ranch ?? { roster: [], blueprints: {} } }).find((row) => row.memberId === memberId);
    if (!offer) return;
    dispatch(fitPatch({ memberId, patchId: offer.patchId, price }));
}

/** `GIVE_BLUEPRINT`: one blueprint of the species leaves the ranch. */
export function applyGiveBlueprint(dispatch: OutcomeDispatch, speciesId: string): void {
    dispatch(spendBlueprint(speciesId));
}
