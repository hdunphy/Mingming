/**
 * TICKET 169g — Tight Budget: what a marketplace or workshop charges when the modifier is on.
 *
 * The one place the rule lives. Every buy site asks `shopPrice(run, base)` for the price it charges
 * and shows, so a quoted price and a charged price cannot drift apart, and a rule about pricing is
 * one file rather than ten.
 *
 * Only prices the player PAYS at a marketplace or workshop go through here. Selling is income and
 * is not changed. Event costs (The Toll, Data Broker, Mirror Protocol) are not changed either
 * (default D4). A free price stays free: the gym gate's upgrade and the events' free upgrades pass
 * 0 and get 0 back.
 */

import type { IRunState } from '../../runTypes';
import { hasModifier, modifierNumber } from './modifierRegistry';

/** The price step every number in the game moves in. */
const PRICE_STEP = 5;

export function shopPrice(run: Pick<IRunState, 'modifiers'>, base: number): number {
    if (base === 0 || !hasModifier(run, 'tight_budget')) return base;
    const raised = (base * (100 + modifierNumber('tight_budget', 'pricePercent'))) / 100;
    return Math.ceil(raised / PRICE_STEP) * PRICE_STEP;
}
