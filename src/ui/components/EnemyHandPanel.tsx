/**
 * What the enemy has to play with, face up behind a tab — ticket 159b.
 *
 * # WHAT THIS IS ANSWERING
 *
 * Henry, 2026-09-20: *"the enemy card deck hides a lot of what the enemies are doing. How can we
 * make that more visible. I think we were trying to avoid moves and keep the cards."* 159 §2 laid
 * out five telegraphs and §5 ruled this one: **show the hand, predict nothing.**
 *
 * That distinction is the whole design. An INTENT ("Kraken will hit Rat for 38") is authored or
 * predicted information — it is moves coming back through the side door, and it lies the moment
 * the player changes the board. A HAND is neither: it is what the enemy is holding, which is true
 * regardless of what anyone does next. With Energy limits and three casters, a seven-card hand is
 * still a decision the player has to read rather than an answer handed to them.
 *
 * So there are no targets here and no order. The 152 case — a Jormungandr turn that killed a party
 * out of nowhere — reads as *"four Undertow and an Ink Stream"*, and the player can decide to
 * shield or to kill Jorm this turn. That is counterplay from open information.
 *
 * # WHERE THE LIST COMES FROM
 *
 * On the enemy's own turn, their real hand. On the player's turn their hand is empty — the engine
 * discards at end of turn and redraws at the start of the next — so it is the top of their
 * drawpile, as many cards as their next refill will take. `enemyHand.ts` holds that reasoning and
 * the reason 159a's reducer change was reverted in favour of it.
 *
 * The reshuffle tail is shown as a count and never guessed; see `enemyHandView`.
 *
 * # WHY IT IS THE EDIT LOADOUT DECK COLUMN
 *
 * §5 is specific: `.rs-panel`, 27px `.rs-row`s, the card tile on hover. Not a new card list.
 * (TICKET 167f: the tile is `<CardPeek>`, a tooltip beside the mouse, like every other list.)
 * The player already reads that column to decide what to cut from a deck, which is the same act as
 * reading what an enemy might cast; a second list shaped differently would be a second thing to
 * learn, and it would drift from the first the next time a row gained a field.
 */

import React, { useMemo } from 'react';

import type { IBattleState } from '../../engine/types';
import { ElementMark } from '../screens/CardChassis';
import { CardPeek } from '../screens/CardPeek';
import { useCardPeek } from '../hooks/useCardPeek';
import { colorFor } from '../screens/runShell';
import { playSfx } from '../audio/AudioEngine';
import { enemyHandView, stackHand } from './enemyHand';

interface Props {
    readonly battleState: IBattleState | null;
    /**
     * TICKET 167g: whether the panel is open, owned by `BattleStage`. It is up there because the
     * enemies slide to meet the panel, and because a panel that owned its own state lost it every
     * time it unmounted.
     */
    readonly open: boolean;
    readonly onToggle: () => void;
}

