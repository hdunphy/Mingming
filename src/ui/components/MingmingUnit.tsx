import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, useAnimation, AnimatePresence } from 'framer-motion';
import type { IBattleEntity, StatusType } from '../../engine/types';
import type { IBattleState } from '../../engine/types';
import { getExpForLevel } from '../../engine/types';
import { getOSBehavior } from '../../engine/data/firmwareRegistry';
import { GetProgramData } from '../../engine/data/programRegistry';
import { calculateDamage } from '../../engine/combatUtils';
import { statusGlossary, STATUS_COLORS } from '../../engine/data/statusGlossary';
import { computeDamagePreview, type DamagePreview } from '../utils/damagePreview';
import { readableTextOn, badgeTextShadow, getElementAccent } from '../utils/contrastText';
import { formatMultiplier } from './ElementMatchupTooltip';
import { prefersReducedMotion } from '../utils/motionPrefs';
import type { UnitFx } from '../hooks/useBattleVfx';

/**
 * Status badge with a hover tooltip explaining the mechanic.
 * Rendered through a portal (same pattern as the OS/intent tooltips)
 * so parent overflow never clips it.
 */
const StatusBadge: React.FC<{ type: StatusType; stacks: number }> = ({ type, stacks }) => {
    const [showTooltip, setShowTooltip] = React.useState(false);
    const badgeRef = React.useRef<HTMLDivElement>(null);
    const info = statusGlossary[type];
    const color = STATUS_COLORS[type] ?? '#ccc';

    return (
        <div
            ref={badgeRef}
            className="hud-status-badge"
            style={{ borderColor: color, color }}
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
        >
            <span className="hud-status-icon">{info?.icon ?? '✦'}</span>
            {stacks > 1 && <span className="hud-status-stacks">×{stacks}</span>}

            {showTooltip && info && createPortal(
                <div
                    className="os-tooltip-portal"
                    style={badgeRef.current ? (() => {
                        const rect = badgeRef.current.getBoundingClientRect();
                        const isRightSide = rect.left > window.innerWidth / 2;
                        return {
                            position: 'fixed' as const,
                            left: isRightSide ? 'auto' : rect.right + 12,
                            right: isRightSide ? (window.innerWidth - rect.left) + 12 : 'auto',
                            top: rect.top,
                            transform: 'translateY(-30%)',
                            borderColor: color,
                            boxShadow: `0 0 20px ${color}55`
                        };
                    })() : {}}
                >
                    <div className="tooltip-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
                        <span className="tooltip-os-name" style={{ color }}>{info.name.toUpperCase()}</span>
                        <span style={{ color, opacity: 0.85, fontSize: '0.7rem', fontWeight: 700 }}>×{stacks}</span>
                    </div>
                    <div className="tooltip-divider" />
                    <div className="tooltip-body">{info.description}</div>
                    <div className="tooltip-footer">STATUS READOUT</div>
                </div>,
                document.body
            )}
        </div>
    );
};

/** Maps element names to neon accent colors */
const ELEMENT_COLORS: Record<string, string> = {
    fire: '#ff3333',
    water: '#3399ff',
    nature: '#33cc33',
    earth: '#996633',
    air: '#87ceeb',
    ice: '#00ffff',
    light: '#ffff80',
    dark: '#8000ff',
    none: '#888888',
};

interface MingmingUnitProps {
    entity: IBattleEntity;
    isEnemy?: boolean;
    isSelected: boolean;
    isTargeted: boolean;
    battleState: IBattleState;
    selectedCardId?: string | null;
    selectedSourceId?: string | null;
    isHoveredTarget?: boolean;
    onClick: () => void;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
    procs?: { id: number; text: string }[]; // New prop for floating text
    /** Event-driven combat FX (floats, hit flash, pulses, lunge) from useBattleVfx. */
    fx?: UnitFx;
}

