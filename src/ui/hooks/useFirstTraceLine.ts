import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { FIRST_TRACE_LINE, traceHintDue } from '../hints/firstTraceHint';
import { markTraceHintShown } from '../store/gameSlice';
import type { RootState } from '../store/store';

/**
 * TICKET 195b — the line a screen prints under a Trace it has just paid, or `null`.
 *
 * Pass `gained`: true once this screen has granted the player a Trace. The first time that is true on a
 * save that has not shown the line, this returns it and marks the save, and it keeps returning it for as
 * long as the screen stays mounted (the mark does not take the line away from the screen that earned it).
 * Every later screen, and every later Trace, gets `null`.
 */
export function useFirstTraceLine(gained: boolean): string | null {
    const dispatch = useDispatch();
    // A screen test may mount without the ranch slice; nothing has been shown there.
    const due = useSelector((state: RootState) => traceHintDue(state.game ?? {}));
    const [line, setLine] = useState<string | null>(null);

    // Settled while rendering, not in an effect, so the line is on the very frame the Trace is.
    if (line === null && gained && due) setLine(FIRST_TRACE_LINE);

    useEffect(() => {
        if (line !== null) dispatch(markTraceHintShown());
    }, [line, dispatch]);

    return line;
}
