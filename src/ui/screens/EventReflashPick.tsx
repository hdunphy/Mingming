/**
 * TICKET 168f — the body pick (Firmware Reflash): every party body is listed with the OS it would be
 * switched to. A body that cannot be reflashed is greyed with the reason (a fitted patch, a party
 * that already runs that build). The switch lasts for this run; the deck does not change.
 */

import { useState } from 'react';
import type { ReactNode } from 'react';

import { getOSBehavior } from '../../engine/data/firmwareRegistry';
import { MingmingRegistry } from '../../engine/data/mingmingRegistry';
import type { EventContext } from '../../engine/run/events/eventContext';
import { REFLASH_BLOCK_REASON, reflashRows } from '../../engine/run/events/eventReflash';
import { playSfx } from '../audio/AudioEngine';
import type { ReflashPickResult } from '../events/outcomePicks';

export interface EventReflashPickProps {
    readonly ctx: EventContext;
    readonly onTake: (pick: ReflashPickResult) => void;
    readonly onBack: () => void;
}

const osName = (osId: string | null | undefined): string => (osId ? getOSBehavior(osId)?.name ?? osId : 'none');

export default function EventReflashPick({ ctx, onTake, onBack }: EventReflashPickProps): ReactNode {
    const [selected, setSelected] = useState<string | null>(null);
    return (
        <>
            <p className="ev-text">Pick a body. Its OS changes for the rest of this run; its cards don&apos;t.</p>
            <div className="ev-choices">
                {reflashRows(ctx).map((row) => (
                    <button
                        key={row.memberId}
                        type="button"
                        className={`rs-btn ev-choice ${selected === row.memberId ? 'picked' : ''}`}
                        aria-pressed={selected === row.memberId}
                        disabled={row.blocked !== null}
                        onClick={() => { playSfx('uiClick'); setSelected(row.memberId); }}
                    >
                        <span className="ev-label">{MingmingRegistry[row.definitionId]?.name ?? row.memberId}</span>
                        <span className="ev-detail">
                            {row.blocked !== null
                                ? `${osName(row.fromOS)} — ${REFLASH_BLOCK_REASON[row.blocked]}`
                                : `${osName(row.fromOS)} → ${osName(row.toOS)}`}
                        </span>
                    </button>
                ))}
            </div>
            <div className="ev-choices ev-row">
                <button
                    type="button"
                    className="rs-btn primary"
                    disabled={selected === null}
                    onClick={() => selected !== null && onTake({ reflashMemberId: selected })}
                >
                    REFLASH
                </button>
                <button type="button" className="rs-btn" onClick={() => { playSfx('uiClick'); onBack(); }}>BACK</button>
            </div>
        </>
    );
}
