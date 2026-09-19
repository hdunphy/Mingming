import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CardFace } from '../screens/CardChassis';
import { bannerFor } from '../screens/runShell';
import { shortTargetLabel } from '../utils/targeting';
import { numericBaseCost } from '../../engine/types';
import CardKeywordChips from './CardKeywordChips';
import { GetProgramData } from '../../engine/data/programRegistry';
import { getElementColor } from './cardIcons';
import { loadSettings, resolveVfxGates } from '../settings/settings';
import type { PlayedCardAnnouncement } from '../hooks/useBattleVfx';
import { anchorFor, discardAnchor, handAnchor, revealAnchor } from '../vfx/emit';
import { FLIGHT_MS } from '../vfx/useCastSequence';

/**
 * PlayedCardReveal — the card that just resolved, held at centre stage.
 *
 * Henry: *"We should also show the cards that get played, animate them to show center screen so the
 * player knows what was played rather than having to check the log."*
 *
 * The combat log already carries every play, and that is precisely the complaint: at 3v3 the enemy
 * casts seven cards a turn from a shared pile, and the only record of which ones was a scrolling
 * prose feed the player had to look away to read. A side-wide debuff and a single-target one look
 * identical on the board once the numbers have floated away.
 *
 * TICKET 127 — THIS IS ALSO WHERE THE WAIT GOES. Henry: *"That animation can eat up the time as
 * well."* The enemy loop used to sleep 600ms with nothing on screen and then think for 1.3s. It now
 * holds for `PLAYED_CARD_REVEAL_MS` with this on screen and thinks after, so the wall-clock is about
 * what it was and the time carries information instead of nothing. See `BattleArena`'s enemy loop.
 *
 * THE FACE IS THE REAL CARD. `PROGRAM_PLAYED.programId` is the dataId, so this looks the program up
 * and renders the shared `CardFace` — the same face the hand and the shop render. A hand-built panel
 * is a second card face, and a second card face drifts from the first the next time a card gains a
 * keyword chip.
 *
 * NON-INTERACTIVE BY CONSTRUCTION. `pointer-events: none` on the wrapper: the reveal sits over the
 * stage while the player may be mid-drag on their own turn, and a card face that swallowed a
 * pointer-up would eat a play. The keyword chips open a hover tooltip through a portal, and it must not
 * fire from here either.
 */

interface Props {
    /** The latest play, or null. Keyed on `key` so two casts of one card are two reveals. */
    played: PlayedCardAnnouncement | null;
}

