/**
 * The "SOLD" stamps over the stall (ticket 194o): one per sale in `useSoldStamps`, portalled to the body so
 * the tile's removal and the shelf's overflow never clip them, centred where the tile was and drifting up as
 * they fade (`MarketplaceNode.css`; reduced motion keeps them still).
 */
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

import type { SoldStamp } from './useSoldStamps';

export function SoldStamps({ stamps }: { readonly stamps: ReadonlyArray<SoldStamp> }): ReactNode {
    if (stamps.length === 0) return null;
    return createPortal(
        <>
            {stamps.map((s) => (
                <div
                    key={s.id}
                    className="mk-sold-stamp"
                    role="presentation"
                    style={{ left: (s.rect.left + s.rect.right) / 2, top: (s.rect.top + s.rect.bottom) / 2 }}
                >
                    <span className="mk-sold-word">{s.word}</span>
                    <span className="mk-sold-detail">{s.detail}</span>
                </div>
            ))}
        </>,
        document.body,
    );
}
