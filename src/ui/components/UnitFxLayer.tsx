import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { prefersReducedMotion } from '../utils/motionPrefs';
import type { UnitFx } from '../hooks/useBattleVfx';

/**
 * Shared combat-FX renderers, extracted from MingmingUnit so both the sidebar
 * HUD cards and the center BattleStage spotlights draw the same event-driven
 * feedback (useBattleVfx descriptors) without duplicating markup.
 *
 * Every piece is an absolutely-positioned overlay: mount them inside any
 * `position: relative` box (HUD card or stage sprite frame). Transient
 * overlays remount on fx key changes so the animation replays per event.
 */

/** Hit flash + heal pulse + status ring overlays. */
export const FxTransientOverlays: React.FC<{ fx?: UnitFx }> = ({ fx }) => (
    <>
        {(fx?.hitKey ?? 0) > 0 && (
            <motion.div
                key={`hitflash-${fx!.hitKey}`}
                className="hud-hit-flash"
                initial={{ opacity: 0.3 + 0.5 * (fx?.hitIntensity ?? 0) }}
                animate={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
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
    /** How far (px) floats rise. HUD cards use the default 86; the stage pushes higher. */
    rise?: number;
    /** Lateral px between the 6 fan-out slots (HUD default 15). */
    slotSpacing?: number;
}

/** Floating combat numbers (damage / crit / heal / ABSORBED readouts). */
export const FxFloats: React.FC<FxFloatsProps> = ({ fx, rise = 86, slotSpacing = 15 }) => (
    <AnimatePresence>
        {(fx?.floats ?? []).map(f => (
            <motion.div
                key={f.id}
                className={`hud-float hud-float-${f.kind}`}
                style={{ color: f.color, left: `calc(50% + ${(f.slot - 2.5) * slotSpacing}px)` }}
                initial={{ opacity: 0, y: 6, scale: f.kind === 'crit' ? 0.6 : 0.7 }}
                animate={{
                    opacity: [0, 1, 1, 0],
                    y: prefersReducedMotion() ? -18 : -rise,
                    scale: f.kind === 'crit' ? 1.55 : f.kind === 'absorbed' ? 0.95 : 1.15,
                    rotate: f.kind === 'crit' ? (f.slot % 2 ? -8 : 8) : 0,
                }}
                exit={{ opacity: 0 }}
                transition={{
                    duration: 1,
                    ease: 'easeOut',
                    opacity: { duration: 1, times: [0, 0.08, 0.7, 1] },
                }}
            >
                {f.text}
            </motion.div>
        ))}
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
                    ☠ TERMINATED
                </motion.span>
            </motion.div>
        )}
    </AnimatePresence>
);
