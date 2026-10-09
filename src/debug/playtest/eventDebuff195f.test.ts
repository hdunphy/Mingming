/**
 * TICKET 195f — the playtest tool's event screen says what a next-fight debuff does, the sentence the game prints.
 */
import { describe, expect, it } from 'vitest';

import { describeDriver } from '../../engine/data/driverRegistry';
import { EVENTS } from '../../engine/run/events/eventCatalogue';
import { plain } from '../../ui/labels/labels';
import { visitKeyOf } from './event/arrival';
import { currentScreen } from './screen';
import { eaStarters } from '../balance/runWalker';
import { freshWorld } from './testKit';
import { standAt } from './walkKit';
import { hereNode } from './stalls';

function eventBody(eventId: string): string {
    const world = freshWorld({ seed: `debuff-${eventId}`, starter: eaStarters()[0] });
    standAt(world, 'event');
    const node = hereNode(world);
    const event = EVENTS.find((e) => e.id === eventId)!;
    world.view.event = { visitKey: visitKeyOf(node), event, choiceId: null, outcomeIndex: 0, picks: {}, selected: [], upgrading: false };
    return currentScreen(world).body.join('\n');
}

describe('195f — the tool\'s event screen', () => {
    it.each([['scrap_cache', 'driver_static_haze', 'Barrow Mist'], ['corrupted_stream', 'driver_frayed_signal', 'Gjöll Chill']])(
        '%s: the option says what %s does',
        (eventId, driverId, name) => {
            const body = eventBody(eventId);
            expect(body).toContain(`${name} next fight:`);
            expect(body).toContain(plain(describeDriver(driverId).description));
        },
    );
});
