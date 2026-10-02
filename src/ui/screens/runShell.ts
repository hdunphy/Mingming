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
import { plain } from '../labels/labels';

export const ELEMENT_COLOR: Readonly<Record<string, string>> = {
    Fire: '#f25c2a',
    Water: '#2f8fe0',
    Nature: '#4cb04a',
    None: '#8e97a8',
};

export const colorFor = (element: string): string => ELEMENT_COLOR[element] ?? ELEMENT_COLOR.None;

/**
 * The card's TYPE, as ticket 66's chassis prints it — one mark in the top-right corner.
 *
 * `Status` and `Heal` read as SKILL: a heal is a skill you cast, and a fourth colour for a category
 * the player never names would be three shades of the same idea.
 *
 * **`MACRO` is the fourth member and it is not a `ProgramCategory`** — a macro is not a program at
 * all (`data/macroRegistry`), it is a free single-use effect on the rack beside the hand. It is in
 * this union because it shares the tile: the marketplace stocks macros on the same card face, and
 * ticket 66's reference draws it with the same chassis and its own mark (`●`). `bannerFor` cannot
 * return it, and does not — the macro sites pass it directly.
 */
export type Banner = 'ATTACK' | 'SKILL' | 'DAEMON' | 'MACRO';

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
        description: plain(data?.description ?? ''),
        element: data?.element ?? 'None',
        cost: numericBaseCost(data?.baseCost ?? 0),
        banner: bannerFor(data?.category),
    };
}

/**
 * TICKET 163b — **an upgraded card's description, with the numbers that MOVED marked.**
 *
 * §4: *"the tile shows `+` after the name and the changed number in the element colour."* The `+`
 * comes free — a `+` card's registry name already ends in one, so every surface that renders a
 * name shows it without a line of UI. The changed NUMBER does not, and it is the half that answers
 * the question a player actually has at a bench: *what did I just buy?*
 *
 * Derived from the two printings rather than from the card data, and that is the point. The data
 * is where a number lives; the DESCRIPTION is what the player compares, and 163a's whole generator
 * is built on the two agreeing (`descriptionData.test.ts` fails the build when they do not). So
 * diffing the printed sentences highlights exactly what a player would have spotted by reading
 * both, which is the thing being saved them.
 *
 * Positional, not a set difference: "15 power, three times" against "15 power, twice" must mark
 * nothing about the 15. Numbers past the end of the base printing are new and always marked — that
 * is Mend+'s *"and yourself with 10"*, a clause the base does not have.
 *
 * Returns the whole description as segments so a caller can render it in one pass; a card with no
 * base (or no `+`) comes back as one unmarked segment, which renders identically to plain text.
 */
export interface DescriptionSegment {
    readonly text: string;
    readonly changed: boolean;
}

export function describeUpgrade(dataId: string): ReadonlyArray<DescriptionSegment> {
    const data = ProgramRegistry[dataId];
    const text = plain(data?.description ?? '');
    const base = data?.upgradeOf ? plain(ProgramRegistry[data.upgradeOf]?.description) : undefined;
    if (base === undefined) return [{ text, changed: false }];

    const NUM = /\d+(?:\.\d+)?/g;
    const was = base.match(NUM) ?? [];
    const segments: DescriptionSegment[] = [];
    let cursor = 0;
    let ordinal = 0;
    for (const hit of text.matchAll(NUM)) {
        const at = hit.index ?? 0;
        // A number is MARKED when the base printed something else in that slot, or printed
        // nothing there at all.
        const changed = ordinal >= was.length || was[ordinal] !== hit[0];
        if (at > cursor) segments.push({ text: text.slice(cursor, at), changed: false });
        segments.push({ text: hit[0], changed });
        cursor = at + hit[0].length;
        ordinal += 1;
    }
    if (cursor < text.length) segments.push({ text: text.slice(cursor), changed: false });
    return segments.length > 0 ? segments : [{ text, changed: false }];
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
