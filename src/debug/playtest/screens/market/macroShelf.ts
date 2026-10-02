/**
 * TICKET 180b — THE MARKET'S MACROS AND THE RACK.
 *
 * The rack (`MACRO_SLOTS` slots) and the two macros on offer. A macro already in the rack is SOLD, a
 * full rack is refused with the reason (`macroOfferBlockFor`), and an unaffordable one is "N short".
 */
import { getMacro, macroOfferBlockFor } from '../../../../engine/data/macroRegistry';
import { rollMacroStock } from '../../../../engine/run/marketplace';
import { marketPartyFor } from '../../../../engine/run/marketParty';
import { MACRO_SLOTS } from '../../../../engine/runTypes';
import { buyMacro } from '../../../../ui/store/runSlice';
import { macroLine, macroName } from '../../gameText';
import { dispatchChecked, hereNode, liveRanchParty, priceNote, shortBy } from '../../stalls';
import type { Move, Section, World } from '../../types';
import { runOf } from '../../types';

export function macroShelf(world: World): Section {
    const run = runOf(world);
    const node = hereNode(world);
    const party = marketPartyFor(run, node.id, liveRanchParty(world));
    const offers = rollMacroStock({ run, node, party });
    const free = run.macros.filter((slot) => slot === null).length;

    const lines = [`MACROS (single use, fires free; rack ${MACRO_SLOTS - free}/${MACRO_SLOTS} full):`];
    lines.push(`  rack: ${run.macros.map((id) => macroName(id)).join(' | ')}`);
    const moves: Move[] = [];
    for (const offer of offers) {
        const block = macroOfferBlockFor(run.macros, offer.macroId);
        const rare = getMacro(offer.macroId)?.rarity === 'Rare' ? ' [rare]' : '';
        const state = block === 'already-held' ? 'SOLD' : block === 'rack-full' ? 'RACK FULL' : priceNote(world, offer.price);
        lines.push(`  ${macroLine(offer.macroId)}${rare} [${state}]`);
        if (block !== null || shortBy(world, offer.price) > 0) continue;
        moves.push({
            key: `market:macro:${offer.macroId}`,
            label: `Buy the macro ${macroName(offer.macroId)} (${offer.price} scrap)`,
            about: { verb: 'buy', items: [macroName(offer.macroId)] },
            apply: (w) => {
                if (dispatchChecked(w, buyMacro({ macroId: offer.macroId, price: offer.price }), 'buy macro')) {
                    w.view.news.push(`Bought the macro ${macroName(offer.macroId)}.`);
                }
            },
        });
    }
    if (offers.length === 0) lines.push('  (no macros this visit)');
    return { lines, moves };
}
