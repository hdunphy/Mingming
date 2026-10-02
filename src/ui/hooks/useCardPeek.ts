/**
 * Ticket 165a — Card Peek hook for row lists.
 *
 * Henry, 2026-09-26: *"From the screenshot I need to be able to see the full card on hover.
 * For the upgrades it should show what my upgraded card looks like."*
 *
 * TICKET 167f (Henry, 2026-09-27): the peek is a tooltip beside the MOUSE, so the hook now tracks the
 * pointer as well as the row. Hover and mouse-move give the pointer's viewport position; keyboard
 * focus has no pointer, so it anchors to the row's right edge.
 */
import { useEffect, useRef, useState } from 'react';
import type { CardFace } from '../screens/runShell';
import type { PeekPoint } from '../screens/peekPlacement';
import { FrameCoalescer } from './frameCoalescer';

/** What a peek draws: the fields `CardFace` needs, and nothing about who owns the card. */
export type PeekFace = CardFace | {
    readonly name: string;
    readonly description: string;
    readonly element: string;
    readonly cost: number;
    readonly dataId?: string;
};

export interface CardPeekTarget {
    readonly face: PeekFace;
    /**
     * TICKET 183c (D2): the card as it is NOW, for the upgrade preview. When present the peek draws
     * two full cards side by side, now → upgraded, with the changed text lit on the second.
     */
    readonly before?: PeekFace;
    readonly count?: number;
    readonly tags?: string;
}

interface PeekState {
    readonly target: CardPeekTarget;
    readonly at: PeekPoint;
}

export function useCardPeek() {
    const [state, setState] = useState<PeekState | null>(null);
    // One setState per animation frame while the pointer moves; see `FrameCoalescer`.
    const moves = useRef<FrameCoalescer<PeekState> | null>(null);
    if (moves.current === null) moves.current = new FrameCoalescer<PeekState>(setState);
    useEffect(() => () => moves.current?.cancel(), []);

    const peekHandlers = (target: CardPeekTarget) => ({
        onMouseOver: (e: React.MouseEvent<HTMLElement>) => {
            moves.current?.cancel();
            setState({ target, at: { x: e.clientX, y: e.clientY } });
        },
        onMouseMove: (e: React.MouseEvent<HTMLElement>) => {
            moves.current?.push({ target, at: { x: e.clientX, y: e.clientY } });
        },
        onFocus: (e: React.FocusEvent<HTMLElement>) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setState({ target, at: { x: rect.right, y: rect.top } });
        },
        onMouseOut: (e: React.MouseEvent<HTMLElement>) => {
            const to = e.relatedTarget as Node | null;
            if (to && e.currentTarget.contains(to)) return;
            moves.current?.cancel();
            setState(null);
        },
        onBlur: (e: React.FocusEvent<HTMLElement>) => {
            const to = e.relatedTarget as Node | null;
            if (to && e.currentTarget.contains(to)) return;
            setState(null);
        },
    });

    return { peek: state?.target ?? null, at: state?.at ?? null, peekHandlers };
}
