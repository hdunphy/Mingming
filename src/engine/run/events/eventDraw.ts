/**
 * TICKET 168a — which event a node plays: rules 3 to 6 of the ticket, in one function.
 *
 * 1. Roll the RARITY first: Common 60, Uncommon 30, Rare 10, and no Rare in the first biome
 *    (`biomeIndex` 0), where the other two are drawn 60:30.
 * 2. Pick uniformly among the ELIGIBLE, NOT-YET-SEEN events of that rarity.
 * 3. None left in that rarity: fall back to the next rarity down (Rare, Uncommon, Common), then up.
 * 4. Nothing at all: return `null`, and the node pays the Empty Relay (`emptyRelay.ts`).
 *
 * The power cap (rule 5) lives here too: once an event has granted a Driver, no event that grants
 * one is eligible again, and likewise for patches.
 *
 * Deterministic (rule 6): the stream is `nodeSeed(run, node, 'event')`, so the same run state on the
 * same node draws the same event. That is what lets a player who closes the app mid-event get the
 * same event back on resume.
 *
 * Engine module: no React, no Redux, no `Math.random()`.
 */

import { SeedStream } from '../../core/SeedStream';
import { nodeSeed } from '../nodeSeed';
import type { IRegionNode, IRunState } from '../../runTypes';
import { EVENTS } from './eventCatalogue';
import { isEventEligible } from './eventEligibility';
import { grantSpent, seenEventIds } from './eventState';
import type { EventContext, EventRanchView } from './eventContext';
import type { EventDefinition, EventRarity } from './eventSchema';

/**
 * The events whose outcomes are all built. Every other event is ineligible until its row lands
 * (168b onward each add their ids here), so a player is never handed a button that does nothing.
 */
export const BUILT_EVENTS: ReadonlySet<string> = new Set(['scrap_cache', 'data_fragments', 'relay_tower']);

/** Ticket 168 rule 4. The Rare weight is zeroed in the first biome. */
export const EVENT_RARITY_WEIGHTS: Readonly<Record<EventRarity, number>> = { Common: 60, Uncommon: 30, Rare: 10 };

/** Lowest to highest. The fallback walks down from the rolled rarity, then up. */
const RARITY_ORDER: ReadonlyArray<EventRarity> = ['Common', 'Uncommon', 'Rare'];

/** Test seams: the real draw passes none of these. */
export interface DrawOptions {
    readonly catalogue?: ReadonlyArray<EventDefinition>;
    readonly built?: ReadonlySet<string>;
    readonly isEligible?: (eventId: string, ctx: EventContext) => boolean;
}

/** The rarities this node may roll, with their weights. */
function weightsFor(node: IRegionNode): Array<[EventRarity, number]> {
    return RARITY_ORDER
        .map((rarity): [EventRarity, number] => [
            rarity, rarity === 'Rare' && node.biomeIndex === 0 ? 0 : EVENT_RARITY_WEIGHTS[rarity],
        ])
        .filter(([, weight]) => weight > 0);
}

/** Rolled rarity first, then down, then up (rule 4's fallback). */
function fallbackOrder(rolled: EventRarity): EventRarity[] {
    const at = RARITY_ORDER.indexOf(rolled);
    return [rolled, ...RARITY_ORDER.slice(0, at).reverse(), ...RARITY_ORDER.slice(at + 1)];
}

export function drawEvent(
    run: IRunState,
    node: IRegionNode,
    ranch: EventRanchView,
    options: DrawOptions = {},
): EventDefinition | null {
    const catalogue = options.catalogue ?? EVENTS;
    const built = options.built ?? BUILT_EVENTS;
    const eligible = options.isEligible ?? isEventEligible;
    const ctx: EventContext = { run, node, ranch };

    const seen = seenEventIds(run);
    const driverSpent = grantSpent(run, 'driver');
    const patchSpent = grantSpent(run, 'patch');
    const rollable = new Set(weightsFor(node).map(([rarity]) => rarity));

    const candidates = catalogue.filter((event) => (
        built.has(event.id)
        && rollable.has(event.rarity)
        && !seen.has(event.id)
        && !(driverSpent && event.grants.includes('driver'))
        && !(patchSpent && event.grants.includes('patch'))
        && eligible(event.id, ctx)
    ));
    if (candidates.length === 0) return null;

    const stream = new SeedStream(nodeSeed(run, node, 'event'));
    const weights = weightsFor(node);
    const total = weights.reduce((sum, [, weight]) => sum + weight, 0);
    let roll = stream.next() * total;
    let rolled: EventRarity = weights[weights.length - 1][0];
    for (const [rarity, weight] of weights) {
        if (roll < weight) { rolled = rarity; break; }
        roll -= weight;
    }

    for (const rarity of fallbackOrder(rolled)) {
        const pool = candidates.filter((event) => event.rarity === rarity);
        if (pool.length > 0) return pool[stream.nextInt(0, pool.length - 1)];
    }
    return null;
}
