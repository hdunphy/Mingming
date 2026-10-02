import React, { useMemo } from 'react';

import type { ProgramEntity } from '../../engine/types';
import PileViewer from './PileViewer';
import { discardRows } from './discardPile';

/**
 * The discard pile, clickable — Henry, 2026-09-25: *"You should be able to see your cards when you
 * click on discard if you need to see what the last card did."*
 *
 * Newest first, one row per play (see `discardPile.ts`). The open/close shell is `PileViewer`,
 * shared with the draw pile since ticket 184a; this only says which cards and in what order. The
 * list hangs from the pile's RIGHT edge, because the discard sits at the right of the console.
 */
interface Props {
    readonly discard: ReadonlyArray<ProgramEntity>;
    /** The pile face and its count, rendered by the hand exactly as before — this only wraps it. */
    readonly children: React.ReactNode;
}

const DiscardPileViewer: React.FC<Props> = ({ discard, children }) => {
    const rows = useMemo(() => discardRows(discard), [discard]);
    return (
        <PileViewer
            title="DISCARD"
            rows={rows}
            emptyText="Nothing played yet this shuffle."
            listId="discard-pile-list"
            toggleTitle="See the discard pile"
            align="right"
        >
            {children}
        </PileViewer>
    );
};

export default DiscardPileViewer;
