/**
 * TICKET 196a — WHAT A NAME IN THE TALLIES IS: a card's element, kind and cost, or a Draught.
 *
 * The report's tallies hold the game's own names (`cardName`, `macroName`), so this reads them back against the
 * registries. A card's kind is its category in the game's words (Attack, Skill, Aura); a Draught has no element
 * or cost. A name the registries do not know (an old night's card that has since been renamed) comes back blank.
 *
 * One name is both a card and a Draught (Mend, on 2026-10-09). The night's facts say which shelf an offer was on
 * (`draughtOffers`); `isDraughtOnly` is for facts read before they did.
 */
import { GetProgramData, ProgramRegistry } from '../../../engine/data/programRegistry';
import { MacroRegistry } from '../../../engine/data/macroRegistry';
import { numericBaseCost } from '../../../engine/types';
import { cardName, macroName } from '../gameText';
import { plain } from '../../../ui/labels/labels';

export interface ItemMeta {
    readonly element: string;
    readonly kind: string;
    readonly cost: number | '';
}

export const DRAUGHT_KIND = 'Draught';
export const DRAUGHT_META: ItemMeta = { element: '', kind: DRAUGHT_KIND, cost: '' };
const UNKNOWN: ItemMeta = { element: '', kind: '', cost: '' };

let cards: Map<string, ItemMeta> | null = null;
let draughts: Set<string> | null = null;

function cardsByName(): Map<string, ItemMeta> {
    cards ??= new Map(Object.keys(ProgramRegistry).map((id) => {
        const data = GetProgramData(id);
        return [cardName(id), { element: data.element ?? '', kind: plain(data.category ?? ''), cost: numericBaseCost(data.baseCost) }] as const;
    }));
    return cards;
}

/** A card's element, kind and cost, by the name the game prints. */
export const cardMeta = (name: string): ItemMeta => cardsByName().get(name) ?? UNKNOWN;

/** A name that only a Draught has: no card is called it. */
export function isDraughtOnly(name: string): boolean {
    draughts ??= new Set(Object.keys(MacroRegistry).map((id) => macroName(id)));
    return draughts.has(name) && !cardsByName().has(name);
}
