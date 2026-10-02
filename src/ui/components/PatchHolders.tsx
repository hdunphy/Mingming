import React from 'react';

import type { IBattleEntity } from '../../engine/types';
import { getPatch } from '../../engine/data/patchRegistry';

interface Props {
    /** The party, in party order; the names come from here. */
    readonly winners: ReadonlyArray<IBattleEntity>;
    /** The run's patches, `rosterId -> patchIds` (`IRunState.patches`). */
    readonly heldPatches: Readonly<Record<string, ReadonlyArray<string>>>;
}

/**
 * TICKET 167j — who already runs a patch, one line per body: `Skoll — AMPLIFIER`.
 *
 * Henry, 2026-09-27: *"I need to see which Mingmings already have a patch in the rewards screen."*
 * Since 166e the offer skips bodies that are full, so a body missing from the offer rows is
 * unexplained; this says why, and what each body already has, without opening the run screen.
 *
 * It goes in party order, and a body that is not in the party (or holds nothing) has no line — a
 * roster id means nothing to the player. When nobody holds a patch this draws nothing at all.
 */
export const PatchHolders: React.FC<Props> = ({ winners, heldPatches }) => {
    const holders = winners
        .map((body) => ({ body, ids: heldPatches[body.id] ?? [] }))
        .filter(({ ids }) => ids.length > 0);
    if (holders.length === 0) return null;

    return (
        <div style={{ margin: '-4px 0 10px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {holders.map(({ body, ids }) => (
                <div
                    key={body.id}
                    data-testid="patch-holder"
                    style={{ fontSize: '0.7rem', color: '#c9b37a' }}
                >
                    {body.name} — {ids.map((id) => getPatch(id)?.name ?? id).join(', ')}
                </div>
            ))}
        </div>
    );
};

export default PatchHolders;
