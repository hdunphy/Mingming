/**
 * THE EVENT NODE — ticket 168a.
 *
 * About one middle node in seven is an `event`. This is the screen it opens: a short text, then one
 * real button per choice. It is built like the stall and the bay (`MarketplaceNode`,
 * `WorkshopNode`): the shared shell, one file, one job.
 *
 * # FIRST VISIT ONLY
 *
 * A node plays its event once. The test is "this node has a resolved event" (`eventResolvedAt`),
 * not `visited === 1`, because walking off an unresolved node and back must give the same event
 * again (the draw is seeded, so it does), while a resolved node stays spent for good. A spent node
 * reads "The relay is dark. Nothing here now." and offers Leave.
 *
 * # NO CLOSE BUTTON
 *
 * An unresolved event has no way out except one of its choices. Nearly every event carries a
 * Leave choice; two (Corrupted Stream, The Toll) deliberately do not, and a close button would
 * turn them into leavable events.
 *
 * # THE DRAW IS FROZEN PER VISIT
 *
 * Applying a choice changes the run (scrap, deck), and the draw reads the run. Re-drawing on every
 * render would swap the event under the player's cursor, so the drawn event is held in a ref keyed
 * by node and visit.
 */

import { useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useDispatch } from 'react-redux';

import { ProgramRegistry } from '../../engine/data/programRegistry';
import { isBiomeRevealed } from '../../engine/data/macroRegistry';
import { eventResolvedAt } from '../../engine/run/events/eventState';
import { drawEvent } from '../../engine/run/events/eventDraw';
import { playableChoices } from '../../engine/run/events/eventChoices';
import { offerCards } from '../../engine/run/events/eventCards';
import { EMPTY_RELAY_ID, EMPTY_RELAY_SCRAP, EMPTY_RELAY_TEXT } from '../../engine/run/events/emptyRelay';
import type { EventContext, EventRanchView } from '../../engine/run/events/eventContext';
import type { EventChoice, EventDefinition } from '../../engine/run/events/eventSchema';
import type { IRegionNode, IRunState } from '../../engine/runTypes';
import type { Rarity } from '../../engine/types';
import { playSfx } from '../audio/AudioEngine';
import { applyChoice, applyEmptyRelay, isInteractiveOutcome } from '../events/applyOutcome';
import type { CardPickResult } from '../events/applyOutcome';
import { Icon } from '../theme/Icon';
import { ElementMark, EnergyPips, TypeMark } from './CardChassis';
import { cardFace, colorFor } from './runShell';
import './runShell.css';
import './EventNode.css';

export interface EventNodeProps {
    readonly run: IRunState;
    readonly node: IRegionNode;
    readonly ranch: EventRanchView;
    readonly biomeName?: string;
    /** Leaves the (spent) node. Only reachable once the event is resolved. */
    readonly onLeave: () => void;
}

/** What the run stands on: a drawn event, or the Empty Relay when nothing was eligible. */
type Drawn = { readonly key: string; readonly event: EventDefinition | null };

/** The card tile size, matching the reward and stall grids. */
const TILE = { ['--cw' as string]: '170px', ['--ch' as string]: '216px', ['--ah' as string]: '56px' };

/** The pick in progress: which choice, which of its interactive outcomes, and what is decided so far. */
interface PickState {
    readonly choice: EventChoice;
    readonly outcomeIndex: number;
    readonly picks: Readonly<Record<number, CardPickResult>>;
}

/** Indices of a choice's outcomes that need the player to pick something. */
function interactiveIndices(choice: EventChoice): number[] {
    return choice.outcomes.flatMap((outcome, index) => (isInteractiveOutcome(outcome) ? [index] : []));
}

