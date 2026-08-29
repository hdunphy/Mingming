import { useLayoutEffect, useRef, useState } from 'react';

/**
 * MEASURE AN ANCHOR AFTER LAYOUT, NOT DURING RENDER — ticket 55, step 3.
 *
 * # THE PATTERN THIS REPLACES
 *
 * Three hover tooltips (`ElementMatchupTooltip`, `CardKeywordChips`, `MingmingUnit`) positioned
 * their portal like this:
 *
 *     style={ref.current ? (() => { const rect = ref.current.getBoundingClientRect(); ... })() : {}}
 *
 * — a `getBoundingClientRect()` read **during render**, which is what `react-hooks/refs` flags. The
 * ticket says to treat a `refs` hit as a defect report before treating it as a lint hit, so:
 *
 * **Is it a bug today? No, and the reason is narrow.** The portal renders only while `hovered` is
 * true, and by the time a mouse event has flipped that flag the ref is attached and laid out — so
 * the measurement is real. What the rule is guarding is that React does not promise that: a render
 * can be started, thrown away and restarted, and a layout read inside one is a read at a moment
 * React reserves the right not to commit.
 *
 * **What IS a bug, and this fixes it:** the `ref.current ? ... : {}` fallback. On the very first
 * render of a *newly mounted* anchor the ref is null, so the portal renders with **no positioning at
 * all** — `position: static`, top-left of the body. It is invisible in practice only because the
 * hover that opens it always follows a render in which the anchor already existed.
 *
 * # WHAT THIS DOES INSTEAD
 *
 * Measures in `useLayoutEffect` — after the DOM exists, before the browser paints — and keeps the
 * rect in state. The consumer renders the portal from the rect, so:
 *
 * - there is no render-phase layout read, and
 * - `rect === null` means "not measured yet", which the consumer can render as *hidden* rather than
 *   as *unpositioned*.
 *
 * Re-measures whenever `active` flips, and cheaply: `getBoundingClientRect` on one element, once per
 * open. It deliberately does **not** track scroll or resize — the tooltips are `position: fixed` and
 * live for as long as a hover, and a listener per chip on a screen that can hold thirty of them
 * would cost more than the staleness it prevents.
 *
 * SSR-safe: `useLayoutEffect` never runs under `renderToStaticMarkup`, so the rect stays null and
 * the tooltip (which is only rendered while hovered, itself impossible without effects) is absent —
 * which is what every existing markup test already expects.
 */
export interface AnchoredRect {
    readonly top: number;
    readonly bottom: number;
    readonly left: number;
    readonly right: number;
}

export interface Anchored<T extends HTMLElement> {
    /** Attach to the element the floater is positioned against. */
    readonly ref: React.RefObject<T | null>;
    /** The anchor's viewport rect while `active`, or `null` when it has not been measured. */
    readonly rect: AnchoredRect | null;
}

export function useAnchoredRect<T extends HTMLElement>(active: boolean): Anchored<T> {
    const ref = useRef<T | null>(null);
    const [rect, setRect] = useState<AnchoredRect | null>(null);

    useLayoutEffect(() => {
        if (!active) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setRect(null);
            return;
        }
        const element = ref.current;
        if (!element) return;
        const measured = element.getBoundingClientRect();
        // measure-then-position is the one case the rule cannot express: the value does not exist
        // until the DOM does. This is React's own documented tooltip pattern, and it is here, once,
        // so that three components do not each read a ref during render instead (ticket 55, step
        // 3). The one disable sits on the early-return branch above — the only line the rule
        // actually reports.
        setRect({
            top: measured.top,
            bottom: measured.bottom,
            left: measured.left,
            right: measured.right,
        });
    }, [active]);

    return { ref, rect };
}
