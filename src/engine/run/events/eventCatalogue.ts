/** TICKET 168a — the twenty events, parsed once at load. See `eventSchema.ts`. */

import raw from '../../data/events.json';
import { parseEvents } from './eventSchema';
import type { EventDefinition } from './eventSchema';

export const EVENTS: ReadonlyArray<EventDefinition> = parseEvents(raw);

export function getEvent(id: string): EventDefinition | undefined {
    return EVENTS.find((event) => event.id === id);
}
