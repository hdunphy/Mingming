import React, { useMemo } from 'react';

import type { ProgramEntity } from '../../engine/types';
import PileViewer from './PileViewer';
import { drawPileRows } from './drawPile';

/**
 * TICKET 184a — the draw pile, clickable. Henry, 2026-10-01: *"You need to be able to see the draw
 * cards like discard cards."*
 *
 * Sorted and stacked, NOT in draw order (ruled 2026-10-01; see `drawPile.ts`). The list hangs from
 * the pile's LEFT edge, because the draw pile sits at the left of the console.
 */
interface Props {
    readonly drawpile: ReadonlyArray<ProgramEntity>;
    /** The pile's hover text — the draw formula the hand already shows there. */
    readonly toggleTitle: string;
    /** The pile face and its count, rendered by the hand exactly as before — this only wraps it. */
    readonly children: React.ReactNode;
}

const DrawPileViewer: React.FC<Props> = ({ drawpile, toggleTitle, children }) => {
    const rows = useMemo(() => drawPileRows(drawpile), [drawpile]);
    return (
        <PileViewer
            title="DRAW"
            rows={rows}
            emptyText="Empty. Your discard shuffles back in on the next draw."
            listId="draw-pile-list"
            toggleTitle={toggleTitle}
            align="left"
        >
            {children}
        </PileViewer>
    );
};

export default DrawPileViewer;
