/**
 * TICKET 180b — THE MARKET'S CARD SHELF.
 *
 * The stock exactly as the stall rolls it: `rollMarketStock` for the frozen team (171b), with the
 * price on each card, SOLD left in place, and the off-pool tag. One buy move per card that is not
 * sold and is affordable; an unaffordable card is listed with how many scrap it is short and gets
 * no move.
 */
import { isOfferSold, rollMarketStock } from '../../../../engine/run/marketplace';
import { marketPartyFor } from '../../../../engine/run/marketParty';
import { buyMarketCard } from '../../../../ui/store/runSlice';
import { cardLine, cardName } from '../../gameText';
import { dispatchChecked, hereNode, liveRanchParty, ownedCards, priceNote, shortBy } from '../../stalls';
import type { Move, Section, World } from '../../types';
import { runOf } from '../../types';

export function cardShelf(world: World): Section {
    const run = runOf(world);
    const node = hereNode(world);
    const party = marketPartyFor(run, node.id, liveRanchParty(world));
    const stock = rollMarketStock({ run, node, party });
    const owned = ownedCards(world);

    const lines = ['SHELF (cards):'];
    const moves: Move[] = [];
    for (const offer of stock.offers) {
        const sold = isOfferSold(owned, offer);
        const tag = offer.wildcard ? ' [off-pool]' : '';
        lines.push(`  ${cardLine(offer.card.dataId)}${tag} [${sold ? 'SOLD' : priceNote(world, offer.price)}]`);
        if (sold || shortBy(world, offer.price) > 0) continue;
        moves.push({
            key: `market:buy:${offer.card.instanceId}`,
            label: `Buy ${cardName(offer.card.dataId)} (${offer.price} scrap)`,
            about: { verb: 'buy', items: [cardName(offer.card.dataId)] },
            apply: (w) => {
                if (dispatchChecked(w, buyMarketCard({ card: offer.card, price: offer.price }), 'buy')) {
                    w.view.news.push(`Bought ${cardName(offer.card.dataId)} for ${offer.price} scrap.`);
                }
            },
        });
    }
    if (stock.offers.length === 0) lines.push('  (the shelf is bare)');
    return { lines, moves };
}
