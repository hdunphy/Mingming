/**
 * The enemy's hand, face up behind a tab — ticket 159b.
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
 * out of nowhere — reads as *"four Undertow and an Ink Stream in hand"*, and the player can decide
 * to shield or to kill Jorm this turn. That is counterplay from open information.
 *
 * # WHY THERE IS A HAND TO SHOW AT ALL
 *
 * There was not, until 159a. `END_TURN` discarded the active side's hand and the next `TURN_START`
 * drew it fresh, so during the player's turn the enemy held nothing and this panel would have been
 * an empty list. 159a moved the draw to the end of the owner's own turn for exactly this.
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
import { highestEnemyEnergy, stackHand, type HandStack } from './enemyHand';

/** One shared empty array, so a null state does not invalidate the memo on every render. */
const EMPTY_HAND: ReadonlyArray<never> = [];

interface Props {
    readonly battleState: IBattleState | null;
}

const EnemyHandPanel: React.FC<Props> = ({ battleState }) => {
    const [open, setOpen] = useState(false);
    const [peek, setPeek] = useState<HandStack | null>(null);

    const energy = highestEnemyEnergy(battleState);
    // The `?? EMPTY_HAND` is a stable reference on purpose: `?? []` is a new array every render,
    // which would make the memo below recompute on every one of them.
    const hand = battleState?.enemyDeck.hand ?? EMPTY_HAND;
    const stacks = useMemo(() => stackHand(hand, energy), [hand, energy]);

    /*
     * A MOVES enemy has no deck by construction, so there is nothing to show and the tab would be
     * a control that opens onto an empty list. Absent rather than empty: a tab reading "ENEMY
     * HAND · 0" in every MOVES fight teaches the player that the feature is broken.
     */
    if (!battleState || hand.length === 0) return null;

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
                <span>ENEMY HAND <b>{hand.length}</b></span>
            </button>

            <div className="rs-panel ehp-inner" id="enemy-hand-panel">
                <h2>
                    ENEMY HAND · {hand.length}
                    <span className="ehp-ep">{energy} EP</span>
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
