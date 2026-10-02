/**
 * TICKET 169i — THE DRAFT: pick your starting cards instead of being dealt them.
 *
 * Shown by `RunStart` when Launch is pressed with Draft Start on, instead of starting the run. The
 * run seed is rolled once by `RunStart` and handed in, so the offers here and the run that follows
 * share it. Each member in party order drafts `DRAFT_PICKS` cards, one pick at a time, from three
 * offers (`draftOffer`); a picked card leaves the pool and the cards passed over stay in it.
 *
 * Nothing is saved. No run exists until the last pick, so Back, or closing the app, throws the
 * whole draft away and there is nothing to resume. What is held here is only the picks so far, and
 * the offer is derived from them, so the screen cannot show an offer its picks do not explain.
 */

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { ProgramRegistry } from '../../engine/data/programRegistry';
import { DRAFT_PICKS, draftOffer, draftPool, takePick } from '../../engine/run/modifiers/draftStart';
import { GetMingmingData } from '../../engine/data/mingmingRegistry';
import { numericBaseCost } from '../../engine/types';
import type { IMingmingState } from '../../engine/types';
import HandCardFace from '../components/HandCardFace';
import { playSfx } from '../audio/AudioEngine';
import { colorFor } from './runShell';

export interface DraftStartProps {
    /** The run's seed, rolled once by the caller. The offers are drawn from it. */
    readonly seed: string;
    readonly party: ReadonlyArray<IMingmingState>;
    /** Called once, after the last member's last pick, with each member's drafted kit by member id. */
    readonly onDone: (kits: Record<string, string[]>) => void;
    /** Throws the draft away. */
    readonly onBack: () => void;
}

/** The draft card tile: the shop's size, so the face reads the same as it does at the stall. */
const TILE = { ['--cw' as string]: '170px', ['--ch' as string]: '216px', ['--ah' as string]: '56px' };

export default function DraftStart({ seed, party, onDone, onBack }: DraftStartProps): ReactNode {
    const [kits, setKits] = useState<Record<string, string[]>>({});

    const memberIndex = party.findIndex((member) => (kits[member.id]?.length ?? 0) < DRAFT_PICKS);
    const member = party[memberIndex];
    const picks = useMemo(() => (member ? kits[member.id] ?? [] : []), [kits, member]);

    // The pool is the member's tuned deck less what it has already taken, so it is derived, not held.
    const remaining = useMemo(
        () => (member ? picks.reduce(takePick, draftPool(member)) : []),
        [member, picks],
    );
    const offer = useMemo(
        () => (member ? draftOffer(seed, memberIndex, picks.length, remaining) : []),
        [seed, member, memberIndex, picks.length, remaining],
    );

    if (!member) return null;

    const pick = (dataId: string): void => {
        const next = { ...kits, [member.id]: [...picks, dataId] };
        playSfx('rewardClaim');
        setKits(next);
        if (party.every((m) => (next[m.id]?.length ?? 0) >= DRAFT_PICKS)) onDone(next);
    };

    return (
        <section className="ranch-section draft-start">
            <div className="ranch-section-head">
                <h2>Draft: {GetMingmingData(member.definitionId).name}, pick {picks.length + 1} of {DRAFT_PICKS}</h2>
                <button type="button" className="ranch-button k-button is-quiet subtle" onClick={() => { playSfx('uiClick'); onBack(); }}>
                    ‹ Back
                </button>
            </div>
            <p className="ranch-note">
                Pick one card of the three. The cards you pass over stay in the pile. Your starting deck is the
                cards you pick, plus the generic hits.
            </p>

            <div className="draft-offer" style={TILE}>
                {offer.map((dataId, index) => {
                    const data = ProgramRegistry[dataId];
                    return (
                        <div
                            key={`${dataId}:${index}`}
                            className="draft-card"
                            role="button"
                            tabIndex={0}
                            aria-label={`Pick ${data.name}`}
                            style={{ ['--el' as string]: colorFor(data.element) }}
                            onClick={() => pick(dataId)}
                            onKeyDown={(event) => {
                                if (event.key !== 'Enter' && event.key !== ' ') return;
                                event.preventDefault();
                                pick(dataId);
                            }}
                        >
                            <HandCardFace data={data} displayCost={numericBaseCost(data.baseCost)} />
                        </div>
                    );
                })}
            </div>

            <h3 className="draft-picked-title">Picked so far</h3>
            <ul className="draft-picked">
                {picks.map((dataId, index) => (
                    <li key={`${dataId}:${index}`}>{ProgramRegistry[dataId].name}</li>
                ))}
            </ul>
        </section>
    );
}
