import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { ProgramData } from '../../engine/types';
import ProgramCard from './ProgramCard';
import { getElementColor } from './cardIcons';
import { prefersReducedMotion } from '../utils/motionPrefs';
import { playSfx } from '../audio/AudioEngine';

/**
 * RevealCard — shared face-down/flip reveal used everywhere rewards appear:
 * the post-battle single pick, the gym-clear mini-draft, and the Synthesis Lab
 * base-deck celebration.
 *
 * The card starts face-down (neon terminal card back) and flips over after
 * `revealDelayMs` — parents stagger that delay (~120ms apart) to fan reveals.
 * Clicking a revealed card fires `onSelect` immediately and plays a brief
 * selection pulse; `onPulseComplete` fires once the pulse beat finishes so
 * sequential flows (the draft) can advance after the player has seen the pick.
 *
 * prefers-reduced-motion: the 3D flip degrades to a simple fade, and the pick
 * pulse to a plain highlight (the pulse *delay* is kept so pacing is stable).
 */

/** Stagger between sibling card reveals. */
export const REVEAL_STAGGER_MS = 120;
/** Duration of the selection pulse before onPulseComplete fires. */
export const PICK_PULSE_MS = 380;
/** Duration of the rotateY flip itself. */
const FLIP_DURATION_S = 0.5;

interface RevealCardProps {
    data: ProgramData;
    /** Delay (ms) before the face-down card flips face-up. Default 0. */
    revealDelayMs?: number;
    isSelected?: boolean;
    /** Non-interactive display (e.g. the synthesis celebration fan). */
    disabled?: boolean;
    /** Fires immediately on click (selection state lives in the parent). */
    onSelect?: () => void;
    /** Fires PICK_PULSE_MS after a click — lets draft flows advance post-pulse. */
    onPulseComplete?: () => void;
}

const RevealCard: React.FC<RevealCardProps> = ({
    data,
    revealDelayMs = 0,
    isSelected,
    disabled,
    onSelect,
    onPulseComplete
}) => {
    const reduced = prefersReducedMotion();
    const [revealed, setRevealed] = useState(false);
    const [pulsing, setPulsing] = useState(false);
    // All pending timeouts cleared on unmount (pendingTimeoutsRef pattern).
    const pendingTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

    useEffect(() => {
        const timeouts = pendingTimeoutsRef.current;
        // Card-flip shimmer, timed to the flip start (after the reveal stagger).
        timeouts.push(setTimeout(() => playSfx('reveal'), revealDelayMs));
        return () => {
            timeouts.forEach(clearTimeout);
            timeouts.length = 0;
        };
        // Mount-only: revealDelayMs is fixed per card instance.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const accent = getElementColor(data.element);

    const handleClick = () => {
        if (disabled || !revealed || pulsing) return;
        playSfx('rewardClaim');
        onSelect?.();
        setPulsing(true);
        pendingTimeoutsRef.current.push(
            setTimeout(() => {
                setPulsing(false);
                onPulseComplete?.();
            }, PICK_PULSE_MS)
        );
    };

    return (
        <motion.div
            className="reveal-card"
            onClick={handleClick}
            animate={pulsing && !reduced
                ? { scale: [1, 1.08, 1] }
                : { scale: 1 }}
            transition={{ duration: PICK_PULSE_MS / 1000, ease: 'easeOut' }}
            style={{
                perspective: '1000px',
                cursor: disabled ? 'default' : 'pointer',
                filter: pulsing ? `drop-shadow(0 0 12px ${accent})` : 'none'
            }}
        >
            <motion.div
                initial={reduced ? { opacity: 0 } : { rotateY: 180 }}
                animate={reduced ? { opacity: 1 } : { rotateY: 0 }}
                transition={{
                    delay: revealDelayMs / 1000,
                    duration: reduced ? 0.35 : FLIP_DURATION_S,
                    ease: reduced ? 'easeOut' : [0.45, 0, 0.2, 1]
                }}
                onAnimationComplete={() => setRevealed(true)}
                style={{
                    position: 'relative',
                    transformStyle: 'preserve-3d'
                }}
            >
                {/* Front face: the actual reward card (in normal flow → sizes the flip) */}
                <div style={{ backfaceVisibility: 'hidden', transform: 'rotateY(0deg)' }}>
                    <ProgramCard data={data} isSelected={isSelected} />
                </div>

                {/* Back face: neon terminal card back (skipped for reduced-motion fades).
                    Deliberately element-neutral so a face-down card never leaks
                    what's underneath — house cyan accent + glyph only. */}
                {!reduced && (
                    <div
                        aria-hidden
                        style={{
                            position: 'absolute',
                            inset: 0,
                            transform: 'rotateY(180deg)',
                            backfaceVisibility: 'hidden',
                            borderRadius: '8px',
                            border: '1px solid rgba(0, 210, 255, 0.6)',
                            background:
                                'repeating-linear-gradient(0deg, rgba(0, 210, 255, 0.05) 0px, rgba(0, 210, 255, 0.05) 1px, transparent 1px, transparent 4px), ' +
                                'linear-gradient(145deg, #10131d 0%, #070910 100%)',
                            boxShadow: 'inset 0 0 18px rgba(0, 210, 255, 0.08), 0 0 10px rgba(0, 210, 255, 0.2)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px'
                        }}
                    >
                        <div style={{
                            fontSize: '2rem',
                            color: '#00d2ff',
                            textShadow: '0 0 12px #00d2ff'
                        }}>
                            ◈
                        </div>
                        <div style={{
                            fontSize: '0.6rem',
                            fontWeight: 900,
                            letterSpacing: '3px',
                            color: 'rgba(0, 210, 255, 0.65)'
                        }}>
                            ENCRYPTED
                        </div>
                    </div>
                )}
            </motion.div>
        </motion.div>
    );
};

export default RevealCard;
