/**
 * TICKET 182c — "A stray Mingming": the intro's guaranteed recruit.
 *
 * It is the ordinary `stray_mingming` event (168d) with its Leave choice taken away, so the second
 * monster is not optional. It is drawn by `introRules(run).eventFor`, not by the weighted draw, so
 * nothing about the intro depends on an event roll.
 */

import { getEvent } from '../events/eventCatalogue';
import type { EventDefinition } from '../events/eventSchema';

export const INTRO_EVENT_ID = 'stray_mingming';

export function introRecruitEvent(): EventDefinition | null {
    const event = getEvent(INTRO_EVENT_ID);
    if (!event) return null;
    return { ...event, choices: event.choices.filter((choice) => choice.id === 'recruit') };
}
