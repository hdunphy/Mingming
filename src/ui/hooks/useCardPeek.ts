/**
 * Ticket 165a — Card Peek hook for row lists.
 *
 * Henry, 2026-09-26: *"From the screenshot I need to be able to see the full card on hover.
 * For the upgrades it should show what my upgraded card looks like."*
 */
import { useState } from 'react';
import type { Banner, CardFace } from '../screens/runShell';

export interface CardPeekTarget {
    readonly face: CardFace | {
        readonly name: string;
        readonly description: string;
        readonly element: string;
        readonly cost: number;
        readonly banner: Banner;
        readonly dataId?: string;
    };
    readonly count?: number;
    readonly tags?: string;
}

export function useCardPeek() {
    const [peek, setPeek] = useState<CardPeekTarget | null>(null);

    const peekHandlers = (target: CardPeekTarget) => ({
        onMouseOver: () => setPeek(target),
        onFocus: () => setPeek(target),
        onMouseOut: (e: React.MouseEvent<HTMLElement>) => {
            const to = e.relatedTarget as Node | null;
            if (to && e.currentTarget.contains(to)) return;
            setPeek(null);
        },
        onBlur: (e: React.FocusEvent<HTMLElement>) => {
            const to = e.relatedTarget as Node | null;
            if (to && e.currentTarget.contains(to)) return;
            setPeek(null);
        },
    });

    return { peek, setPeek, peekHandlers };
}
