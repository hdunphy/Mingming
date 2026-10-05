import type { CSSProperties, ReactNode } from 'react';

import { GetMingmingData } from '../../engine/data/mingmingRegistry';
import type { IRanchMember } from '../../engine/runTypes';
import { RuneTag } from '../components/RuneTag';
import { colorFor } from './runShell';

/**
 * TICKET 182a — the party as a row of faces in a corner of the map screen.
 *
 * It replaces the "Party" section that sat below the map (and below the fold): always visible, no HP
 * (HP is restored every fight), and the name is on hover. Until the art arrives a face is the
 * species' initial on a hexagon in its element's colour.
 *
 * TICKET 194p: a body that holds a rune wears its compact `RuneTag` beside the face (the tooltip names it).
 */
export default function PartyFaces({ members, patches, osOf }: {
    readonly members: ReadonlyArray<IRanchMember>;
    /** The run's runes, `rosterId -> patchIds` (`IRunState.patches`). */
    readonly patches?: Readonly<Record<string, ReadonlyArray<string>>>;
    /** The Instinct a member runs in this run (Firmware Reflash can change it), for the rune's line. */
    readonly osOf?: (member: IRanchMember) => string;
}): ReactNode {
    return (
        <div className="run-party-faces" role="list" aria-label="Your party">
            {members.map((member) => {
                const species = GetMingmingData(member.definitionId);
                const name = member.nickname ?? species.name;
                return (
                    <span key={member.id} role="listitem" className="run-party-slot">
                        <span
                            className="run-party-face"
                            title={name}
                            style={{ ['--el' as string]: colorFor(species.primaryElement) } as CSSProperties}
                        >
                            {name.charAt(0).toUpperCase()}
                        </span>
                        <RuneTag patchIds={patches?.[member.id]} osId={osOf?.(member) ?? member.activeOS} compact />
                    </span>
                );
            })}
        </div>
    );
}
