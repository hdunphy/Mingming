/**
 * TICKET 168d — the blueprints a `BLUEPRINT_PICK` outcome offers (Wild Tracks).
 *
 * Three DIFFERENT species from the ones this run's region fields (`regionSpeciesPool`, the same
 * ground the gym's leader recruits from), seeded from the node so the same node offers the same
 * three on resume.
 */

import { SeedStream } from '../../core/SeedStream';
import { regionSpeciesPool } from '../gauntlet';
import { nodeSeed } from '../nodeSeed';
import type { EventContext } from './eventContext';

export function offerBlueprints(ctx: EventContext, count: number, slot: string): string[] {
    const stream = new SeedStream(new SeedStream(nodeSeed(ctx.run, ctx.node, 'event-blueprints')).fork(slot));
    return stream.shuffle(regionSpeciesPool(ctx.run, ctx.node)).slice(0, count);
}