const MingmingUnit: React.FC<MingmingUnitProps> = ({
    entity,
    isEnemy = false,
    isSelected,
    isTargeted,
    battleState,
    selectedCardId,
    selectedSourceId,
    isHoveredTarget,
    onClick,
    onMouseEnter,
    onMouseLeave,
    procs = [],
    fx,
}) => {
    const controls = useAnimation();
    const [deathGlitch, setDeathGlitch] = React.useState(false);
    const [levelUpVisible, setLevelUpVisible] = React.useState(false);
    const [showOSTooltip, setShowOSTooltip] = React.useState(false);
    const [showIntentTooltip, setShowIntentTooltip] = React.useState(false);
    const osIconRef = React.useRef<HTMLDivElement>(null);
    const intentIconRef = React.useRef<HTMLDivElement>(null);
    const prevHpRef = React.useRef(entity.currentHp);
    const prevLevelRef = React.useRef(entity.level);
    // Pending timeouts, cleared on unmount so we never setState on an unmounted component.
    const pendingTimeoutsRef = React.useRef<ReturnType<typeof setTimeout>[]>([]);

    useEffect(() => {
        const timeouts = pendingTimeoutsRef.current;
        return () => {
            timeouts.forEach(clearTimeout);
        };
    }, []);

    // Death FX: 'system crash' glitch on the frame HP hits 0.
    // (Floating damage numbers + shakes are event-driven via the fx prop now.)
    useEffect(() => {
        if (entity.currentHp <= 0 && prevHpRef.current > 0) {
            // The .hud-death-glitch CSS animation degrades to an opacity pulse
            // under prefers-reduced-motion (media query in index.css).
            setDeathGlitch(true);
            const timeout = setTimeout(() => setDeathGlitch(false), 500);
            pendingTimeoutsRef.current.push(timeout);
        }
        prevHpRef.current = entity.currentHp;
    }, [entity.currentHp]);

    // Hit feedback: shake scaled by damage fraction (fx.hitIntensity 0..1).
    const hitKey = fx?.hitKey ?? 0;
    const hitIntensity = fx?.hitIntensity ?? 0;
    useEffect(() => {
        if (!hitKey) return;
        if (prefersReducedMotion()) {
            // Reduced motion: a simple opacity dip instead of a shake.
            controls.start({ x: 0, opacity: [1, 0.6, 1], transition: { duration: 0.25 } });
            return;
        }
        const amp = 3 + 8 * hitIntensity;
        controls.start({
            x: [0, -amp, amp, -amp * 0.5, amp * 0.5, 0],
            transition: { duration: 0.18 + 0.1 * hitIntensity },
        });
    }, [hitKey, hitIntensity, controls]);

    // Attack anticipation: quick lunge toward the enemy side when this unit acts.
    const lungeKey = fx?.lungeKey ?? 0;
    useEffect(() => {
        if (!lungeKey || prefersReducedMotion()) return;
        const dir = isEnemy ? -1 : 1;
        controls.start({
            x: [0, dir * 16, 0],
            transition: { duration: 0.24, times: [0, 0.35, 1], ease: 'easeOut' },
        });
    }, [lungeKey, isEnemy, controls]);

    // Level-up pop
    useEffect(() => {
        if (entity.level > prevLevelRef.current) {
            setLevelUpVisible(true);
            const timeout = setTimeout(() => setLevelUpVisible(false), 3000);
            pendingTimeoutsRef.current.push(timeout);
        }
        prevLevelRef.current = entity.level;
    }, [entity.level]);

    const currentLevelExp = getExpForLevel(entity.level);
    const nextLevelExp = getExpForLevel(entity.level + 1);
    const xpProgress = ((entity.experience - currentLevelExp) / (nextLevelExp - currentLevelExp)) * 100;

    const isDead = entity.currentHp <= 0;

    // Damage Preview Logic — always computed from the actually SELECTED source unit.
    // Shows nothing when no living source is selected or it can't play the card.
    let preview: DamagePreview | null = null;
    if (isHoveredTarget && selectedCardId) {
        preview = computeDamagePreview(battleState, selectedSourceId, selectedCardId, entity.id);
    }
    const previewDamage = preview?.damage ?? 0;

    const hpPercent = Math.max(0, (entity.currentHp / entity.maxHp) * 100);
    const previewHpPercent = Math.max(0, ((entity.currentHp - previewDamage) / entity.maxHp) * 100);

    // Energy UI Logic: Over-energy support (e.g. Energized carryover shows 4/3).
    // When overflowing, the track represents currentEnergy: a normal segment up to
    // maxEnergy plus a bright "energized" overflow segment for the surplus.
    const overEnergy = entity.currentEnergy > entity.maxEnergy;
    const ENERGY_COLOR = '#ffcc00'; // gold — normal energy
    const OVERFLOW_COLOR = '#00e5ff'; // energized cyan — overflow portion
    const energyBasePercent = overEnergy
        ? (entity.maxEnergy / entity.currentEnergy) * 100
        : (entity.currentEnergy / entity.maxEnergy) * 100;
    const elKey = entity.primaryElement.toLowerCase();
    const accent = ELEMENT_COLORS[elKey] ?? ELEMENT_COLORS.none;

    // Intent Prediction Logic
    let predictedDamage = 0;
    let targetName = 'Unknown Target';

    if (isEnemy && entity.currentIntent && battleState) {
        const alivePlayers = battleState.playerParty.filter(e => e.currentHp > 0);
        if (alivePlayers.length > 0) {
            // Target is typically lowest HP player
            const sortedPlayers = [...alivePlayers].sort((a, b) => {
                if (a.currentHp !== b.currentHp) return a.currentHp - b.currentHp;
                return a.id.localeCompare(b.id);
            });
            const target = sortedPlayers[0];
            targetName = target.name;

            entity.currentIntent.actions.forEach(act => {
                if (act.type === 'ATTACK') {
                    const dummyProgram = { element: (act as any).element } as any;
                    const dmg = calculateDamage(entity, target, dummyProgram, (act as any).power, battleState);
                    const hitCount = (act as any).count || 1;
                    predictedDamage += Math.floor(dmg * hitCount);
                }
            });
        }
    }

    // Chunky HP segments — 5 segments
    const HP_SEGMENTS = 5;

    const getHpColor = (percent: number) => {
        if (percent < 25) return '#ef4444';
        if (percent < 50) return '#ff8c00';
        return '#22c55e';
    };

    return (
        <motion.div
            className={`hud-card ${isSelected ? 'hud-selected' : ''} ${isTargeted ? 'hud-targeted' : ''} ${isDead ? 'hud-dead' : ''} ${deathGlitch ? 'hud-death-glitch' : ''}`}
            data-side={isEnemy ? 'enemy' : 'player'}
            animate={controls}
            whileHover={{ scale: 1.05 }}
            onClick={onClick}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            style={{
                // Mirror layout for enemies
                flexDirection: isEnemy ? 'row-reverse' : 'row',
            }}
        >
            {/* ── Sidebar: Art + Level ── */}
            <div className="hud-sidebar" style={{ background: `linear-gradient(180deg, ${accent}55 0%, ${accent}22 100%)` }}>
                {entity.artReference ? (
                    <motion.img
                        src={new URL(`../../assets/battleArt/mingming/${entity.artReference}`, import.meta.url).href}
                        alt={entity.name}
                        className="hud-art"
                        style={{ transform: isEnemy ? 'scaleX(-1)' : 'none' }}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.4 }}
                    />
                ) : (
                    <div className="hud-art-placeholder" style={{ color: accent }}>
                        {entity.primaryElement[0]}
                    </div>
                )}
                <div className="hud-level-overlay">LV.{entity.level}</div>
            </div>

            {/* ── Main Body ── */}
            <div className="hud-body">
                {/* Top row: Name + Status badges */}
                <div className="hud-top-row">
                    <span
                        className="hud-element-dot"
                        style={{ background: accent, color: readableTextOn(accent), textShadow: badgeTextShadow(readableTextOn(accent)) }}
                        title={entity.primaryElement}
                    >
                        {entity.primaryElement[0]}
                    </span>
                    <span className="hud-name">{entity.name.toUpperCase()}</span>

                    {/* Intent Indicator (Enemies Only) */}
                    {isEnemy && entity.currentIntent && (
                        <div
                            className="hud-intent-container"
                            style={{ marginLeft: 'auto', position: 'relative' }}
                            onMouseEnter={() => setShowIntentTooltip(true)}
                            onMouseLeave={() => setShowIntentTooltip(false)}
                            ref={intentIconRef}
                        >
                            <motion.div
                                className="hud-intent-wrapper"
                                initial={{ scale: 0, opacity: 0, y: 10 }}
                                animate={{ scale: 1, opacity: 1, y: [0, -4, 0] }}
                                transition={{
                                    y: {
                                        duration: 2,
                                        repeat: Infinity,
                                        repeatType: "reverse",
                                        ease: "easeInOut"
                                    },
                                    scale: { duration: 0.3 },
                                    opacity: { duration: 0.3 }
                                }}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0 0.25rem' }}
                            >
                                <span style={{ fontSize: '1.2rem', textShadow: '0 0 5px rgba(0,0,0,0.5)' }}>{
                                    entity.currentIntent.intentType === 'Attack' ? '⚔️' :
                                        entity.currentIntent.intentType === 'Defend' ? '🛡️' :
                                            entity.currentIntent.intentType === 'Debuff' ? '🧪' : '🌟'
                                }</span>
                                {predictedDamage > 0 && <span style={{ color: '#ff4444', fontWeight: 'bold', fontSize: '1.1rem', textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000' }}>{predictedDamage}</span>}
                            </motion.div>

                            {showIntentTooltip && createPortal(
                                <div
                                    className="os-tooltip-portal"
                                    style={intentIconRef.current ? (() => {
                                        const rect = intentIconRef.current.getBoundingClientRect();
                                        const isRightSide = rect.left > window.innerWidth / 2;
                                        return {
                                            position: 'fixed',
                                            left: isRightSide ? 'auto' : rect.right + 15,
                                            right: isRightSide ? (window.innerWidth - rect.left) + 15 : 'auto',
                                            top: rect.top,
                                            transform: 'translateY(-30%)'
                                        };
                                    })() : {}}
                                >
                                    <div className="tooltip-header">
                                        <span className="tooltip-os-name">{entity.currentIntent.name}</span>
                                    </div>
                                    <div className="tooltip-divider" />
                                    <div className="tooltip-body">
                                        {entity.currentIntent.actions.map((act, idx) => {
                                            if (act.type === 'ATTACK') return <div key={idx}>Deals {predictedDamage} damage.</div>;
                                            if (act.type === 'STATUS') return <div key={idx}>Applies {act.stacks} {(act as any).status}.</div>;
                                            if (act.type === 'HEAL') return <div key={idx}>Heals for {act.power}.</div>;
                                            return null;
                                        })}
                                        <div style={{ marginTop: '0.5rem', color: '#888', fontStyle: 'italic' }}>
                                            Targeting: {targetName}
                                        </div>
                                    </div>
                                    <div className="tooltip-footer">TELEMETRY PREDICTION</div>
                                </div>,
                                document.body
                            )}
                        </div>
                    )}

                    {entity.activeOS && (() => {
                        const behavior = getOSBehavior(entity.activeOS);
                        return (
                            <div
                                ref={osIconRef}
                                className="hud-os-icon-container"
                                onMouseEnter={() => setShowOSTooltip(true)}
                                onMouseLeave={() => setShowOSTooltip(false)}
                            >
                                <span className="hud-os-icon">💾</span>
                                <span className="hud-os-version">{entity.activeOS.includes('_v2') ? 'V2' : 'V1'}</span>

                                {showOSTooltip && createPortal(
                                    <div
                                        className="os-tooltip-portal"
                                        style={osIconRef.current ? (() => {
                                            const rect = osIconRef.current.getBoundingClientRect();
                                            const isRightSide = rect.left > window.innerWidth / 2;
                                            return {
                                                position: 'fixed',
                                                left: isRightSide ? 'auto' : rect.right + 15,
                                                right: isRightSide ? (window.innerWidth - rect.left) + 15 : 'auto',
                                                top: rect.top,
                                                transform: 'translateY(-30%)'
                                            };
                                        })() : {}}
                                    >
                                        <div className="tooltip-header">
                                            <span className="tooltip-os-name">{behavior?.name}</span>
                                            <span className="tooltip-os-version">{entity.activeOS.includes('_v2') ? 'v2.0' : 'v1.0'}</span>
                                        </div>
                                        <div className="tooltip-divider" />
                                        <div className="tooltip-body">
                                            {behavior?.description}
                                        </div>
                                        <div className="tooltip-footer">TECHNICAL READOUT // SECTOR 0</div>
                                    </div>,
                                    document.body
                                )}
                            </div>
                        );
                    })()}
                    <div className="hud-status-badges">
                        {entity.statusEffects.map((se, i) => (
                            <StatusBadge key={se.id || `${se.type}-${i}`} type={se.type} stacks={se.stacks} />
                        ))}
                    </div>
                </div>

                {/* Daemons Row */}
                {entity.daemons && entity.daemons.length > 0 && (
                    <div className="hud-daemons-row">
                        {entity.daemons.map((daemon, idx) => {
                            if (!daemon.id) {
                                console.warn(`[MingmingUnit] Daemon at index ${idx} on ${entity.name} has an empty ID!`);
                            }
                            const data = GetProgramData(daemon.dataId);
                            return (
                                <div
                                    key={daemon.id || `daemon-${idx}`}
                                    className="hud-daemon-tag"
                                    title={data.description}
                                >
                                    <span className="hud-daemon-icon">⚙️</span>
                                    <span className="hud-daemon-name">{data.name}</span>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* HP Row */}
                <div className="hud-bar-row">
                    <span className="hud-bar-label">HP</span>
                    <div className="hud-hp-track">
                        {/* Segmented overlay */}
                        <div className="hud-hp-segments">
                            {Array.from({ length: HP_SEGMENTS - 1 }).map((_, i) => (
                                <div
                                    key={i}
                                    className="hud-hp-segment-line"
                                    style={{ left: `${((i + 1) / HP_SEGMENTS) * 100}%` }}
                                />
                            ))}
                        </div>
                        {/* Preview Damage Bar */}
                        {previewDamage > 0 && (
                            <div
                                className="hud-hp-preview"
                                style={{
                                    width: `${hpPercent}%`,
                                    backgroundColor: 'rgba(255, 255, 255, 0.3)',
                                    position: 'absolute',
                                    left: 0,
                                    top: 0,
                                    bottom: 0,
                                    zIndex: 1
                                }}
                            />
                        )}
                        {/* HP fill */}
                        <motion.div
                            className="hud-hp-fill"
                            initial={{ width: 0 }}
                            animate={{ width: `${previewDamage > 0 ? previewHpPercent : hpPercent}%` }}
                            style={{ backgroundColor: getHpColor(hpPercent) }}
                        />
                    </div>
                    <span className="hud-hp-text">{entity.currentHp}/{entity.maxHp} HP {previewDamage > 0 && <span style={{ color: '#ff4444' }}>(-{previewDamage})</span>}</span>
                </div>

                {/* Elemental breakdown of the hover preview: STAB / type effectiveness / Sharp scaling */}
                {preview && previewDamage > 0 && (preview.stab || preview.effectiveness !== 1 || preview.sharpBonus > 0) && (
                    <div className="hud-preview-tags">
                        {preview.stab && (
                            <span
                                className="hud-preview-chip"
                                style={{ color: getElementAccent(preview.element), borderColor: getElementAccent(preview.element) }}
                            >
                                ×1.5 STAB
                            </span>
                        )}
                        {preview.sharpBonus > 0 && (
                            <span className="hud-preview-chip">
                                +{preview.sharpBonus} SHARP
                            </span>
                        )}
                        {preview.effectiveness > 1 && (
                            <span className="hud-preview-chip hud-preview-chip-super">
                                SUPER EFFECTIVE ×{formatMultiplier(preview.effectiveness)}
                            </span>
                        )}
                        {preview.effectiveness < 1 && (
                            <span className="hud-preview-chip hud-preview-chip-weak">
                                NOT VERY EFFECTIVE ×{formatMultiplier(preview.effectiveness)}
                            </span>
                        )}
                    </div>
                )}

                {/* Energy Row */}
                <div className="hud-bar-row">
                    <span className="hud-bar-label">E</span>
                    <div className="hud-energy-row">
                        <div className="hud-energy-track">
                            <motion.div
                                className="hud-energy-fill"
                                initial={{ width: 0 }}
                                animate={{ width: `${energyBasePercent}%` }}
                                style={{ backgroundColor: ENERGY_COLOR }}
                            />
                            {overEnergy && (
                                <motion.div
                                    className="hud-energy-fill"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${100 - energyBasePercent}%` }}
                                    style={{
                                        left: `${energyBasePercent}%`,
                                        backgroundColor: OVERFLOW_COLOR,
                                        boxShadow: `0 0 10px ${OVERFLOW_COLOR}`
                                    }}
                                />
                            )}
                        </div>
                        <span className="hud-energy-text" style={{ color: ENERGY_COLOR }}>
                            <span style={overEnergy ? {
                                color: OVERFLOW_COLOR,
                                fontWeight: 'bold',
                                textShadow: `0 0 6px ${OVERFLOW_COLOR}`
                            } : undefined}>
                                {entity.currentEnergy}
                            </span>
                            {' / '}{entity.maxEnergy} EP
                        </span>
                    </div>
                </div>

                {/* XP Row */}
                <div className="hud-bar-row">
                    <span className="hud-bar-label">XP</span>
                    <div className="hud-xp-track">
                        <motion.div
                            className="hud-xp-fill"
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, Math.max(0, xpProgress))}%` }}
                            transition={{ duration: 0.8, delay: 0.3 }}
                        />
                    </div>
                </div>
            </div>

            {/* ── Transient overlays (remount on key change to replay) ── */}
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

            {/* ── Floating FX ── */}
            <AnimatePresence>
                {(fx?.floats ?? []).map(f => (
                    <motion.div
                        key={f.id}
                        className={`hud-float hud-float-${f.kind}`}
                        style={{ color: f.color, left: `calc(50% + ${(f.slot - 2.5) * 15}px)` }}
                        initial={{ opacity: 0, y: 6, scale: f.kind === 'crit' ? 0.6 : 0.7 }}
                        animate={{
                            opacity: [0, 1, 1, 0],
                            y: prefersReducedMotion() ? -18 : -86,
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
                {isDead && (
                    <motion.div
                        key="terminated-stamp"
                        className="hud-terminated-wrap"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2, delay: deathGlitch ? 0.35 : 0 }}
                    >
                        <motion.span
                            className="hud-terminated-stamp"
                            initial={{ scale: 1.7, rotate: -14 }}
                            animate={{ scale: 1, rotate: -8 }}
                            transition={{ duration: 0.25, ease: 'easeOut', delay: deathGlitch ? 0.35 : 0 }}
                        >
                            ☠ TERMINATED
                        </motion.span>
                    </motion.div>
                )}
                {levelUpVisible && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.5, y: -10 }}
                        animate={{ opacity: 1, scale: 1.2, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="hud-level-up"
                    >
                        LEVEL UP!
                    </motion.div>
                )}
                {procs.map((proc, idx) => {
                    if (!proc.id) {
                        console.warn(`[MingmingUnit] Proc at index ${idx} on ${entity.name} has an empty ID!`);
                    }
                    return (
                        <motion.div
                            key={proc.id || `proc-${idx}`}
                            initial={{ opacity: 0, y: 0, scale: 0.5 }}
                            animate={{ opacity: 1, y: -120, scale: 1.5 }}
                            exit={{ opacity: 0 }}
                            className="hud-proc-text"
                        >
                            {proc.text}
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </motion.div>
    );
};

export default MingmingUnit;
