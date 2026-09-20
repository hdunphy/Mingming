import React, { useEffect, useRef, useState } from 'react';
import { motion, useAnimationControls } from 'framer-motion';
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
 * PERMANENTLY MOUNTED — Henry, 2026-09-20, off the 155 write-back. This used to be an
 * `AnimatePresence` child keyed on `played.key`, which meant every cast unmounted one card face and
 * mounted another. The write-back measured the cost: ONE frame of 100-133ms per cast, warm or cold,
 * at both viewports — six or seven dropped frames, landing on the exact frame the player is
 * watching. Henry's call was *"permanent invisible card"*: the element never unmounts, the face is
 * a props update rather than a mount, and the flight is driven imperatively off `played.key`.
 *
 * The cost of that call, stated plainly: one card face is always in the tree over the stage. It is
 * `opacity: 0`, `pointer-events: none` and `aria-hidden` when there is nothing to announce, and
 * between casts it holds the LAST card played rather than being emptied — an empty face would be a
 * second layout to pay for, which is the thing we are buying our way out of.
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

    /*
     * WHAT THE FACE RENDERS BETWEEN CASTS: the last card played, held invisible.
     *
     * `played` goes null on the turn flip, and the whole point of the permanent mount is that the
     * face does NOT tear down when it does. A ref rather than state: it is written in an effect,
     * so the render that clears `played` still reads the previous value and the face keeps its
     * content through the exit animation without a second render to arrange it.
     */
    const lastRef = useRef<PlayedCardAnnouncement | null>(null);
    const shown = played ?? lastRef.current;
    useEffect(() => {
        if (played) lastRef.current = played;
    }, [played]);

    // A missing program is a dead reveal rather than a crash: `GetProgramData` returns a not-found
    // stub, and rendering that stub's face would be worse than rendering the card's own name.
    const data = shown ? GetProgramData(shown.dataId) : null;
    const hasFace = !!(data && data.name);

    const accent = hasFace ? getElementColor(data!.element) : 'transparent';

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
    const caster = shown ? anchorFor(shown.sourceId) : null;
    const hand = handAnchor();

    const centreOf = (r: { x: number; y: number; w?: number; h?: number } | null) =>
        r ? { x: r.x + (r.w ?? 0) / 2, y: r.y + (r.h ?? 0) / 2 } : null;

    const laneCentre = centreOf(lane);
    const origin = centreOf(shown?.fromPlayer ? hand : caster);
    const destination = centreOf(shown?.fromPlayer ? discardAnchor() : caster);

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
    const fromY = shown?.fromPlayer ? 90 : -90;

    /*
     * ── THE FLIGHT, DRIVEN BY HAND ──────────────────────────────────────────────
     *
     * `AnimatePresence` animates a mount and an unmount, which is exactly what this element no
     * longer does. The poses are unchanged — same offsets, same scales, same §2c durations — but
     * they are now `set` and `start` calls fired on a change of `played.key`, so the SAME DOM
     * flies every time instead of a new one being built to fly.
     *
     * The poses are read from a ref rather than closed over: they depend on anchors that move with
     * the window, and the effect must use the ones from the render that decided to animate.
     */
    const controls = useAnimationControls();
    const posesRef = useRef({ entry, exit, fromY, reduced, fromPlayer: !!shown?.fromPlayer });
    posesRef.current = { entry, exit, fromY, reduced, fromPlayer: !!shown?.fromPlayer };

    const flownKeyRef = useRef<number | null>(null);
    useEffect(() => {
        const { entry: e, exit: x, fromY: fy, reduced: red, fromPlayer } = posesRef.current;
        const transition = red
            ? { duration: 0.12 }
            /*
             * §2c gives the flight 180ms and the discard 200ms. A spring would overshoot the lane
             * pose and arrive late, and the trail leaves at 180ms whatever the card is doing — so
             * the two would drift apart. Eased, and on the ticket's numbers, they cannot.
             */
            : { duration: FLIGHT_MS / 1000, ease: 'easeOut' as const, opacity: { duration: 0.14 } };

        if (played && played.key !== flownKeyRef.current) {
            flownKeyRef.current = played.key;
            controls.set(red
                ? { opacity: 0, x: '-50%', y: '-50%', scale: 1 }
                : {
                    opacity: 0,
                    x: e ? `calc(-50% + ${e.dx}px)` : '-50%',
                    y: e ? `calc(-50% + ${e.dy}px)` : `calc(-50% + ${fy}px)`,
                    // §2c: the enemy's card grows from 0.6; the player's comes up from the fan,
                    // where it was already a card, so it starts nearer full size.
                    scale: fromPlayer ? 0.7 : 0.6,
                });
            void controls.start({ opacity: 1, x: '-50%', y: '-50%', scale: 1 }, transition);
            return;
        }

        if (!played && flownKeyRef.current !== null) {
            flownKeyRef.current = null;
            void controls.start(red
                ? { opacity: 0, x: '-50%', y: '-50%' }
                : {
                    opacity: 0,
                    x: x ? `calc(-50% + ${x.dx}px)` : '-50%',
                    y: x ? `calc(-50% + ${x.dy}px)` : `calc(-50% - ${fy / 3}px)`,
                    // §2c: *"the lane card shrinks and flies to the discard pile"*. Small enough
                    // to read as going away, not so small it vanishes mid-flight.
                    scale: 0.35,
                }, transition);
        }
    }, [played, controls]);

    return (
            <motion.div
                aria-live="polite"
                /*
                 * Nothing to announce means nothing in the accessibility tree either. The face is
                 * still mounted underneath — that is the whole point — but a screen reader should
                 * not find last turn's card sitting on the stage.
                 */
                aria-hidden={played ? undefined : true}
                data-reveal={played ? 'shown' : 'idle'}
                style={{
                    position: 'absolute',
                    /*
                     * TICKET 155, DEEP DIVE 2 — THE LANE IS WHERE THE GEOMETRY SAYS IT IS.
                     *
                     * This was `top: 38%; left: 50%` — a percentage of `.stage-area`, tuned by
                     * eye — while the flight deltas below are computed against
                     * `place(REVEAL_RECT)`. Two different answers to "where is the lane", so the
                     * card flew toward a point it was not going to land on, and the error grew
                     * with the window.
                     *
                     * Anchored to `anchors.reveal` now: one source, and 146c's trail (which also
                     * reads the anchors) crosses in front of the card rather than past it.
                     *
                     * BOTH axes take the rect's CENTRE, because `x`/`y` below are `-50%` on both.
                     * The first cut of this passed `lane.y` — the rect's top edge — against a
                     * `translateY(-50%)`, which hung the card half its own height above the lane:
                     * at 1280x800 its top measured -9, i.e. off the top of the screen and under
                     * the bar. Caught by the write-back measurement, not by eye.
                     */
                    top: lane ? lane.y + (lane.h ?? 0) / 2 : '38%',
                    left: lane ? lane.x + (lane.w ?? 0) / 2 : '50%',
                    zIndex: 60,
                    pointerEvents: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px',
                    // `translate(-50%, -50%)` cannot live here: framer-motion animates `x`/`y` as
                    // transforms and would overwrite it. The centring goes on `x`/`y` below.
                }}
                /*
                 * The resting pose is INVISIBLE, not absent. Before the first cast of a battle the
                 * element is already here, already laid out, already `-50%` on both axes; the
                 * first play is a `set` plus a `start`, which is the mount this component no
                 * longer performs.
                 */
                initial={{ opacity: 0, x: '-50%', y: '-50%', scale: 1 }}
                animate={controls}
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
                        {/*
                          * BEFORE THE FIRST CAST there is no card to draw, and the face renders
                          * empty rather than being left out: an element that appears on the first
                          * play is a mount on the first play, which is the cost this component was
                          * rebuilt to stop paying. Empty strings, same nodes, same layout.
                          */}
                        <CardFace
                            face={{
                                name: hasFace ? data!.name : '',
                                description: hasFace ? data!.description ?? '' : '',
                                element: hasFace ? data!.element ?? 'None' : 'None',
                                cost: hasFace ? numericBaseCost(data!.baseCost) : 0,
                                /*
                                 * `Banner` has no empty member and should not gain one for this:
                                 * the idle face is never read, and SKILL is the least loaded of
                                 * the four — no element bar, no macro chrome.
                                 */
                                banner: hasFace ? bannerFor(data!.category) : 'SKILL',
                            }}
                            target={hasFace ? shortTargetLabel(data!) : undefined}
                            keywords={hasFace ? <CardKeywordChips data={data!} /> : null}
                        />
                    </div>
                </div>
                {/*
                  * "FENRIR CASTS WAR PACT" — the sentence the mock prints under the lane. It says
                  * the two things the card face cannot: WHO cast it, which at 3v3 is a real
                  * question, and who it landed on.
                  */}
                <div className="reveal-caption" style={{ color: shown?.fromPlayer ? '#8fe3ff' : '#ff9d9d' }}>
                    {hasFace && shown ? (
                        <>
                            {shown.sourceName} casts {data!.name}
                            {shown.targetName && shown.targetName !== shown.sourceName
                                ? ` \u2192 ${shown.targetName}`
                                : ''}
                        </>
                    ) : null}
                </div>
            </motion.div>
    );
};

export default PlayedCardReveal;
