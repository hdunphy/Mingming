/**
 * TICKET 168e — the body pick (Black-Market Patch): every unpatched body is listed with the patch it
 * would be fitted (its best one, as the elite offers). The player's decision is which body.
 */

import { useState } from 'react';
import type { ReactNode } from 'react';

import { getOSBehavior } from '../../engine/data/firmwareRegistry';
import { MingmingRegistry } from '../../engine/data/mingmingRegistry';
import { getPatch } from '../../engine/data/patchRegistry';
import { describePatchOn } from '../../engine/data/patchText';
import type { EventContext } from '../../engine/run/events/eventContext';
import { partyMembersOf } from '../../engine/run/events/eventContext';
import { patchOffers } from '../../engine/run/events/eventPatch';
import { playSfx } from '../audio/AudioEngine';
import type { PatchPickResult } from '../events/outcomePicks';

export interface EventPatchPickProps {
    readonly ctx: EventContext;
    readonly onTake: (pick: PatchPickResult) => void;
    readonly onBack: () => void;
}

export default function EventPatchPick({ ctx, onTake, onBack }: EventPatchPickProps): ReactNode {
    const [selected, setSelected] = useState<string | null>(null);
    const members = partyMembersOf(ctx);
    return (
        <>
            <p className="ev-text">Pick a body. It is fitted with its best patch.</p>
            <div className="ev-choices">
                {patchOffers(ctx).map(({ memberId, patchId }) => {
                    const member = members.find((candidate) => candidate.id === memberId);
                    const patch = getPatch(patchId);
                    return (
                        <button
                            key={memberId}
                            type="button"
                            className={`rs-btn ev-choice ${selected === memberId ? 'picked' : ''}`}
                            aria-pressed={selected === memberId}
                            onClick={() => { playSfx('uiClick'); setSelected(memberId); }}
                        >
                            <span className="ev-label">
                                {MingmingRegistry[member?.definitionId ?? '']?.name ?? memberId}
                                {member?.activeOS ? ` · ${getOSBehavior(member.activeOS)?.name ?? member.activeOS}` : ''}
                            </span>
                            <span className="ev-detail">{patch ? `${patch.name}: ${describePatchOn(member?.activeOS, patchId)}` : patchId}</span>
                        </button>
                    );
                })}
            </div>
            <div className="ev-choices ev-row">
                <button type="button" className="rs-btn primary" disabled={selected === null} onClick={() => selected !== null && onTake({ memberId: selected })}>
                    FIT PATCH
                </button>
                <button type="button" className="rs-btn" onClick={() => { playSfx('uiClick'); onBack(); }}>BACK</button>
            </div>
        </>
    );
}
