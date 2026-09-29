/**
 * TICKET 168a — which choice the balance walker takes at an event: the FIRST one whose outcomes are
 * all free, else Leave.
 *
 * "Free" means no scrap price. Everything a later row adds that costs something (a fight, a card
 * given up, a gamble) is refused by the same test, so the walker only ever takes what a player
 * would take without thinking. It measures what events GIVE, not how well anyone plays them.
 */

import { choiceScrapCost } from '../../engine/run/events/eventSchema';
import { playableChoices } from '../../engine/run/events/eventChoices';
import type { EventChoice, EventDefinition } from '../../engine/run/events/eventSchema';

/** A choice costs nothing to take: no scrap price, and it does something (Leave is the fallback). */
export function isFreeChoice(choice: EventChoice): boolean {
    return choice.outcomes.length > 0 && choiceScrapCost(choice) === 0;
}

export function chooseEventChoice(event: EventDefinition): EventChoice {
    const choices = playableChoices(event);
    return choices.find(isFreeChoice) ?? choices.find((choice) => choice.id === 'leave') ?? choices[0];
}
