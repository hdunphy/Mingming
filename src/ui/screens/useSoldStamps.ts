/**
 * THE "SOLD" RESPONSE'S STATE — ticket 194o.
 *
 * A sale changed a count, or removed the tile, and nothing else moved: Henry had no sign it went
 * through. A stamp is born where the tile WAS (its rect, read in the click) and is gone `STAMP_MS`
 * later, so it outlives the tile that made it. Timers are cleared on unmount.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import type { AnchoredRect } from '../hooks/useAnchoredRect';

/** How long a stamp lives; the float animation in `MarketplaceNode.css` runs for the same time. */
export const STAMP_MS = 900;

export interface SoldStamp {
    readonly id: number;
    /** What the stamp says: "SOLD" or "REMOVED". */
    readonly word: string;
    /** The amber that changed hands, said under the word ("+5 amber"). */
    readonly detail: string;
    readonly rect: AnchoredRect;
}

export interface SoldStamps {
    readonly stamps: ReadonlyArray<SoldStamp>;
    readonly stamp: (word: string, detail: string, from: Element) => void;
}

export function useSoldStamps(): SoldStamps {
    const [stamps, setStamps] = useState<ReadonlyArray<SoldStamp>>([]);
    const nextId = useRef(0);
    const timers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

    useEffect(() => {
        const live = timers.current;
        return () => { live.forEach(clearTimeout); live.clear(); };
    }, []);

    const stamp = useCallback((word: string, detail: string, from: Element): void => {
        const box = from.getBoundingClientRect();
        const id = nextId.current;
        nextId.current += 1;
        setStamps((prev) => [...prev, { id, word, detail, rect: { top: box.top, bottom: box.bottom, left: box.left, right: box.right } }]);
        const timer = setTimeout(() => {
            timers.current.delete(timer);
            setStamps((prev) => prev.filter((s) => s.id !== id));
        }, STAMP_MS);
        timers.current.add(timer);
    }, []);

    return { stamps, stamp };
}
