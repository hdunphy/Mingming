/**
 * TICKET 168 — why a choice cannot be taken right now, in the words the button prints.
 *
 * `null` means the choice is playable. A button that cannot be pressed says why (the ticket's "greyed
 * with the reason" rule), so this returns the reason and the screen only has to show it. Each outcome
 * type that can be blocked has one small check; a choice is blocked by the first of its outcomes that is.
 */

import { isBiomeRevealed } from '../../engine/data/macroRegistry';
import type { EventContext } from '../../engine/run/events/eventContext';
import { workshopWouldOfferARecruit } from '../../engine/run/events/eventEligibility';
import { offerDrivers } from '../../engine/run/events/eventDrivers';
import { canGive, deckSpare, heldCards } from '../../engine/run/events/eventGive';
import { patchOffers } from '../../engine/run/events/eventPatch';
import { canReflashAny } from '../../engine/run/events/eventReflash';
import { choiceScrapCost } from '../../engine/run/events/eventSchema';
import type { EventChoice, EventOutcome } from '../../engine/run/events/eventSchema';
import { recompileTarget, tradeUpTarget } from '../../engine/run/events/eventTrade';

/** Some held card could be given up AND swapped for something (the Trader and the Seiðr Cauldron). */
function canSwapACard(ctx: EventContext, target: typeof tradeUpTarget): boolean {
    const spare = deckSpare(ctx.run);
    return heldCards(ctx.run).some((row) => (row.pile === 'collection' || spare > 0) && target(ctx, row.card) !== null);
}

function reasonFor(outcome: EventOutcome, ctx: EventContext): string | null {
    const { run, node } = ctx;
    switch (outcome.type) {
        case 'MAP_REVEAL':
            return isBiomeRevealed(run, node.biomeIndex) ? 'This biome is already surveyed.' : null;
        case 'GIVE_CARD':
            return canGive(run, outcome.count, outcome.rarity) ? null : 'Nothing you can give up.';
        case 'TRADE_UP':
            return canSwapACard(ctx, tradeUpTarget) ? null : 'Nothing you can give up.';
        case 'TRANSFORM':
            return canSwapACard(ctx, recompileTarget) ? null : 'Nothing you can give up.';
        case 'DUPLICATE':
            return heldCards(run).length > 0 ? null : 'No card to copy.';
        case 'GIVE_BLUEPRINT':
            return Object.values(ctx.ranch.blueprints).some((count) => count >= 1) ? null : 'No trace to give.';
        case 'PATCH':
            return patchOffers(ctx).length > 0 ? null : 'Every body already has a rune.';
        case 'REFLASH':
            return canReflashAny(ctx) ? null : 'No body can be retrained right now.';
        case 'DRIVER_PICK':
            return offerDrivers(ctx, 1, 'available').length > 0 ? null : 'No Totem to offer.';
        case 'RECRUIT':
            return workshopWouldOfferARecruit(ctx) ? null : 'No trace you hold can be summoned right now.';
        default:
            return null;
    }
}

export function choiceBlockedReason(choice: EventChoice, ctx: EventContext): string | null {
    if (choiceScrapCost(choice) > ctx.run.scrap) return 'Not enough amber.';
    for (const outcome of choice.outcomes) {
        const reason = reasonFor(outcome, ctx);
        if (reason !== null) return reason;
    }
    return null;
}
