import React, { useEffect, useRef } from 'react';

import { attachDim } from './impact/impactRuntime';

/**
 * TICKET 190g - THE DARK LAYER OVER THE STAGE. Invisible (opacity 0) until a huge hit's wind-up;
 * `impactRuntime` writes its opacity from the battle clock, up to 0.4 x s. It sits above the room and
 * below the bodies (see the ladder at `.battle-stage`), so the bodies stand out in the dark.
 */
export const StageDimLayer: React.FC = () => {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const element = ref.current;
        return element ? attachDim(element) : undefined;
    }, []);
    return <div ref={ref} className="stage-dim" aria-hidden="true" />;
};
