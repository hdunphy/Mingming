import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import ProgramCard from './ProgramCard';
import { GetProgramData } from '../../engine/data/programRegistry';
import { getElementColor } from './cardIcons';
import { prefersReducedMotion } from '../utils/motionPrefs';
import type { PlayedCardAnnouncement } from '../hooks/useBattleVfx';

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
 * and renders `ProgramCard` — the same component the hand renders. A hand-built "played card" panel
 * is a second card face, and a second card face drifts from the first the next time a card gains a
 * keyword chip.
 *
 * NON-INTERACTIVE BY CONSTRUCTION. `pointer-events: none` on the wrapper: the reveal sits over the
 * stage while the player may be mid-drag on their own turn, and a card face that swallowed a
 * pointer-up would eat a play. `ProgramCard` opens a hover tooltip through a portal, and it must not
 * fire from here either.
 */

interface Props {
    /** The latest play, or null. Keyed on `key` so two casts of one card are two reveals. */
    played: PlayedCardAnnouncement | null;
}

const PlayedCardReveal: React.FC<Props> = ({ played }) => {
    const reduced = prefersReducedMotion();

    // A missing program is a dead reveal rather than a crash: `GetProgramData` returns a not-found
    // stub, and rendering that stub's face would be worse than rendering nothing.
    const data = played ? GetProgramData(played.dataId) : null;
    if (!played || !data || !data.name) return null;

    const accent = getElementColor(data.element);
    // The enemy's cards arrive from their side of the stage and the player's from theirs, so the
    // reveal reads as "who did this" before the label is read at all.
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
                    : { opacity: 0, x: '-50%', y: `calc(-50% + ${fromY}px)`, scale: 0.7 }}
                animate={reduced
                    ? { opacity: 1, x: '-50%', y: '-50%' }
                    : { opacity: 1, x: '-50%', y: '-50%', scale: 1 }}
                exit={reduced
                    ? { opacity: 0, x: '-50%', y: '-50%' }
                    : { opacity: 0, x: '-50%', y: `calc(-50% - ${fromY / 3}px)`, scale: 0.9 }}
                transition={reduced
                    ? { duration: 0.12 }
                    : { type: 'spring', stiffness: 420, damping: 26, opacity: { duration: 0.14 } }}
            >
                <div
                    style={{
                        fontSize: '0.72rem',
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: played.fromPlayer ? '#8fe3ff' : '#ff9d9d',
                        textShadow: '0 1px 3px rgba(0,0,0,0.9)',
                        whiteSpace: 'nowrap',
                    }}
                >
                    {played.sourceName}
                    {played.targetName && played.targetName !== played.sourceName
                        ? ` → ${played.targetName}`
                        : ''}
                </div>
                <div
                    style={{
                        // The glow is the only thing that scales with the card's element; the face
                        // itself is untouched so it matches the hand exactly.
                        filter: `drop-shadow(0 0 14px ${accent}) drop-shadow(0 6px 18px rgba(0,0,0,0.8))`,
                    }}
                >
                    <ProgramCard data={data} className="played-card-reveal" />
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

export default PlayedCardReveal;
