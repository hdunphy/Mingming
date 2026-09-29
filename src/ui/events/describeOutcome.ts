/**
 * TICKET 168c — what an event just did, in one line, so the player is told.
 *
 * A gamble that lands on its losing branch, or a choice that mixes a gain with a penalty, would
 * otherwise go straight to "The relay is dark" with nothing said about what happened. This reads
 * the outcomes that were applied (a gamble already resolved to its branch) and lists them.
 */

import { describeDriver } from '../../engine/data/driverRegistry';
import { ProgramRegistry } from '../../engine/data/programRegistry';
import type { EventChoice, EventOutcome } from '../../engine/run/events/eventSchema';
import type { CardPickResult } from './applyOutcome';

function describeOne(
    outcome: EventOutcome,
    index: number,
    scrapBefore: number,
    picks: Readonly<Record<number, CardPickResult>>,
): string | null {
    switch (outcome.type) {
        case 'SCRAP':
            // A price is taken as far as the run could pay it (`applyChoice`), so the line says so.
            return outcome.amount >= 0
                ? `+${outcome.amount} scrap`
                : `-${Math.min(-outcome.amount, scrapBefore)} scrap`;
        case 'JUNK': return 'Corrupted Data added to your deck';
        case 'MAP_REVEAL': return 'This biome is surveyed';
        case 'TEMP_DRIVER': return `${describeDriver(outcome.driverId).name} for the next fight`;
        case 'UPGRADE': return `${outcome.count} cards upgraded`;
        case 'CARD_PICK': {
            const pick = picks[index];
            if (!pick) return null;
            const name = ProgramRegistry[pick.cardId]?.name ?? pick.cardId;
            return `${name} added to your ${pick.toCollection ? 'collection' : 'deck'}`;
        }
        default: return null;
    }
}

/** The lines for a choice whose gambles are already resolved. Empty for Leave. */
export function describeApplied(
    choice: EventChoice,
    scrapBefore: number,
    picks: Readonly<Record<number, CardPickResult>> = {},
): string {
    return choice.outcomes
        .map((outcome, index) => describeOne(outcome, index, scrapBefore, picks))
        .filter((line): line is string => line !== null)
        .join(' · ');
}
