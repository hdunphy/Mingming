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
 * §5 is specific: `.rs-panel`, 27px `.rs-row`s, the `.led-peek` tile on hover. Not a new card list.
 * The player already reads that column to decide what to cut from a deck, which is the same act as
 * reading what an enemy might cast; a second list shaped differently would be a second thing to
 * learn, and it would drift from the first the next time a row gained a field.
 */

import React, { useMemo, useState } from 'react';

import type { IBattleState } from '../../engine/types';
import { CardTileFace, ElementMark } from '../screens/CardChassis';
import { colorFor } from '../screens/runShell';
import { playSfx } from '../audio/AudioEngine';
import { enemyHandView, stackHand, type HandStack } from './enemyHand';

interface Props {
    readonly battleState: IBattleState | null;
}

const EnemyHandPanel: React.FC<Props> = ({ battleState }) => {
    const [open, setOpen] = useState(false);
    const [peek, setPeek] = useState<HandStack | null>(null);

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
     * HAND · 0" in every MOVES fight teaches the player that the feature is broken. The same
     * applies to a CARDS enemy that has genuinely run out of cards — nothing to show is nothing
     * to show.
     */
    if (!battleState || total === 0) return null;

    const previewing = view.source === 'PREVIEW';
    const label = previewing ? 'ENEMY DRAWS' : 'ENEMY HAND';

    const close = () => { setOpen(false); setPeek(null); };

    return (
        /*
          * ONE SLIDING ELEMENT, WITH THE TAB PROUD OF ITS EDGE — the mock's variant C.
          *
          * `159-mock.html`'s `.eh.pc` parks the whole 270px panel at
          * `translateX(calc(100% - 34px))`, which leaves exactly the tab showing; open is
          * `transform: none`. That is why the tab is INSIDE this element rather than a sibling:
          * it is the part of the panel that never leaves.
          *
          * Hover and focus-within both open it, so a keyboard walking into a row opens the panel
          * that row is in — which is the only way the rows are reachable without a mouse.
          */
        <div
            className={`ehp ${open ? 'open' : ''}`}
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={close}
            data-testid="enemy-hand"
            data-source={view.source}
        >
            {/*
              * A real button: §5 asks for keyboard, and a div with a hover handler is reachable by
              * exactly one input device. Click toggles, so touch and keyboard both have a way in
              * that hover cannot give them.
              */}
            <button
                type="button"
                className="ehp-tab"
                aria-expanded={open}
                aria-controls="enemy-hand-panel"
                onFocus={() => setOpen(true)}
                onClick={() => { playSfx('uiClick'); setOpen(!open); }}
            >
                <span>{label} <b>{total}</b></span>
            </button>

            <div className="rs-panel ehp-inner" id="enemy-hand-panel">
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
                             * OVER/OUT rather than ENTER/LEAVE, and the `relatedTarget` guard with
                             * them — the same pair `LoadoutEditor` uses and for the same two
                             * reasons: React synthesises enter/leave from these, so the enter form
                             * is a peek no interaction test can drive; and the row has child spans,
                             * so a bare `mouseout` would drop the peek every time the pointer
                             * crossed one.
                             */
                            onMouseOver={() => setPeek(stack)}
                            onFocus={() => setPeek(stack)}
                            onMouseOut={(e) => {
                                const to = e.relatedTarget as Node | null;
                                if (to && e.currentTarget.contains(to)) return;
                                setPeek(null);
                            }}
                            onBlur={() => setPeek(null)}
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
                    {view.unknown > 0 && (
                        <div className="rs-row static ehp-unknown" data-testid="enemy-hand-unknown">
                            <span className="rs-g">?</span>
                            <span className="rs-rnm">
                                +{view.unknown} more after reshuffle
                            </span>
                        </div>
                    )}
                </div>

                {/*
                  * The tile goes UNDER the rows as an ordinary block, exactly as `.led-peek` does
                  * since 155h — not `position: fixed`, which is what put the Edit Loadout peek in
                  * the middle of the screen at any width but 1280.
                  */}
                {peek && (
                    <div
                        className="rs-card ehp-peek"
                        style={{ ['--el' as string]: colorFor(peek.element) } as React.CSSProperties}
                        aria-hidden="true"
                    >
                        <CardTileFace face={peek} count={peek.count} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default EnemyHandPanel;
