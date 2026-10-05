/**
 * `useClockedControls` — ticket 189a. The bridge to framer-motion, scoped to a component.
 *
 * `const track = useClockedControls();` then `track(animate(x, 34, { duration: 0.28 }))`: the
 * playback follows the battle clock (speed, freeze, Instant) and is let go of when it finishes or
 * the component unmounts.
 */

import { useCallback, useEffect, useRef } from 'react';

import { battleControls, battleDriver } from './battleClockRuntime';
import type { PlaybackLike } from './ClockedControls';

export function useClockedControls(): (controls: PlaybackLike) => () => void {
    const owned = useRef(new Set<() => void>());

    useEffect(() => {
        const releases = owned.current;
        return () => {
            for (const release of releases) release();
            releases.clear();
        };
    }, []);

    return useCallback((controls: PlaybackLike) => {
        const release = battleControls.track(controls);
        owned.current.add(release);
        // The bridge keeps the loop alive only while it holds something; this is the "holds something".
        battleDriver.wake();
        return () => {
            release();
            owned.current.delete(release);
        };
    }, []);
}
