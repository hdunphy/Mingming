import type { ReactElement } from 'react';

import { monsterArtShown } from './monsterArtShown';

/**
 * A species' picture for the starter card's art slot: the sprite when its art may be drawn
 * (`monsterArtShown`), nothing otherwise, so the slot keeps its hatch for the species that have no
 * commissioned art yet.
 */
export function StarterArt({ artReference, name }: {
    readonly artReference: string | undefined;
    readonly name: string;
}): ReactElement | null {
    if (!monsterArtShown(artReference)) return null;
    return (
        <img
            className="starter-art"
            src={new URL(`../../assets/battleArt/mingming/${artReference}`, import.meta.url).href}
            alt={name}
            draggable={false}
        />
    );
}
