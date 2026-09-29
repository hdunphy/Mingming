/**
 * TICKET 168a — which choices of an event can be played yet.
 *
 * The catalogue holds all 20 events with every choice, but a row builds outcome types a few at a
 * time. A choice whose outcomes are not all built is left off the screen, so a player is never
 * handed a button that does nothing: Scrap Cache offers only Take and Leave until 168b builds its
 * temporary Drivers, and "Dig deeper" appears with that row.
 *
 * Each later row adds its outcome types to `BUILT_OUTCOME_TYPES` and nothing else here changes.
 */

import type { EventChoice, EventDefinition, EventOutcome } from './eventSchema';

export const BUILT_OUTCOME_TYPES: ReadonlySet<EventOutcome['type']> = new Set(['SCRAP', 'CARD_PICK', 'MAP_REVEAL']);

/** Whether every outcome of one choice is built. A choice with no outcomes (Leave) always is. */
export function isChoiceBuilt(choice: EventChoice, built: ReadonlySet<string> = BUILT_OUTCOME_TYPES): boolean {
    return choice.outcomes.every((outcome) => built.has(outcome.type));
}

/** The choices a player is offered, in the order the data lists them. */
export function playableChoices(event: EventDefinition, built: ReadonlySet<string> = BUILT_OUTCOME_TYPES): EventChoice[] {
    return event.choices.filter((choice) => isChoiceBuilt(choice, built));
}