const PlayedCardReveal: React.FC<Props> = ({ played }) => {
    /*
     * §2c: *"`animations` off → steps 1 and 5 are instant."* Reduced motion already implied that;
     * `resolveVfxGates` is the generalisation, and reading it here rather than
     * `prefersReducedMotion()` means the switch and the OS preference reach this card through the
     * one function that also stamps the DOM attributes.
     *
     * ONCE PER MOUNT, not per render. This component re-renders on every battle state change, and
     * `loadSettings` is a `localStorage` read and a JSON parse — the first version of this line put
     * both on every render and the write-back measured it: frame spikes to 46ms on a board whose
     * particle layer peaked at 21. The settings screen is a route away from a fight, so there is
     * nothing to miss by reading at mount.
     */
    const [reduced] = useState(() => !resolveVfxGates(loadSettings()).animations);

    // A missing program is a dead reveal rather than a crash: `GetProgramData` returns a not-found
    // stub, and rendering that stub's face would be worse than rendering nothing.
    const data = played ? GetProgramData(played.dataId) : null;
    if (!played || !data || !data.name) return null;

    const accent = getElementColor(data.element);

    /*
     * ── TICKET 146c, STEPS 1 AND 5: THE CARD'S OWN FLIGHT ────────────────────────────────────
     *
     * Ruling 5: *"Player card flies to the lane, then the animations play, then go to discard."*
     * Ruling 6: *"Cards originate from the caster and do a similar thing except discard back at
     * the caster."*
     *
     * So both sides fly TO THE LANE and differ only in where they come from and go back to. The
     * enemy's card is not left small over its own sprite — ruling 6 says "a similar thing", and
     * ticket 127 set the 1200ms hold precisely because Henry could not read the enemy's cards
     * ("Enemy AI cards disappear to fast"). A card parked at 0.6 scale on top of a 190px sprite
     * would undo that fix while technically animating.
     *
     *   player  hand fan  ->  lane  ->  the discard pile, at the end of the hand row
     *   enemy   caster    ->  lane  ->  back into the caster
     *
     * The offsets are deltas from the lane's own centre, because that is where this element
     * already is: it is positioned at the lane and framer-motion animates `x`/`y` as transforms
     * off that position. Computing absolute coordinates here would mean re-deriving the lane.
     */
    const lane = revealAnchor();
    const caster = anchorFor(played.sourceId);
    const hand = handAnchor();

    const centreOf = (r: { x: number; y: number; w?: number; h?: number } | null) =>
        r ? { x: r.x + (r.w ?? 0) / 2, y: r.y + (r.h ?? 0) / 2 } : null;

    const laneCentre = centreOf(lane);
    const origin = centreOf(played.fromPlayer ? hand : caster);
    const destination = centreOf(played.fromPlayer ? discardAnchor() : caster);

    const delta = (point: { x: number; y: number } | null) =>
        point && laneCentre ? { dx: point.x - laneCentre.x, dy: point.y - laneCentre.y } : null;

    const entry = delta(origin);
    const exit = delta(destination);

    /*
     * The fallback when the anchors are not mounted — a reveal rendered outside a battle stage, or
     * the first frame before the layer registers. The old behaviour: in from the caster's side of
     * the board, out the other way. Keeping it means this component never depends on the particle
     * layer being alive.
     */
    const fromY = played.fromPlayer ? 90 : -90;

    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={played.key}
                aria-live="polite"
                style={{
                    position: 'absolute',
                    top: '38%',
                    left: '50%',
                    zIndex: 60,
                    pointerEvents: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px',
                    // `translate(-50%, -50%)` cannot live here: framer-motion animates `x`/`y` as
                    // transforms and would overwrite it. The centring goes on `x`/`y` below.
                }}
                initial={reduced
                    ? { opacity: 0, x: '-50%', y: '-50%' }
                    : {
                        opacity: 0,
                        x: entry ? `calc(-50% + ${entry.dx}px)` : '-50%',
                        y: entry ? `calc(-50% + ${entry.dy}px)` : `calc(-50% + ${fromY}px)`,
                        // §2c: the enemy's card grows from 0.6; the player's comes up from the fan,
                        // where it was already a card, so it starts nearer full size.
                        scale: played.fromPlayer ? 0.7 : 0.6,
                    }}
                animate={reduced
                    ? { opacity: 1, x: '-50%', y: '-50%' }
                    : { opacity: 1, x: '-50%', y: '-50%', scale: 1 }}
                exit={reduced
                    ? { opacity: 0, x: '-50%', y: '-50%' }
                    : {
                        opacity: 0,
                        x: exit ? `calc(-50% + ${exit.dx}px)` : '-50%',
                        y: exit ? `calc(-50% + ${exit.dy}px)` : `calc(-50% - ${fromY / 3}px)`,
                        // §2c: *"the lane card shrinks and flies to the discard pile"*. Small
                        // enough to read as going away, not so small it vanishes mid-flight.
                        scale: 0.35,
                    }}
                transition={reduced
                    ? { duration: 0.12 }
                    // §2c gives the flight 180ms and the discard 200ms. A spring would overshoot
                    // the lane pose and arrive late, and the trail leaves at 180ms whatever the
                    // card is doing — so the two would drift apart. Eased, and on the ticket's
                    // numbers, they cannot.
                    : {
                        duration: FLIGHT_MS / 1000,
                        ease: 'easeOut',
                        opacity: { duration: 0.14 },
                    }}
            >

                {/*
                  * TICKET 145f — THE REVEAL LANE. The card sits at 148x196 rotated -4 degrees,
                  * which is the mock's geometry, and the caption goes UNDER it rather than over.
                  * The tilt is doing work: an upright card in the middle of an upright board reads
                  * as a modal, and this is not one — the fight continues behind it.
                  */}
                <div
                    className="reveal-card"
                    style={{
                        // The glow is the only thing that scales with the card's element; the face
                        // itself is untouched so it matches the hand exactly.
                        filter: `drop-shadow(0 0 14px ${accent}) drop-shadow(0 6px 18px rgba(0,0,0,0.8))`,
                    }}
                >
                    {/*
                      * TICKET 155e — the lane joins the one face.
                      *
                      * This rendered `ProgramCard`, which was a THIRD chassis: the shop and editor
                      * drew `.rs-card`, the hand drew `HandCardFace`, and the card the player had
                      * just watched leave their hand arrived in the lane looking like neither. The
                      * comment above this block claimed it was "the same component the hand
                      * renders" — that stopped being true when 145d gave the hand the shop's
                      * chassis, and nothing noticed because nothing asserted it.
                      *
                      * No readout here on purpose: by the time a card reaches the lane it has
                      * already resolved, so a "96 DMG vs SKOLL" preview would be a prediction of
                      * something that has happened. The caption underneath says who and at whom.
                      */}
                    <div className="rs-card played-card-reveal" style={{ ['--el' as string]: accent }}>
                        <CardFace
                            face={{
                                name: data.name,
                                description: data.description ?? '',
                                element: data.element ?? 'None',
                                cost: numericBaseCost(data.baseCost),
                                banner: bannerFor(data.category),
                            }}
                            target={shortTargetLabel(data)}
                            keywords={<CardKeywordChips data={data} />}
                        />
                    </div>
                </div>
                {/*
                  * "FENRIR CASTS WAR PACT" — the sentence the mock prints under the lane. It says
                  * the two things the card face cannot: WHO cast it, which at 3v3 is a real
                  * question, and who it landed on.
                  */}
                <div className="reveal-caption" style={{ color: played.fromPlayer ? '#8fe3ff' : '#ff9d9d' }}>
                    {played.sourceName} casts {data.name}
                    {played.targetName && played.targetName !== played.sourceName
                        ? ` \u2192 ${played.targetName}`
                        : ''}
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

export default PlayedCardReveal;
