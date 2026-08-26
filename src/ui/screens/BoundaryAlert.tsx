/**
 * THE BIOME-BOUNDARY ALERT — ticket 62's round-1 Option C, kept by Henry.
 *
 * `research/62-editor-proto/editor_C_boundary_alert.html` is the spec: a 700px modal at 290/170
 * over the dimmed map, party column beside a suggested-cards column, IGNORE — CONTINUE against
 * EDIT LOADOUT.
 *
 * # WHY THIS EXISTS AT ALL, AND WHY IT IS AN ALERT RATHER THAN A SCREEN
 *
 * Henry added this surface after the other three (2026-08-25): *"I think after defeating the elite
 * that gates the next biome you should be able to manage your deck and team."* It is the most
 * load-bearing of the four, and the reason is timing rather than convenience — **the biome boundary
 * is the moment the player learns what element they are walking into**. Everywhere else, "remove Rat
 * for the fire biome" is hindsight. Here it is a decision with the information in front of it.
 *
 * It is an ALERT because the ruling says the player may ignore it: *"an alert offers the edit
 * screen; player accepts or ignores."* A screen you must clear is a toll; a modal with a real
 * IGNORE is an offer. The suggested column is advice and nothing about it is enforced.
 *
 * # WHAT IT SUGGESTS, AND WHY IT DOES NOT SUGGEST HARDER
 *
 * The benched members' engines, and nothing cleverer. A recommender that ranked cards against the
 * coming biome would be a second opinion about matchups that the type chart already states, and it
 * would be wrong in exactly the cases a player cares about (a deck built around one payoff). Naming
 * what is *available but not fielded* is the fact the player cannot see from the map, which is the
 * only thing this modal knows that they do not.
 */

import type { ReactNode } from 'react';

import { GetMingmingData } from '../../engine/data/mingmingRegistry';
import { minimumActiveDeck } from '../../engine/run/createRun';
import type { IRanchState, IRunState } from '../../engine/runTypes';
import { playSfx } from '../audio/AudioEngine';
import { cardFace, colorFor, groupByData } from './runShell';
import './runShell.css';
import './BoundaryAlert.css';

/** How many suggested cards the column shows before it stops. The mockup's column holds five. */
export const SUGGESTION_LIMIT = 5;

export interface BoundaryAlertProps {
    readonly run: IRunState;
    readonly ranch: IRanchState;
    /** The biome the player is walking INTO — the whole reason the alert fires here. */
    readonly nextBiomeName: string;
    readonly nextBiomeElements: ReadonlyArray<string>;
    readonly onIgnore: () => void;
    readonly onEdit: () => void;
}

export default function BoundaryAlert({
    run, ranch, nextBiomeName, nextBiomeElements, onIgnore, onEdit,
}: BoundaryAlertProps): ReactNode {
    const bench = run.bench ?? [];
    const collection = run.collection ?? [];
    const floor = minimumActiveDeck(run.partyIds.length);
    const lead = nextBiomeElements[0] ?? 'None';

    const memberOf = (id: string) => ranch.roster.find((m) => m.id === id);

    /**
     * Benched engines, in the collection, in cost order — see the header for why only these.
     *
     * **Stacked by `dataId`, not listed by instance.** Henry's duplicate amendment is *"one tile per
     * unique card, everywhere"*, and this column is the place it matters most rather than least:
     * eleven of the twelve ruled engines contain a duplicate, so an instance list would let one
     * benched member's repeats — `capacitor, capacitor, surge_protection, surge_protection,
     * hydro_blast` is a real engine — fill all five slots and crowd a second benched member out of
     * the column entirely. The five rows are supposed to be five different suggestions.
     */
    const suggested = groupByData(
        collection.filter((card) => card.ownerId !== null && bench.includes(card.ownerId)),
    )
        .map(({ dataId, instances }) => ({ ...cardFace(dataId), n: instances.length }))
        .sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name))
        .slice(0, SUGGESTION_LIMIT);

    const chip = (id: string, benched: boolean): ReactNode => {
        const member = memberOf(id);
        if (!member) return null;
        const data = GetMingmingData(member.definitionId);
        return (
            <div key={id} className={`ba-member ${benched ? 'benched' : ''}`} style={{ ['--el' as string]: colorFor(data.primaryElement) }}>
                <div className="ba-head">
                    <span className="ba-dot">{data.name.charAt(0)}</span>
                    <span className="ba-who">
                        <span className="ba-nm">{member.nickname ?? data.name}</span>
                        <span className="ba-os">{member.activeOS}</span>
                    </span>
                    <span className="ba-en">{data.primaryElement}</span>
                </div>
                {benched && <div className="ba-hint">on the bench — swap in the editor ⇄</div>}
            </div>
        );
    };

    return (
        <div className="ba">
            <div className="ba-scrim" />
            <div className="ba-modal" role="dialog" aria-modal="true" aria-label="Biome boundary">
                <h1>BIOME BOUNDARY — ADJUST YOUR LOADOUT?</h1>
                <p className="ba-sub">
                    The elite is down. <b style={{ color: colorFor(lead) }}>{nextBiomeName}</b> is
                    ahead — wilds here run {nextBiomeElements.join(' / ')} decks. You may edit your
                    party and deck now, or continue as-is.
                </p>

                <div className="ba-row">
                    <div className="ba-col">
                        <h2>PARTY · who is on the field</h2>
                        <div className="ba-cards">
                            {run.partyIds.map((id) => chip(id, false))}
                            {bench.map((id) => chip(id, true))}
                        </div>
                        <p className="ba-hint">
                            {/* The mockup headed this column "quick swap". It is not one: the
                                only two buttons on the modal are the two below, and the swap
                                itself lives in the editor EDIT LOADOUT opens. Naming a swap the
                                modal cannot perform would send the player hunting for a control
                                that is one screen away. */}
                            {bench.length === 0
                                ? 'Nobody benched. A workshop is where the party grows.'
                                : 'EDIT LOADOUT swaps them: the benched engine goes into the deck and the other one comes back.'}
                        </p>
                    </div>

                    <div className="ba-col">
                        <h2>DECK CHANGES · suggested</h2>
                        <div className="ba-cards">
                            {suggested.map((card) => (
                                <div key={card.dataId} className="ba-cardc" style={{ ['--el' as string]: colorFor(card.element) }}>
                                    <span className="ba-cost">{card.cost}</span>
                                    <span className="ba-cnm">{card.name}</span>
                                    {card.n > 1 && <span className="ba-x">×{card.n}</span>}
                                    <span className="ba-tag">benched</span>
                                </div>
                            ))}
                            {suggested.length === 0 && (
                                <p className="ba-hint">
                                    Nothing benched to bring in. The editor still opens on accept —
                                    your collection and the deck floor ({floor}) are both there.
                                </p>
                            )}
                        </div>
                        <p className="ba-hint">Full editor opens on accept.</p>
                    </div>
                </div>

                <div className="ba-actions">
                    <button type="button" className="rs-btn" onClick={() => { playSfx('uiClick'); onIgnore(); }}>
                        IGNORE — CONTINUE
                    </button>
                    <button type="button" className="rs-btn primary" onClick={() => { playSfx('uiClick'); onEdit(); }}>
                        EDIT LOADOUT
                    </button>
                </div>
            </div>
        </div>
    );
}
