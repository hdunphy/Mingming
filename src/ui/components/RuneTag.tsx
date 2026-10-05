/**
 * THE RUNE TAG — ticket 194p.
 *
 * Henry: *"I can't see the runes anywhere in the map/shop/roster/loadout/gym prep screen, so I can't
 * tell what I already have."* A rune showed only as a letter on the in-battle Instinct chip. This is the
 * one small tag every other screen draws: the rune's name (or its letter where a row is tight), with
 * what it does on THIS Instinct as its tooltip. No screen writes the line itself.
 *
 * It draws nothing for a body that holds no rune.
 */
import type { ReactNode } from 'react';

import { getPatch } from '../../engine/data/patchRegistry';
import { describePatchOn } from '../../engine/data/patchText';
import { plain } from '../labels/labels';
import './RuneTag.css';

export interface RuneTagProps {
    /** The rune ids the body holds (`IRunState.patches[memberId]`); none draws nothing. */
    readonly patchIds: ReadonlyArray<string> | undefined;
    /** The Instinct the body runs, so the tooltip says what the rune does on it. */
    readonly osId?: string;
    /** Just the first letter, for a row with no room for the name. */
    readonly compact?: boolean;
}

export function RuneTag({ patchIds, osId, compact = false }: RuneTagProps): ReactNode {
    if (!patchIds || patchIds.length === 0) return null;
    return (
        <>
            {patchIds.map((id) => {
                const name = plain(getPatch(id)?.name ?? id);
                const line = plain(describePatchOn(osId, id));
                return (
                    <span
                        key={id}
                        className={compact ? 'rune-tag compact' : 'rune-tag'}
                        data-rune={id}
                        title={`${name} rune - ${line}`}
                        aria-label={`${name} rune: ${line}`}
                    >
                        {compact ? name.charAt(0) : name}
                    </span>
                );
            })}
        </>
    );
}
