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
import { useDispatch, useStore } from 'react-redux';

import { ProgramRegistry } from '../../engine/data/programRegistry';
import { resolveGambles } from '../../engine/run/events/eventGamble';
import { hasUpgrade } from '../../engine/data/plusRegistry';
import { eventResolvedAt } from '../../engine/run/events/eventState';
import { drawEvent } from '../../engine/run/events/eventDraw';
import { playableChoices } from '../../engine/run/events/eventChoices';
import { offerCards } from '../../engine/run/events/eventCards';
import { EMPTY_RELAY_ID, EMPTY_RELAY_SCRAP, EMPTY_RELAY_TEXT } from '../../engine/run/events/emptyRelay';
import type { EventContext, EventRanchView } from '../../engine/run/events/eventContext';
import type { EventChoice, EventDefinition } from '../../engine/run/events/eventSchema';
import type { IRanchState, IRegionNode, IRunState } from '../../engine/runTypes';
import type { Rarity } from '../../engine/types';
import { playSfx } from '../audio/AudioEngine';
import { applyChoice, applyEmptyRelay, isInteractiveOutcome } from '../events/applyOutcome';
import { choiceBlockedReason } from '../events/choiceAvailability';
import { describeApplied } from '../events/describeOutcome';
import type { OutcomePick } from '../events/outcomePicks';
import EventPickStep from './EventPickStep';
import { Icon } from '../theme/Icon';
import { CardFace } from './CardChassis';
import { UpgradeBench } from './UpgradeBench';
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
    readonly picks: Readonly<Record<number, OutcomePick>>;
}

/** Indices of a choice's outcomes that need the player to pick something. */
function interactiveIndices(choice: EventChoice): number[] {
    return choice.outcomes.flatMap((outcome, index) => (isInteractiveOutcome(outcome) ? [index] : []));
}

