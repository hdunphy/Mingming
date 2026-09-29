/**
 * TICKET 168a/168b — which choice the balance walker takes at an event.
 *
 * In order of preference:
 *
 * 1. the FIRST choice that is free (no scrap price) and has no penalty (a temporary Driver, a junk
 *    card, a gamble) and takes no card or blueprint from the player (168e);
 * 2. Leave;
 * 3. a priced choice the walker can afford (Corrupted Stream's reroute, The Toll's payment), or one
 *    that costs no scrap (The Toll's card), first one listed;
 * 4. whatever is left, first listed (Push through, with under 25 scrap).
 *
 * A penalty is taken only when nothing else is open. It measures what events GIVE, not how well
 * anyone plays them; every later row that adds something a player would weigh (a fight, a card
 * given up, a gamble) is refused by the same tests. So the walker takes a Driver, a patch, a trade,
 * a copy or a recompile NEVER: each of them costs a card, a blueprint or scrap and Leave comes first.
 * The one exception is The Toll, which has no Leave.
 */

import { choiceScrapCost } from '../../engine/run/events/eventSchema';
import { playableChoices } from '../../engine/run/events/eventChoices';
import { deckSpare, heldCards } from '../../engine/run/events/eventGive';
import type { IRunState } from '../../engine/runTypes';
import type { EventChoice, EventDefinition } from '../../engine/run/events/eventSchema';

/** Outcomes that are a penalty or a risk, which the walker will not take while anything else is open. */
const PENALTY_TYPES: ReadonlySet<string> = new Set(['TEMP_DRIVER', 'JUNK', 'GAMBLE']);

/** Outcomes that take a card or a blueprint from the player (168e). The walker counts them as a cost. */
const COST_TYPES: ReadonlySet<string> = new Set(['GIVE_CARD', 'GIVE_BLUEPRINT', 'TRADE_UP', 'TRANSFORM', 'DUPLICATE']);

/** A choice with a penalty in it: a temporary Driver, a junk card, or a gamble that can lose. */
export function hasPenalty(choice: EventChoice): boolean {
    return choice.outcomes.some((outcome) => PENALTY_TYPES.has(outcome.type));
}

/** A choice costs nothing to take and does something (Leave, which does nothing, is separate). */
export function isFreeChoice(choice: EventChoice): boolean {
    return choice.outcomes.length > 0 && choiceScrapCost(choice) === 0 && !hasPenalty(choice)
        && !choice.outcomes.some((outcome) => COST_TYPES.has(outcome.type));
}

/**
 * The cards the walker gives up when an event insists (The Toll): the cheapest first, collection
 * before deck, and deck cards only as far as the floor allows. `score` is the walker's own card
 * value; a card it cannot score is the cheapest of all.
 */
export function chooseGiveUps(
    run: IRunState,
    count: number,
    rarity: string | undefined,
    score: (dataId: string) => number | null,
): string[] {
    const rows = heldCards(run, rarity)
        .map((row) => ({ row, value: score(row.card.dataId) ?? -Infinity }))
        .sort((a, b) => Number(a.row.pile === 'deck') - Number(b.row.pile === 'deck')
            || a.value - b.value || a.row.card.instanceId.localeCompare(b.row.card.instanceId));
    const chosen: string[] = [];
    let fromDeck = 0;
    for (const { row } of rows) {
        if (chosen.length >= count) break;
        if (row.pile === 'deck') {
            if (fromDeck >= deckSpare(run)) continue;
            fromDeck += 1;
        }
        chosen.push(row.card.instanceId);
    }
    return chosen;
}

export function chooseEventChoice(event: EventDefinition, scrap = Infinity): EventChoice {
    const choices = playableChoices(event);
    return choices.find(isFreeChoice)
        ?? choices.find((choice) => choice.id === 'leave')
        ?? choices.find((choice) => !hasPenalty(choice) && choiceScrapCost(choice) <= scrap)
        ?? choices[0];
}
