/**
 * TICKET 168a — what a node pays when nothing at all is eligible (rule 4): a small fixed salvage.
 *
 * It is NOT one of the twenty events: it is not in `events.json`, it never counts as a seen event,
 * and its history row (`EMPTY_RELAY_ID`) names nothing in the catalogue. It still counts as this
 * node's resolution, so the first-visit rule holds for it too.
 */

export const EMPTY_RELAY_ID = 'empty_relay';
export const EMPTY_RELAY_SCRAP = 15;
export const EMPTY_RELAY_TEXT = `The relay is empty. You salvage ${EMPTY_RELAY_SCRAP} scrap.`;