const EnemyHandPanel: React.FC<Props> = ({ battleState, open, onToggle }) => {
    const { peek, at, peekHandlers } = useCardPeek();

    /*
     * `enemyHandView` returns a fresh object every call, so both of these are memoised on the
     * state identity rather than on the view: Redux hands back the same `battleState` reference
     * until something actually dispatches, which is exactly the invalidation this wants. A member
     * dying or a `cardDraw` buff lands as a new state, so the preview follows it — the two cases
     * Henry asked for.
     */
    const view = useMemo(() => enemyHandView(battleState), [battleState]);
    const stacks = useMemo(() => stackHand(view.cards, view.energy), [view.cards, view.energy]);

    const total = view.cards.length + view.unknown;

    /*
     * A MOVES enemy has no deck by construction, so there is nothing to show and the tab would be
     * a control that opens onto an empty list. Absent rather than empty: a tab reading "ENEMY
     * HAND · 0" in every MOVES fight teaches the player that the feature is broken.
     *
     * TICKET 167g (Henry: *"The enemy hand disappears on enemy turn. If I open it, it should stay
     * open until I close it."*): that is the ONLY case that returns null. It used to return null
     * whenever `total === 0` too, so as the enemy played out its hand the panel vanished and the
     * open state inside it went with it. A CARDS enemy with nothing to show keeps its tab, which
     * reads `ENEMY HAND 0`, and the body says `Nothing in hand.`
     */
    if (!battleState || battleState.enemyMode !== 'CARDS') return null;

    const previewing = view.source === 'PREVIEW';
    const label = previewing && total > 0 ? 'ENEMY DRAWS' : 'ENEMY HAND';

    return (
        /*
          * ONE SLIDING ELEMENT, WITH THE TAB PROUD OF ITS EDGE — the mock's variant C.
          *
          * `159-mock.html`'s `.eh.pc` parks the whole 270px panel at
          * `translateX(calc(100% - 34px))`, which leaves exactly the tab showing; open is
          * `transform: none`. That is why the tab is INSIDE this element rather than a sibling:
          * it is the part of the panel that never leaves.
          *
          * TICKET 167g: it opens and closes on CLICK only. Henry: *"If I open it, it should stay open
          * until I close it."* Hover and focus used to open it, and leaving the mouse closed it.
          * Closed, the rows are `inert` so a keyboard walking the page cannot land on a list that
          * is off-screen; the tab is the way in, and Enter or Space on it toggles.
          */
        <div
            className={`ehp ${open ? 'open' : ''}`}
            data-testid="enemy-hand"
            data-source={view.source}
        >
            {/*
              * A real button: §5 asks for keyboard, and a div with a hover handler is reachable by
              * exactly one input device. Click toggles, so touch and keyboard both have a way in
              * that hover cannot give them - and since 167g it is the ONLY way, hover no longer
              * opens anything.
              */}
            <button
                type="button"
                className="ehp-tab"
                aria-expanded={open}
                aria-controls="enemy-hand-panel"
                onClick={() => { playSfx('uiClick'); onToggle(); }}
            >
                <span>{label} <b>{total}</b></span>
            </button>

            <div className="rs-panel ehp-inner" id="enemy-hand-panel" inert={!open}>
                <h2>
                    {label} · {total}
                    <span className="ehp-ep">{view.energy} EP</span>
                </h2>

                <div className="ehp-rows">
                    {stacks.map((stack) => (
                        <button
                            key={stack.dataId}
                            type="button"
                            className={`rs-row ${stack.unaffordable ? 'ehp-poor' : ''}`}
                            style={{ ['--el' as string]: colorFor(stack.element) }}
                            /*
                             * `useCardPeek`'s handlers: OVER/OUT rather than ENTER/LEAVE, with the
                             * `relatedTarget` guard (the row has child spans), plus mouse MOVE for the
                             * tooltip's position and focus/blur for the keyboard. TICKET 167f: the tile
                             * is drawn into <body> beside the mouse; it used to be a block under the
                             * rows, which grew this panel under the pointer.
                             */
                            {...peekHandlers({ face: stack, count: stack.count })}
                        >
                            <span className="rs-g">{stack.cost}</span>
                            <ElementMark element={stack.element} compact />
                            <span className="rs-rnm">{stack.name}</span>
                            {stack.unaffordable && <span className="rs-t">no EP</span>}
                            {stack.count > 1 && <span className="rs-x">×{stack.count}</span>}
                        </button>
                    ))}

                    {/*
                      * THE GAP, STATED. Not a row per unknown card — that would be a list of
                      * question marks the player has to count — and not silence, which would make
                      * the panel quietly under-report the size of the turn coming at them.
                      */}
                    {total === 0 && (
                        <div className="rs-row static ehp-empty" data-testid="enemy-hand-empty">
                            <span className="rs-rnm">Nothing in hand.</span>
                        </div>
                    )}

                    {view.unknown > 0 && (
                        <div className="rs-row static ehp-unknown" data-testid="enemy-hand-unknown">
                            <span className="rs-g">?</span>
                            <span className="rs-rnm">
                                +{view.unknown} more after reshuffle
                            </span>
                        </div>
                    )}
                </div>

                <CardPeek peek={peek} at={at} className="ehp-peek" />
            </div>
        </div>
    );
};

export default EnemyHandPanel;
