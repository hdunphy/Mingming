/**
 * Ticket 165a — Card Peek component.
 *
 * Henry, 2026-09-26: *"From the screenshot I need to be able to see the full card on hover.
 * For the upgrades it should show what my upgraded card looks like."*
 *
 * TICKET 167f (Henry, 2026-09-27): *"The card should be static so it hovers next to the mouse and
 * it should be outside of any containers. Like a tooltip."* It used to be a block under the list,
 * inside the panel: it grew the panel, the list moved under the mouse, the hover landed on another
 * row, the block changed, and it repeated. Now it is drawn into `document.body` (a portal, like the
 * status tooltips) at a fixed position beside the pointer, and takes no part in any layout.
 *
 * This REVERSES 155h/165a's in-panel block. 155h put the Edit Loadout peek in the panel because a
 * viewport-anchored `position: fixed` missed at every width but 1280; this one is anchored to the
 * MOUSE, so that failure cannot recur.
 */
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { CardTileFace } from './CardChassis';
import { colorFor } from './runShell';
import { PEEK_TILE_H, PEEK_TILE_W, placePeek, type PeekPoint } from './peekPlacement';
import { stageScale } from '../components/stageGeometry';
import type { CardPeekTarget } from '../hooks/useCardPeek';

export interface CardPeekProps {
    readonly peek: CardPeekTarget | null;
    /** The pointer (or focused row) position, viewport pixels. Nothing draws without one. */
    readonly at: PeekPoint | null;
    readonly className?: string;
}

export function CardPeek({ peek, at, className }: CardPeekProps): ReactNode {
    if (!peek || !at) return null;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const scale = stageScale(width, height);
    const { left, top } = placePeek(at, width, height, scale);

    return createPortal(
        <div
            className={`rs-card card-peek ${className ?? ''}`.trim()}
            style={{
                ['--el' as string]: colorFor(peek.face.element),
                ['--cw' as string]: `${PEEK_TILE_W}px`,
                ['--ch' as string]: `${PEEK_TILE_H}px`,
                left,
                top,
                transform: `scale(${scale})`,
                // Also in the stylesheet; inline as well because it is the one property that must hold
                // whatever loads or does not: a tile that takes the hover is the bug this row ends.
                pointerEvents: 'none',
            } as React.CSSProperties}
            aria-hidden="true"
        >
            <CardTileFace face={peek.face} count={peek.count} tags={peek.tags} />
        </div>,
        document.body,
    );
}
