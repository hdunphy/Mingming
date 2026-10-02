import type { ReactNode } from 'react';

import { BUILD_INFO, buildText } from '../buildInfo';

/**
 * TICKET 181a made the build label (a bug report names it); TICKET 182a (R6) keeps it but small, in
 * the bottom-right corner, so it is never the thing a new player reads.
 */
export default function BuildLabel(): ReactNode {
    return (
        <div
            data-testid="build-label"
            style={{ position: 'fixed', right: '10px', bottom: '8px', color: '#333', fontSize: '0.65rem' }}
        >
            {buildText(BUILD_INFO)}
        </div>
    );
}
