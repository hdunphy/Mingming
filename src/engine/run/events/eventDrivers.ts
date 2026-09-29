/**
 * TICKET 168e — the Drivers the Driver Shrine offers: `count` player Drivers the run does not hold,
 * seeded from the node. Temporary Drivers (168b) are not in `playerDriverOptions`, so a run can
 * never be offered one here.
 */

import { playerDriverOptions } from '../../data/driverRegistry';
import { SeedStream } from '../../core/SeedStream';
import { nodeSeed } from '../nodeSeed';
import type { EventContext } from './eventContext';

export function offerDrivers(ctx: EventContext, count: number, slot: string): string[] {
    const stream = new SeedStream(new SeedStream(nodeSeed(ctx.run, ctx.node, 'event-drivers')).fork(slot));
    const open = playerDriverOptions().map((option) => option.id).filter((id) => !ctx.run.drivers.includes(id));
    return stream.shuffle(open).slice(0, count);
}
