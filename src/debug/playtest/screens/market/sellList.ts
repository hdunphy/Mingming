/**
 * TICKET 180b — THE MARKET'S SELL LIST AND JUNK REMOVAL.
 *
 * Every card the party holds, deck and collection, one row per unique card and pile. A sale pays
 * `sellPrice`; a junk card is paid to remove (`JUNK_REMOVAL_PRICE`). Selling from the deck stops at
 * the floor (`readDeckFloor`, the stall's own reading), junk removal needs the scrap, and a card
 * that cannot be sold is listed without a move.
 */
import { isJunkCard } from '../../../../engine/run/junk';
import { JUNK_REMOVAL_PRICE, sellPrice } from '../../../../engine/run/marketplace';
import { shopPrice } from '../../../../engine/run/modifiers/shopPrice';
import { readDeckFloor } from '../../../../ui/screens/deckFloor';
import { removeJunkCard, sellRunCard } from '../../../../ui/store/runSlice';
import { cardCost, cardName } from '../../gameText';
import { dispatchChecked, groupByData } from '../../stalls';
import type { Move, Section, World } from '../../types';
import { runOf } from '../../types';

export function sellList(world: World): Section {
    const run = runOf(world);
    const reading = readDeckFloor(run);
    const junkPrice = shopPrice(run, JUNK_REMOVAL_PRICE);

    const piles = [
        { name: 'deck', cards: run.deck, inDeck: true },
        { name: 'collection', cards: run.collection ?? [], inDeck: false },
    ];
    const lines = [`SELL (deck ${reading.counted}, floor ${reading.floor}${reading.atFloor ? ', at the floor: deck sales are shut' : ''}):`];
    const moves: Move[] = [];
    for (const pile of piles) {
        for (const { dataId, instances } of groupByData(pile.cards)) {
            const junk = isJunkCard(dataId);
            const price = junk ? junkPrice : sellPrice(dataId);
            const blocked = junk ? run.scrap < price : pile.inDeck && reading.atFloor;
            const copies = instances.length > 1 ? ` x${instances.length}` : '';
            lines.push(`  ${cardName(dataId)} (${cardCost(dataId)}e, ${pile.name})${copies} ${junk ? `remove for ${price}` : `sells for ${price}`}${blocked ? ' [no]' : ''}`);
            if (blocked) continue;
            const instanceId = instances[0].instanceId;
            moves.push({
                key: `market:${junk ? 'junk' : 'sell'}:${instanceId}`,
                label: junk ? `Pay ${price} to remove ${cardName(dataId)} (${pile.name})` : `Sell ${cardName(dataId)} from the ${pile.name} (+${price})`,
                apply: (w) => {
                    const action = junk ? removeJunkCard({ instanceId, price }) : sellRunCard({ instanceId, price });
                    if (dispatchChecked(w, action, junk ? 'remove junk' : 'sell')) {
                        w.view.news.push(junk ? `Removed ${cardName(dataId)}.` : `Sold ${cardName(dataId)} for ${price} amber.`);
                    }
                },
            });
        }
    }
    return { lines, moves };
}