export default function EventNode({ run, node, ranch, biomeName, onLeave }: EventNodeProps): ReactNode {
    const dispatch = useDispatch();
    const drawn = useRef<Drawn | null>(null);
    const [pick, setPick] = useState<PickState | null>(null);
    const [selected, setSelected] = useState<string | null>(null);
    const [toCollection, setToCollection] = useState(false);

    const resolved = eventResolvedAt(run, node.id);
    const visitKey = `${node.id}:${node.visited}`;
    const ctx: EventContext = { run, node, ranch };

    if (!resolved && (drawn.current === null || drawn.current.key !== visitKey)) {
        drawn.current = { key: visitKey, event: drawEvent(run, node, ranch) };
    }
    const event = resolved ? null : drawn.current?.event ?? null;

    const pickedOutcome = pick ? pick.choice.outcomes[pick.outcomeIndex] : undefined;
    const offer = useMemo(
        () => (pick && pickedOutcome && pickedOutcome.type === 'CARD_PICK'
            ? offerCards(ctx, { count: pickedOutcome.count, rarities: pickedOutcome.rarities as Rarity[] }, `${pick.choice.id}:${pick.outcomeIndex}`)
            : []),
        // The offer is a function of the node and the pick; the run's other fields cannot change it.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [pick, node.id, node.visited, run.seed],
    );

    const ctxLine = `${(biomeName ?? 'THIS').toUpperCase()} BIOME · ${run.scrap} SCRAP`;

    const shell = (title: string, body: ReactNode, leave?: boolean): ReactNode => (
        <section className="ev rs-frame rs-fixed">
            <div className="rs-top">
                <span className="rs-title">{title}</span>
                <span className="rs-ctx">{ctxLine}</span>
                <span className="rs-spacer" />
                <span className="rs-scrap" aria-label="Scrap held">{run.scrap} <Icon name="scrap" size={12} /></span>
                {leave && (
                    <button type="button" className="rs-btn primary" onClick={() => { playSfx('uiClick'); onLeave(); }}>
                        LEAVE
                    </button>
                )}
            </div>
            <div className="ev-body"><div className="rs-panel ev-panel">{body}</div></div>
        </section>
    );

    // A spent node. The event that was played here is not named: the point is that it is gone.
    if (resolved) {
        return shell('EVENT', <p className="ev-text">The relay is dark. Nothing here now.</p>, true);
    }

    // Nothing was eligible: the Empty Relay, which is not an event and is not remembered as one.
    if (event === null) {
        return shell('EMPTY RELAY', (
            <>
                <p className="ev-text">{EMPTY_RELAY_TEXT}</p>
                <div className="ev-choices">
                    <button
                        type="button"
                        className="rs-btn primary ev-choice"
                        onClick={() => {
                            playSfx('uiClick');
                            applyEmptyRelay(dispatch, { run, node }, EMPTY_RELAY_ID, EMPTY_RELAY_SCRAP);
                        }}
                    >
                        <span className="ev-label">Salvage</span>
                        <span className="ev-detail">+{EMPTY_RELAY_SCRAP} scrap</span>
                    </button>
                </div>
            </>
        ));
    }

    const finish = (choice: EventChoice, picks: Readonly<Record<number, CardPickResult>>): void => {
        playSfx('uiClick');
        applyChoice(dispatch, { run, node }, event, choice, picks);
        setPick(null);
        setSelected(null);
        setToCollection(false);
    };

    const choose = (choice: EventChoice): void => {
        const interactive = interactiveIndices(choice);
        if (interactive.length === 0) { finish(choice, {}); return; }
        playSfx('uiClick');
        setPick({ choice, outcomeIndex: interactive[0], picks: {} });
    };

    // The card pick. Nothing has been dispatched yet: backing out costs nothing.
    if (pick && pickedOutcome && pickedOutcome.type === 'CARD_PICK') {
        const take = (): void => {
            if (selected === null) return;
            const picks = { ...pick.picks, [pick.outcomeIndex]: { cardId: selected, toCollection } };
            const rest = interactiveIndices(pick.choice).filter((index) => index > pick.outcomeIndex);
            if (rest.length === 0) { finish(pick.choice, picks); return; }
            playSfx('uiClick');
            setPick({ ...pick, outcomeIndex: rest[0], picks });
            setSelected(null);
        };
        return shell(event.name.toUpperCase(), (
            <>
                <p className="ev-text">Pick one card.</p>
                <div className="ev-cards" style={TILE}>
                    {offer.map((cardId) => {
                        const face = cardFace(cardId);
                        return (
                            <button
                                key={cardId}
                                type="button"
                                className={`rs-card ${selected === cardId ? 'picked' : ''}`}
                                style={{ ['--el' as string]: colorFor(face.element) }}
                                aria-pressed={selected === cardId}
                                onClick={() => { playSfx('uiClick'); setSelected(cardId); }}
                            >
                                <EnergyPips cost={face.cost} />
                                <TypeMark banner={face.banner} />
                                <span className="rs-art" />
                                <span className="rs-cnm">{face.name}</span>
                                <span className="rs-desc">{face.description}</span>
                                <span className="rs-tags">
                                    <ElementMark element={face.element} />
                                    <span className="rs-tg">{ProgramRegistry[cardId]?.rarity}</span>
                                </span>
                                <span className="rs-elbar" />
                            </button>
                        );
                    })}
                </div>
                <div className="ev-destination" role="group" aria-label="Where the card goes">
                    <button type="button" className="rs-f" aria-pressed={!toCollection} onClick={() => setToCollection(false)}>
                        Add to deck
                    </button>
                    <button type="button" className="rs-f" aria-pressed={toCollection} onClick={() => setToCollection(true)}>
                        Store in collection
                    </button>
                </div>
                <div className="ev-choices ev-row">
                    <button type="button" className="rs-btn primary" disabled={selected === null} onClick={take}>
                        TAKE CARD
                    </button>
                    <button type="button" className="rs-btn" onClick={() => { playSfx('uiClick'); setPick(null); setSelected(null); }}>
                        BACK
                    </button>
                </div>
            </>
        ));
    }

    return shell(event.name.toUpperCase(), (
        <>
            <p className="ev-text">{event.text}</p>
            <div className="ev-choices">
                {playableChoices(event).map((choice) => {
                    const surveyed = choice.outcomes.some((outcome) => outcome.type === 'MAP_REVEAL')
                        && isBiomeRevealed(run, node.biomeIndex);
                    const short = choice.outcomes.some((outcome) => outcome.type === 'SCRAP' && run.scrap + outcome.amount < 0);
                    return (
                        <button
                            key={choice.id}
                            type="button"
                            className="rs-btn ev-choice"
                            disabled={surveyed || short}
                            onClick={() => choose(choice)}
                        >
                            <span className="ev-label">{choice.label}</span>
                            <span className="ev-detail">
                                {surveyed ? 'This biome is already surveyed.' : short ? 'Not enough scrap.' : choice.detail}
                            </span>
                        </button>
                    );
                })}
            </div>
        </>
    ));
}
