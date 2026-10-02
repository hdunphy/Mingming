/**
 * TICKET 184a — one row of an opened pile, whichever pile it is.
 *
 * The discard (`discardPile.ts`) and the draw pile (`drawPile.ts`) choose WHICH rows and in WHAT
 * order; how a card reads in a row is the same for both and is decided here once.
 */

import { GetProgramData } from '../../engine/data/programRegistry';
import { numericBaseCost } from '../../engine/types';

export interface PileRow {
    /** React key. An instance id for a played card, a card id for a stacked row. */
    readonly key: string;
    readonly dataId: string;
    readonly name: string;
    readonly description: string;
    readonly element: string;
    readonly cost: number;
    /** Copies this row stands for. Absent means one. */
    readonly count?: number;
    /** A small label after the name, e.g. the discard's "last in". */
    readonly tag?: string;
    /** Outlined, e.g. the discard's newest card. */
    readonly highlight?: boolean;
}

/** How one card reads in a pile row: its printed name, rule text, element and cost. */
export function cardFace(dataId: string): Pick<PileRow, 'dataId' | 'name' | 'description' | 'element' | 'cost'> {
    const data = GetProgramData(dataId);
    return {
        dataId,
        name: data?.name || dataId,
        description: data?.description ?? '',
        element: data?.element ?? 'None',
        cost: data ? numericBaseCost(data.baseCost) : 0,
    };
}
