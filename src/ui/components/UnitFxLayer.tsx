import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { prefersReducedMotion } from '../utils/motionPrefs';
import type { UnitFx } from '../hooks/useBattleVfx';
import { floatFontPx, floatSizing, slotStepPx } from '../vfx/floatStyle';
import { InlineIcon } from '../theme/InlineIcon';
import { MARK_ICON } from '../theme/markIcons';

/**
 * Shared combat-FX renderers, extracted from MingmingUnit so both the sidebar
 * HUD cards and the center BattleStage spotlights draw the same event-driven
 * feedback (useBattleVfx descriptors) without duplicating markup.
 *
 * Every piece is an absolutely-positioned overlay: mount them inside any
 * `position: relative` box (HUD card or stage sprite frame). Transient
 * overlays remount on fx key changes so the animation replays per event.
 */

/** How long the white flash on a body that took a hit lasts (190e). */
const HIT_FLASH_MS = 90;

/** Hit flash + heal pulse + status ring overlays. */
export const FxTransientOverlays: React.FC<{ fx?: UnitFx }> = ({ fx }) => (
    <>
        {/* 190e: a white flash of about 90 ms; `flashKey` only moves with the flashes setting on. */}
        {(fx?.flashKey ?? 0) > 0 && (
            <motion.div
                key={`hitflash-${fx!.flashKey}`}
                className="hud-hit-flash"
                initial={{ opacity: 0.6 + 0.3 * (fx?.hitIntensity ?? 0) }}
                animate={{ opacity: 0 }}
                transition={{ duration: HIT_FLASH_MS / 1000, ease: 'easeOut' }}
            />
        )}
        {(fx?.healKey ?? 0) > 0 && (
            <motion.div
                key={`healpulse-${fx!.healKey}`}
                className="hud-heal-pulse"
                initial={{ opacity: 0.5 }}
                animate={{ opacity: 0 }}
                transition={{ duration: 0.55, ease: 'easeOut' }}
            />
        )}
        {(fx?.statusKey ?? 0) > 0 && (
            <motion.div
                key={`statusring-${fx!.statusKey}`}
                className="hud-status-ring"
                style={{
                    borderColor: fx!.statusColor,
                    boxShadow: `0 0 16px ${fx!.statusColor}66, inset 0 0 10px ${fx!.statusColor}44`,
                }}
                initial={{ opacity: 0.9, scale: 1 }}
                animate={{ opacity: 0, scale: 1.04 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
            />
        )}
    </>
);

interface FxFloatsProps {
    fx?: UnitFx;
    /** How far (px) floats rise. HUD cards use the default 70; the stage pushes higher (90). */
    rise?: number;
}

/*
 * TICKET 167h: each slot starts below the one before it. The six slots used to fan out SIDEWAYS,
 * which put a burst of hits in a wide row that still overlapped at the ends; they now stack upward,
 * newest lowest, so every number of a burst has a line of its own. The step is 22 px, or most of
 * the float's own height when it is a big number (`slotStepPx`, 194k-4).
 */
/** Where the status column sits, left of the damage column, so a status never covers a number. */
const STATUS_COLUMN_LEFT = 'calc(50% - 70px)';

/** Floating combat numbers (damage / crit / heal / ABSORBED readouts). */
export const FxFloats: React.FC<FxFloatsProps> = ({ fx, rise = 70 }) => (
    <AnimatePresence>
        {(fx?.floats ?? []).map(f => {
            // Vertical only. The offset holds for the whole life, so the stack stays a stack.
            const slotY = f.slot * slotStepPx(floatFontPx(f.kind, f.px));
            return (
                <motion.div
                    key={f.id}
                    className={`hud-float hud-float-${f.kind}`}
                    style={{ color: f.color, left: f.kind === 'status' ? STATUS_COLUMN_LEFT : '50%', ...floatSizing(f.kind, f.px) }}
                    initial={{ opacity: 0, y: 6 + slotY, scale: f.kind === 'crit' ? 0.6 : 0.7 }}
                    animate={{
                        opacity: [0, 1, 1, 0],
                        y: (prefersReducedMotion() ? -18 : -rise) + slotY,
                        scale: f.kind === 'crit' ? 1.55 : f.kind === 'absorbed' || f.kind === 'tag' ? 0.95 : 1.15,
                        rotate: f.kind === 'crit' ? (f.slot % 2 ? -8 : 8) : 0,
                    }}
                    exit={{ opacity: 0 }}
                    transition={{
                        duration: 1.8,
                        ease: 'easeOut',
                        // They hold readable for most of the life (167h: 1 s was too fast to read).
                        opacity: { duration: 1.8, times: [0, 0.06, 0.8, 1] },
                    }}
                >
                    {f.text}{f.icon && <> <InlineIcon {...MARK_ICON[f.icon]} /></>}
                </motion.div>
            );
        })}
    </AnimatePresence>
);

interface TerminatedStampProps {
    visible: boolean;
    /** True while the death glitch plays, delaying the stamp beat (matches MingmingUnit). */
    glitching: boolean;
}

/** The neon-red TERMINATED stamp shown over dead units. */
export const TerminatedStamp: React.FC<TerminatedStampProps> = ({ visible, glitching }) => (
    <AnimatePresence>
        {visible && (
            <motion.div
                key="terminated-stamp"
                className="hud-terminated-wrap"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, delay: glitching ? 0.35 : 0 }}
            >
                <motion.span
                    className="hud-terminated-stamp"
                    initial={{ scale: 1.7, rotate: -14 }}
                    animate={{ scale: 1, rotate: -8 }}
                    transition={{ duration: 0.25, ease: 'easeOut', delay: glitching ? 0.35 : 0 }}
                >
                    <InlineIcon {...MARK_ICON.terminated} /> TERMINATED
                </motion.span>
            </motion.div>
        )}
    </AnimatePresence>
);
