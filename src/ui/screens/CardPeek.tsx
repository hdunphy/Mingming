/**
 * Ticket 165a — Card Peek component.
 *
 * Henry, 2026-09-26: *"From the screenshot I need to be able to see the full card on hover.
 * For the upgrades it should show what my upgraded card looks like."*
 */
import type { ReactNode } from 'react';

import { CardTileFace } from './CardChassis';
import { colorFor } from './runShell';
import type { CardPeekTarget } from '../hooks/useCardPeek';

export function CardPeek({ peek, className }: { readonly peek: CardPeekTarget | null; readonly className?: string }): ReactNode {
    if (!peek) return null;
    return (
        <div
            className={`rs-card card-peek ${className ?? ''}`.trim()}
            style={{ ['--el' as string]: colorFor(peek.face.element) } as React.CSSProperties}
            aria-hidden="true"
        >
            <CardTileFace face={peek.face} count={peek.count} tags={peek.tags} />
        </div>
    );
}