export default function EventNode({ run, node, ranch, biomeName, onLeave }: EventNodeProps): ReactNode {
    const dispatch = useDispatch();
    const store = useStore<{ game: IRanchState }>();
    const drawn = useRef<Drawn | null>(null);
    const [pick, setPick] = useState<PickState | null>(null);
    const [selected, setSelected] = useState<string | null>(null);
    const [toCollection, setToCollection] = useState(false);
    /** The choice whose upgrades the player is making now (Overclock Rig), gambles already resolved. */
    const [upgrading, setUpgrading] = useState<EventChoice | null>(null);
    /** What the last choice did, shown above the dark line so a bad roll is not silent. */
    const [note, setNote] = useState<string>('');

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
        return shell('EVENT', (
            <>
                {/* TICKET 182a: the result note is a line, not a paragraph - the screen's one <p> is the text below. */}
                {note !== '' && <div className="ev-note">{note}</div>}
                <p className="ev-text">The relay is dark. Nothing here now.</p>
            </>
        ), true);
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

    const finish = (choice: EventChoice, picks: Readonly<Record<number, OutcomePick>>): void => {
        playSfx('uiClick');
        // The gamble is settled before anything is read off the choice, so the note describes the
        // branch that was actually applied.
        const played = resolveGambles({ run, node }, choice);
        setNote(describeApplied(played, run.scrap, picks, ctx));
        // The ranch is read at the moment of applying, not at render: a recruit spends a blueprint and
        // checks the roster after, and both have to be the store's own view.
        applyChoice(dispatch, {
            run, node, ranch: store.getState().game,
            rosterHas: (memberId) => store.getState().game.roster.some((member) => member.id === memberId),
        }, event, played, picks);
        setPick(null);
        setUpgrading(null);
        setSelected(null);
        setToCollection(false);
    };

    const choose = (choice: EventChoice): void => {
        // A gamble is rolled here, once, from the node's seed; what follows is its winning or
        // losing branch. Backing out and choosing again lands on the same branch.
        const played = resolveGambles({ run, node }, choice);
        if (played.outcomes.some((outcome) => outcome.type === 'UPGRADE')) {
            playSfx('uiClick');
            setUpgrading(played);
            return;
        }
        const interactive = interactiveIndices(played);
        if (interactive.length === 0) { finish(played, {}); return; }
        playSfx('uiClick');
        setPick({ choice: played, outcomeIndex: interactive[0], picks: {} });
    };

    // The upgrade bench (Overclock Rig): free, and `count` cards, spent as the player clicks. The
    // rest of the choice (its junk) is applied on DONE, after every upgrade is made.
    if (upgrading) {
        const upgrade = upgrading.outcomes.find((outcome) => outcome.type === 'UPGRADE');
        const allowance = upgrade && upgrade.type === 'UPGRADE' ? upgrade.count : 1;
        const benchKey = `event:${node.id}`;
        const used = (run.upgradesTaken ?? []).filter((key) => key === benchKey).length;
        const upgradable = run.deck.filter((card) => hasUpgrade(card.dataId)).length;
        // Done once the allowance is spent, or when nothing is left to upgrade.
        const finished = used >= allowance || upgradable === 0;
        return shell(event.name.toUpperCase(), (
            <>
                <p className="ev-text">Upgrade {allowance} cards. Pick them below.</p>
                <UpgradeBench run={run} benchKey={benchKey} free allowance={allowance} heading="OVERCLOCK" />
                <div className="ev-choices ev-row">
                    <button type="button" className="rs-btn primary" disabled={!finished} onClick={() => finish(upgrading, {})}>
                        DONE
                    </button>
                    <button type="button" className="rs-btn" disabled={used > 0} onClick={() => { playSfx('uiClick'); setUpgrading(null); }}>
                        BACK
                    </button>
                </div>
            </>
        ));
    }

    // Every pick works the same way: nothing has been dispatched yet, so backing out costs nothing,
    // and the answer is recorded against the outcome's index until the last one is in.
    const back = (): void => { playSfx('uiClick'); setPick(null); setSelected(null); };
    const takePick = (answer: OutcomePick): void => {
        if (!pick) return;
        const picks = { ...pick.picks, [pick.outcomeIndex]: answer };
        const rest = interactiveIndices(pick.choice).filter((index) => index > pick.outcomeIndex);
        if (rest.length === 0) { finish(pick.choice, picks); return; }
        playSfx('uiClick');
        setPick({ ...pick, outcomeIndex: rest[0], picks });
        setSelected(null);
    };

    // Every question but the card pick has its own small screen (`EventPickStep`).
    if (pick && pickedOutcome && pickedOutcome.type !== 'CARD_PICK') {
        return shell(event.name.toUpperCase(), (
            <EventPickStep
                key={`${pick.choice.id}:${pick.outcomeIndex}`}
                outcome={pickedOutcome}
                slot={`${pick.choice.id}:${pick.outcomeIndex}`}
                ctx={ctx}
                run={run}
                onTake={takePick}
                onBack={back}
            />
        ));
    }

    // The card pick.
    if (pick && pickedOutcome && pickedOutcome.type === 'CARD_PICK') {
        const take = (): void => {
            if (selected === null) return;
            takePick({ cardId: selected, toCollection });
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
                                data-selected={selected === cardId ? 'true' : undefined}
                                style={{ ['--el' as string]: colorFor(face.element) }}
                                aria-pressed={selected === cardId}
                                onClick={() => { playSfx('uiClick'); setSelected(cardId); }}
                            >
                                <CardFace face={face} tags={ProgramRegistry[cardId]?.rarity} />
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
                    <button type="button" className="rs-btn" onClick={back}>
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
                    const blocked = choiceBlockedReason(choice, ctx);
                    return (
                        <button
                            key={choice.id}
                            type="button"
                            className="rs-btn ev-choice"
                            disabled={blocked !== null}
                            onClick={() => choose(choice)}
                        >
                            <span className="ev-label">{choice.label}</span>
                            <span className="ev-detail">
                                {blocked ?? choice.detail}
                            </span>
                        </button>
                    );
                })}
            </div>
        </>
    ));
}
