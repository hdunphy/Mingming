/**
 * THE RUN-SCREEN SHELL, in TypeScript — the facts `runShell.css` styles.
 *
 * Three screens (`LoadoutEditor`, `MarketplaceNode`, `WorkshopNode`) and one modal (`BoundaryAlert`)
 * draw the same card tile, the same 27px row and the same roster chip, and each of them needs the
 * same three answers to do it: what colour is this element, which of the three banners does this
 * category wear, and which instances are the same card. Those answers were about to exist in four
 * copies. They exist here instead.
 *
 * # THE ELEMENT PALETTE IS THE MOCKUPS', NOT `contrastText.getElementAccent`'S
 *
 * They are the same hues at different saturations — the accent helper returns `#ff3333` where the
 * mockups ask for `#e05d43`. These screens take the mockups, because that is what ticket 62/63/65
 * ruled and because these values are borders, bars and gem fills rather than body text.
 *
 * **Flagged for ticket 38 (accessibility): the game now has two element palettes**, and they should
 * be reconciled on purpose rather than by whichever file someone edits next. This is the one place
 * the second palette lives, so that reconciliation is a single edit when it comes.
 */

import { ProgramRegistry } from '../../engine/data/programRegistry';
import { GetMingmingData } from '../../engine/data/mingmingRegistry';
import { numericBaseCost } from '../../engine/types';
import type { ProgramCategory } from '../../engine/types';
import type { IRanchMember, IRunCard } from '../../engine/runTypes';

export const ELEMENT_COLOR: Readonly<Record<string, string>> = {
    Fire: '#e05d43',
    Water: '#3d9be0',
    Nature: '#43b45f',
    Earth: '#b08040',
    Air: '#8fc7f5',
    Ice: '#7fd6ff',
    Light: '#e8d27a',
    Dark: '#9a6fd0',
    None: '#9aa3ad',
};

export const colorFor = (element: string): string => ELEMENT_COLOR[element] ?? ELEMENT_COLOR.None;

/**
 * The mockups' three banners. `Status` and `Heal` read as SKILL — a heal is a skill you cast, and a
 * fourth colour for a category the player never names would be three shades of the same idea.
 */
export type Banner = 'ATTACK' | 'SKILL' | 'DAEMON';

export function bannerFor(category: ProgramCategory | undefined): Banner {
    if (category === 'Attack') return 'ATTACK';
    if (category === 'Daemon') return 'DAEMON';
    return 'SKILL';
}

/** Everything a tile or a row prints about a card, before anything about who owns it. */
export interface CardFace {
    readonly dataId: string;
    readonly name: string;
    readonly description: string;
    readonly element: string;
    readonly cost: number;
    readonly banner: Banner;
}

/**
 * The card, as the shop and the book print it — **description included.**
 *
 * That clause used to be its opposite (`MarketplaceNode`'s old header: *"the offer rows print name,
 * element, rarity and energy cost and NOT the card's description"*, because 142 of 216 descriptions
 * quote the internal power number). Henry reversed it twice: *"I think we need power in the card
 * descriptions otherwise you can't compare cards in the deck builder"*, then, after the 2026-08-24
 * playtest, *"I don't like the marketplace UI. You can't see the card descriptions."* Power dies at
 * the surface still holds for the FIGHT, where a preview must show true numbers rather than printed
 * ones. A shop and a collection are comparison screens, and the card text is the comparison.
 */
export function cardFace(dataId: string): CardFace {
    const data = ProgramRegistry[dataId];
    return {
        dataId,
        name: data?.name ?? dataId,
        description: data?.description ?? '',
        element: data?.element ?? 'None',
        cost: numericBaseCost(data?.baseCost ?? 0),
        banner: bannerFor(data?.category),
    };
}

/**
 * Group instances into one entry per unique `dataId` — Henry's duplicate amendment, *"one tile per
 * unique card, everywhere"*, applied at RENDER because the run must keep instances: a sale, a move
 * and the departure bookkeeping all key on `instanceId`.
 *
 * Insertion-ordered, so a caller that wants a different order sorts and a caller that does not gets
 * the pile's own order rather than a hash order that changes when a name does.
 */
export function groupByData<T extends { readonly dataId: string }>(
    cards: ReadonlyArray<T>,
): Array<{ readonly dataId: string; readonly instances: T[] }> {
    const byData = new Map<string, T[]>();
    for (const card of cards) {
        const held = byData.get(card.dataId);
        if (held) held.push(card);
        else byData.set(card.dataId, [card]);
    }
    return [...byData.entries()].map(([dataId, instances]) => ({ dataId, instances }));
}

/**
 * Is this card the leading (payoff) card of its owner's ruled engine?
 *
 * Ticket 61's table gives every OS a five-card engine whose FIRST entry is the payoff — the card
 * the other four exist to set up. That position is the definition, so this reads the registry
 * rather than carrying a second list that could disagree with it.
 */
export function isPayoff(card: IRunCard, roster: ReadonlyArray<IRanchMember>): boolean {
    if (!card.ownerId) return false;
    const member = roster.find((m) => m.id === card.ownerId);
    if (!member) return false;
    return GetMingmingData(member.definitionId).startKits?.[member.activeOS]?.[0] === card.dataId;
}
