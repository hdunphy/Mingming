/**
 * TICKET 168d — the recruit (Stray Mingming): the workshop's recruit, free.
 *
 * Lists what the workshop would let the player build: a species whose blueprint the ranch holds,
 * on a firmware `workshopBlockFor` allows (the duplicate clause is species + firmware). The build
 * spends the blueprint and no scrap.
 */

import { useState } from 'react';
import type { ReactNode } from 'react';
import { useSelector } from 'react-redux';

import { getOSBehavior } from '../../engine/data/firmwareRegistry';
import { MingmingRegistry } from '../../engine/data/mingmingRegistry';
import type { IRanchState, IRunState } from '../../engine/runTypes';
import { playSfx } from '../audio/AudioEngine';
import type { RecruitPickResult } from '../events/outcomePicks';
import { recruitOptions } from '../events/recruitOptions';

export interface EventRecruitPickProps {
    readonly run: IRunState;
    readonly onTake: (pick: RecruitPickResult) => void;
    readonly onBack: () => void;
}

export default function EventRecruitPick({ run, onTake, onBack }: EventRecruitPickProps): ReactNode {
    const ranch = useSelector((s: { game: IRanchState }) => s.game);
    const [selected, setSelected] = useState<RecruitPickResult | null>(null);
    const options = recruitOptions(ranch, run);
    return (
        <>
            <p className="ev-text">Pick one Mingming to build. It joins your party, free.</p>
            <div className="ev-choices">
                {options.map((option) => {
                    const on = selected?.speciesId === option.speciesId && selected.osId === option.osId;
                    return (
                        <button
                            key={`${option.speciesId}:${option.osId}`}
                            type="button"
                            className={`rs-btn ev-choice ${on ? 'picked' : ''}`}
                            aria-pressed={on}
                            onClick={() => { playSfx('uiClick'); setSelected(option); }}
                        >
                            <span className="ev-label">{MingmingRegistry[option.speciesId]?.name ?? option.speciesId}</span>
                            <span className="ev-detail">{getOSBehavior(option.osId)?.name ?? option.osId}</span>
                        </button>
                    );
                })}
                {options.length === 0 && <p className="ev-detail">No trace you hold can be built right now.</p>}
            </div>
            <div className="ev-choices ev-row">
                <button type="button" className="rs-btn primary" disabled={selected === null} onClick={() => selected !== null && onTake(selected)}>
                    RECRUIT
                </button>
                <button type="button" className="rs-btn" onClick={() => { playSfx('uiClick'); onBack(); }}>BACK</button>
            </div>
        </>
    );
}
