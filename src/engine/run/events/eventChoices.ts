/**
 * TICKET 168a — which choices of an event can be played yet.
 *
 * The catalogue holds all 20 events with every choice, but a row builds outcome types a few at a
 * time. A choice whose outcomes are not all built is left off the screen, so a player is never
 * handed a button that does nothing: Barrow Gold offered only Take and Leave until 168b built its
 * temporary Drivers, and "Dig deeper" appeared with that row.
 *
 * Each later row adds its outcome types to `BUILT_OUTCOME_TYPES` and nothing else here changes. A
 * gamble is built when every outcome inside both of its branches is.
 */

import type { EventChoice, EventDefinition, EventOutcome } from './eventSchema';

export const BUILT_OUTCOME_TYPES: ReadonlySet<EventOutcome['type']> = new Set([
    'SCRAP', 'CARD_PICK', 'MAP_REVEAL', 'TEMP_DRIVER', 'UPGRADE', 'JUNK', 'GAMBLE',
    'BLUEPRINT_PICK', 'MACRO_PICK', 'RECRUIT',
    'GIVE_CARD', 'GIVE_BLUEPRINT', 'TRADE_UP', 'DUPLICATE', 'TRANSFORM', 'DRIVER_PICK', 'PATCH', 'REFLASH', 'FIGHT',
]);

function isOutcomeBuilt(outcome: EventOutcome, built: ReadonlySet<string>): boolean {
    if (!built.has(outcome.type)) return false;
    return outcome.type !== 'GAMBLE'
        || [...outcome.win, ...outcome.lose].every((inner) => built.has(inner.type));
}

/** Whether every outcome of one choice is built. A choice with no outcomes (Leave) always is. */
export function isChoiceBuilt(choice: EventChoice, built: ReadonlySet<string> = BUILT_OUTCOME_TYPES): boolean {
    return choice.outcomes.every((outcome) => isOutcomeBuilt(outcome, built));
}

/** The choices a player is offered, in the order the data lists them. */
export function playableChoices(event: EventDefinition, built: ReadonlySet<string> = BUILT_OUTCOME_TYPES): EventChoice[] {
    return event.choices.filter((choice) => isChoiceBuilt(choice, built));
}
