import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAnchoredRect } from '../hooks/useAnchoredRect';
import { motion, useAnimation, AnimatePresence } from 'framer-motion';
import type { IBattleEntity, StatusType } from '../../engine/types';
import type { IBattleState } from '../../engine/types';
import { getOSBehavior } from '../../engine/data/firmwareRegistry';
import { GetProgramData } from '../../engine/data/programRegistry';
import { calculateDamage } from '../../engine/combatUtils';
import { statusGlossary, STATUS_COLORS } from '../../engine/data/statusGlossary';
import { computeDamagePreview, type DamagePreview } from '../utils/damagePreview';
import { targetVerdict } from '../utils/targeting';
import { readableTextOn, badgeTextShadow, getElementAccent } from '../utils/contrastText';
import { formatMultiplier } from './elementMatchups';
import { prefersReducedMotion } from '../utils/motionPrefs';
import type { UnitFx } from '../hooks/useBattleVfx';
import { FxTransientOverlays, FxFloats, TerminatedStamp } from './UnitFxLayer';

/**
 * Status badge with a hover tooltip explaining the mechanic.
 * Rendered through a portal (same pattern as the OS/intent tooltips)
 * so parent overflow never clips it.
 */
const StatusBadge: React.FC<{ type: StatusType; stacks: number }> = ({ type, stacks }) => {
    const [showTooltip, setShowTooltip] = React.useState(false);
    // Ticket 55: measured after layout rather than read during render — see `useAnchoredRect`.
    const { ref: badgeRef, rect } = useAnchoredRect<HTMLDivElement>(showTooltip);
    const info = statusGlossary[type];
    const color = STATUS_COLORS[type] ?? '#ccc';
    // BarkShield stacks are now a %maxHp float (docs/power_curve_spec.md rev 3) that
    // decays by a multiplicative 20%/turn, so it won't land on a whole number most
    // turns — round just for display, the stored value stays precise.
    const displayStacks = Math.round(stacks * 10) / 10;

    return (
        <div
            ref={badgeRef}
            className="hud-status-badge"
            style={{ borderColor: color, color }}
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
        >
            <span className="hud-status-icon">{info?.icon ?? '✦'}</span>
            {stacks > 1 && <span className="hud-status-stacks">×{displayStacks}</span>}

            {showTooltip && info && rect !== null && createPortal(
                <div
                    className="os-tooltip-portal"
                    style={(() => {
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
                    })()}
                >
                    <div className="tooltip-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
                        <span className="tooltip-os-name" style={{ color }}>{info.name.toUpperCase()}</span>
                        <span style={{ color, opacity: 0.85, fontSize: '0.7rem', fontWeight: 700 }}>×{displayStacks}</span>
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

/**
 * HOW MANY ENERGY PIPS FIT ON A HUD CARD — ticket 22, and it is arithmetic rather than taste.
 *
 * The ticket asks for per-member energy to stay legible with **six entities on a 1280×800 frame**,
 * and to "build the arithmetic into the CSS rather than eyeballing it". Here is the arithmetic that
 * produced this number, in the units the stylesheet actually uses:
 *
 *   `.hud-card`   is 300px wide, of which `.hud-sidebar` takes a fixed 80px.
 *   `.hud-body`   has 12px of horizontal padding each side  →  300 − 80 − 24 = **196px** of content.
 *   `.hud-bar-row` spends 16px on the `E` label + a 6px gap →  174px left.
 *   `.hud-energy-row` spends an 8px gap + the 40px numeric readout (`3 / 3 EP`, which stays visible
 *                    whatever happens to the pips, because it is the un-hidden number).
 *
 *   That leaves **126px** for the pips themselves. At the row's 0.6rem font size a pip is 1.6em =
 *   15.36px and a gap is 0.34em = 3.26px, so N pips cost N×15.36 + (N−1)×3.26: six cost 108.6px and
 *   **seven cost 127.1px**. Six is the ceiling, by a pixel, and that is a measured edge rather than
 *   a round number someone liked.
 *
 * Six is comfortably above what the game produces: species Energy runs 1–3, one relic adds +1, so a
 * normal maximum is 4. Only `Energized` carryover (which pushes `currentEnergy` past `maxEnergy`)
 * can exceed it. Past the ceiling the row switches to the COMPACT form — the continuous bar it used
 * before this ticket — rather than wrapping to a second line. Wrapping was the other candidate and
 * it loses on the vertical budget, which is the tighter one:
 *
 *   `.stage-area` gets 800 − 265 (`.console-area`) = **535px**.
 *   A party column spends 100px of `padding-top` + 3 × 115px cards + 2 × 30px gaps = **505px**.
 *
 * 30px of slack for the whole column. A wrapped energy row costs about 10px per card, so three
 * wrapped members would spend all of it and a fourth pixel of anything would push the column off the
 * frame. A compact form costs nothing and keeps every card exactly 115px, which is what makes the
 * six-entity layout provable instead of hopeful. Ticket 37 owns the general Steam Deck pass; this is
 * only the energy row.
 */
export const ENERGY_PIP_BUDGET = 6;

/** Ticket 90: human labels for the post-damage scalings the preview now shows. */
const SCALING_LABEL: Record<string, string> = {
    CARDS_PLAYED: 'CARDS PLAYED',
    CARDS_DRAWN: 'CARDS DRAWN',
    CARDS_DRAWN_TRIGGERED: 'TRIGGERED DRAWS',
    CARDS_DISCARDED: 'CARDS DISCARDED',
    ENERGY_SPENT: 'ENERGY SPENT',
    ENERGY_SPENT_SQUARED: 'ENERGY SPENT²',
    ELEMENT_PLAYED: 'ELEMENT PLAYS',
    STATUS_COUNT: 'TARGET STATUSES',
    BURN_TIMES_ENERGY: 'BURN × ENERGY',
};

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
    const [showOSTooltip, setShowOSTooltip] = React.useState(false);
    const [showIntentTooltip, setShowIntentTooltip] = React.useState(false);
    const osIconRef = React.useRef<HTMLDivElement>(null);
    const intentIconRef = React.useRef<HTMLDivElement>(null);
    const prevHpRef = React.useRef(entity.currentHp);
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
    // Ticket 22: pips, not a proportional bar. Six entities each spending Energy independently is
    // the state a 3v3 turn is planned against, and "roughly two-thirds of a 6px bar" is not a number
    // a player can plan with — a countable pip is. `ENERGY_PIP_BUDGET` carries the fit arithmetic.
    // The track has to cover the OVERFLOW too, or an Energized 4/3 would render as a full 3.
    const energyPipCount = Math.max(entity.maxEnergy, entity.currentEnergy);
    const energyIsCompact = energyPipCount > ENERGY_PIP_BUDGET;
    const elKey = entity.primaryElement.toLowerCase();
    const accent = ELEMENT_COLORS[elKey] ?? ELEMENT_COLORS.none;

    /*
     * TICKET 22 — TARGET VALIDITY IS VISIBLE BEFORE THE PLAYER COMMITS.
     *
     * With one unit a side the only illegal drop was "that card does not go there", and the player
     * found out by dropping it. With six entities on screen the question is asked six ways at once,
     * so the answer has to be on the units rather than in the outcome. `targetVerdict` is the same
     * predicate `BattleArena` drops against (see `utils/targeting.ts`), and its refusals are
     * sentences — the convention tickets 13, 14 and 20 set, and the one `MacroRack` states outright:
     * a silently inert control is indistinguishable from a bug.
     */
    // Looked up via the hand rather than by id straight into the registry: `GetProgramData('')`
    // warns and traces, and a selection can outlive the card that was played out of it.
    const selectedCard = selectedCardId
        ? battleState.playerDeck.hand.find(c => c.id === selectedCardId)
        : undefined;
    const selectedCardData = selectedCard ? GetProgramData(selectedCard.dataId) : null;
    const caster = selectedSourceId
        ? battleState.playerParty.find(p => p.id === selectedSourceId) ?? null
        : null;
    const verdict = selectedCardData
        ? targetVerdict(selectedCardData, entity, isEnemy, caster)
        : null;

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
            className={`hud-card ${isSelected ? 'hud-selected' : ''} ${isTargeted ? 'hud-targeted' : ''} ${isDead ? 'hud-dead' : ''} ${deathGlitch ? 'hud-death-glitch' : ''}${verdict ? (verdict.ok ? ' hud-target-legal' : ' hud-target-illegal') : ''}`}
            data-side={isEnemy ? 'enemy' : 'player'}
            // The refusal rides the frame itself so it is reachable by hovering the unit the player
            // is already pointing at, rather than only from wherever the card happens to be.
            title={verdict?.reason ?? undefined}
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
            {/*
              * The visible half of the verdict. A ✓ marks a unit this card can actually land on;
              * a refusal prints its own sentence, which is the clause ticket 22 borrows from 13/14/20
              * — "make the invalid case SAY WHY rather than being inert".
              */}
            {verdict && (
                verdict.ok
                    ? <div className="hud-target-flag legal" data-testid={`target-ok-${entity.id}`}>✓ TARGET</div>
                    : <div className="hud-target-flag illegal" data-testid={`target-no-${entity.id}`}>{verdict.reason}</div>
            )}
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
                {preview && previewDamage > 0 && (preview.stab || preview.effectiveness !== 1 || preview.sharpBonus > 0 || preview.scalingMultiplier !== 1 || preview.hitCount > 1 || preview.lethal) && (
                    <div className="hud-preview-tags">
                        {preview.stab && (
                            <span
                                className="hud-preview-chip"
                                style={{ color: getElementAccent(preview.element), borderColor: getElementAccent(preview.element) }}
                            >
                                ×1.5 STAB
                            </span>
                        )}
                        {/* TICKET 104: the multi-hit chip. The number above is the TOTAL the
                            target loses - `blood_rite` reads 8, not "4" and then a surprise
                            second 4. This says how that total arrives, which is the half of
                            the information Henry was missing when he wrote "it did 5 damage +
                            another 5 dmg". */}
                        {preview.hitCount > 1 && (
                            <span className="hud-preview-chip">
                                ×{preview.hitCount} HITS
                            </span>
                        )}
                        {preview.lethal && (
                            <span className="hud-preview-chip hud-preview-chip-lethal">
                                LETHAL
                            </span>
                        )}
                        {preview.sharpBonus > 0 && (
                            <span className="hud-preview-chip">
                                +{preview.sharpBonus} SHARP
                            </span>
                        )}
                        {/* Ticket 90: the turn-history multiplier, named. A `stampede` reading
                            "x4 CARDS PLAYED" explains its own number; before this the preview
                            silently showed the card's printed power. */}
                        {preview.scalingMultiplier !== 1 && (
                            <span className="hud-preview-chip">
                                ×{formatMultiplier(preview.scalingMultiplier)} {SCALING_LABEL[preview.scalingKind ?? ''] ?? 'SCALING'}
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

                {/* Energy Row — pips up to ENERGY_PIP_BUDGET, the compact bar past it */}
                <div className="hud-bar-row">
                    <span className="hud-bar-label">E</span>
                    <div className="hud-energy-row">
                        {energyIsCompact ? (
                            <div className="hud-energy-track" data-testid={`energy-bar-${entity.id}`}>
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
                        ) : (
                            <div
                                className="hud-energy-pips"
                                data-testid={`energy-pips-${entity.id}`}
                                role="img"
                                aria-label={`${entity.name} energy ${entity.currentEnergy} of ${entity.maxEnergy}`}
                            >
                                {Array.from({ length: energyPipCount }).map((_, i) => {
                                    const filled = i < entity.currentEnergy;
                                    // A pip past maxEnergy is Energized carryover, and it is worth
                                    // a distinct colour rather than a longer gold run: it is the
                                    // one Energy a player can lose by ending the turn.
                                    const isOverflow = i >= entity.maxEnergy;
                                    return (
                                        <span
                                            key={i}
                                            className={`hud-energy-pip${filled ? '' : ' empty'}${filled && isOverflow ? ' overflow' : ''}`}
                                        />
                                    );
                                })}
                            </div>
                        )}
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

            </div>

            {/* ── Transient overlays (shared with the battle stage via UnitFxLayer) ── */}
            <FxTransientOverlays fx={fx} />

            {/* ── Floating FX (shared with the battle stage via UnitFxLayer) ── */}
            <FxFloats fx={fx} />
            <TerminatedStamp visible={isDead} glitching={deathGlitch} />
            <AnimatePresence>
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
