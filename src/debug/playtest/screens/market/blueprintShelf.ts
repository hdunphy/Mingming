/**
 * TICKET 180b — THE MARKET'S BLUEPRINT OFFER.
 *
 * One body, this route only. Buying is the stall's own two dispatches: the ranch gets the blueprint
 * (`addBlueprint`), then the run records the sale and takes the scrap (`buyMarketBlueprint`).
 */
import { isBlueprintSlotSold, rollBlueprintOffer } from '../../../../engine/run/marketplace';
import { addBlueprint } from '../../../../ui/store/gameSlice';
import { buyMarketBlueprint } from '../../../../ui/store/runSlice';
import { FIRST_TRACE_LINE, noteTraceGained } from '../../firstTrace';
import { speciesName } from '../../gameText';
import { dispatchChecked, hereNode, priceNote, shortBy } from '../../stalls';
import type { Move, Section, World } from '../../types';
import { runOf } from '../../types';

export function blueprintShelf(world: World): Section {
    const run = runOf(world);
    const node = hereNode(world);
    const offer = rollBlueprintOffer(run, node);
    if (!offer) return { lines: [], moves: [] };

    const sold = isBlueprintSlotSold(run, node);
    const lines = ['TRACE (one body, spend it in a Den):', `  ${speciesName(offer.speciesId)} [${sold ? 'SOLD' : priceNote(world, offer.price)}]`];
    const moves: Move[] = [];
    if (!sold && shortBy(world, offer.price) <= 0) {
        moves.push({
            key: 'market:blueprint',
            label: `Buy the ${speciesName(offer.speciesId)} trace (${offer.price} amber)`,
            apply: (w) => {
                w.store.dispatch(addBlueprint(offer.speciesId));
                if (dispatchChecked(w, buyMarketBlueprint({ nodeId: node.id, price: offer.price }), 'buy blueprint')) {
                    w.view.news.push(`Bought the ${speciesName(offer.speciesId)} trace.`);
                    if (noteTraceGained(w)) w.view.news.push(FIRST_TRACE_LINE);
                }
            },
        });
    }
    return { lines, moves };
}
