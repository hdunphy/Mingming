/**
 * TICKET 168a/168b — which choice the balance walker takes at an event.
 *
 * In order of preference:
 *
 * 1. the FIRST choice that is free (no scrap price) and has no penalty (a temporary Driver, a junk
 *    card, a gamble);
 * 2. Leave;
 * 3. a priced choice the walker can afford (Corrupted Stream's reroute), first one listed;
 * 4. whatever is left, first listed (Push through, with under 25 scrap).
 *
 * A penalty is taken only when nothing else is open. It
 * measures what events GIVE, not how well anyone plays them; every later row that adds something a
 * player would weigh (a fight, a card given up, a gamble) is refused by the same tests.
 */

import { choiceScrapCost } from '../../engine/run/events/eventSchema';
import { playableChoices } from '../../engine/run/events/eventChoices';
import type { EventChoice, EventDefinition } from '../../engine/run/events/eventSchema';

/** Outcomes that are a penalty or a risk, which the walker will not take while anything else is open. */
const PENALTY_TYPES: ReadonlySet<string> = new Set(['TEMP_DRIVER', 'JUNK', 'GAMBLE']);

/** A choice with a penalty in it: a temporary Driver, a junk card, or a gamble that can lose. */
export function hasPenalty(choice: EventChoice): boolean {
    return choice.outcomes.some((outcome) => PENALTY_TYPES.has(outcome.type));
}

/** A choice costs nothing to take and does something (Leave, which does nothing, is separate). */
export function isFreeChoice(choice: EventChoice): boolean {
    return choice.outcomes.length > 0 && choiceScrapCost(choice) === 0 && !hasPenalty(choice);
}

export function chooseEventChoice(event: EventDefinition, scrap = Infinity): EventChoice {
    const choices = playableChoices(event);
    return choices.find(isFreeChoice)
        ?? choices.find((choice) => choice.id === 'leave')
        ?? choices.find((choice) => !hasPenalty(choice) && choiceScrapCost(choice) <= scrap)
        ?? choices[0];
}
