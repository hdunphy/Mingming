import type { ReactNode } from 'react';

import { GetMingmingData } from '../../engine/data/mingmingRegistry';
import type { IRanchMember } from '../../engine/runTypes';
import { colorFor } from './runShell';

/**
 * TICKET 182a — the party as a row of faces in a corner of the map screen.
 *
 * It replaces the "Party" section that sat below the map (and below the fold): always visible, no HP
 * (HP is restored every fight), and the name is on hover. Until the art arrives (ticket 183) a face
 * is the species' initial in a ring of its element's colour.
 */
export default function PartyFaces({ members }: { readonly members: ReadonlyArray<IRanchMember> }): ReactNode {
    return (
        <div className="run-party-faces" role="list" aria-label="Your party">
            {members.map((member) => {
                const species = GetMingmingData(member.definitionId);
                const name = member.nickname ?? species.name;
                return (
                    <span
                        key={member.id}
                        role="listitem"
                        className="run-party-face"
                        title={name}
                        style={{ borderColor: colorFor(species.primaryElement) }}
                    >
                        {name.charAt(0).toUpperCase()}
                    </span>
                );
            })}
        </div>
    );
}
