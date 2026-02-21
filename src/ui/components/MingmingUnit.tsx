import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, useAnimation, AnimatePresence } from 'framer-motion';
import type { IBattleEntity } from '../../engine/types';
import type { IBattleState } from '../../engine/types';
import { getExpForLevel } from '../../engine/types';
import { getOSBehavior } from '../../engine/data/firmwareRegistry';
import { GetProgramData } from '../../engine/data/programRegistry';
import { calculateDamage } from '../../engine/combatUtils';

const STATUS_ICONS: Record<string, { icon: string; color: string }> = {
    Burn: { icon: '🔥', color: '#ff6633' },
    Poison: { icon: '☠️', color: '#88cc22' },
    Stunned: { icon: '⚡', color: '#ffcc00' },
    Asleep: { icon: '💤', color: '#8888ff' },
    Dazed: { icon: '💫', color: '#cc88ff' },
    Weakened: { icon: '⬇️', color: '#ff8888' },
    Strengthened: { icon: '⬆️', color: '#44ddff' },
    Sharp: { icon: '🛡️', color: '#aaaaaa' },
    Regen: { icon: '💚', color: '#22cc88' },
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
    isSelected?: boolean;
    isTargeted?: boolean;
    previewDamage?: number;
    onClick?: () => void;
    procs?: { id: number; text: string }[]; // New prop for floating text
    battleState?: IBattleState;
}

const MingmingUnit: React.FC<MingmingUnitProps> = ({
    entity,
    isEnemy = false,
    isSelected = false,
    isTargeted = false,
    previewDamage = 0,
    onClick,
    procs = [],
    battleState
}) => {
    const controls = useAnimation();
    const [damageSplatters, setDamageSplatters] = React.useState<{ id: number; amount: number }[]>([]);
    const [levelUpVisible, setLevelUpVisible] = React.useState(false);
    const [showOSTooltip, setShowOSTooltip] = React.useState(false);
    const [showIntentTooltip, setShowIntentTooltip] = React.useState(false);
    const osIconRef = React.useRef<HTMLDivElement>(null);
    const intentIconRef = React.useRef<HTMLDivElement>(null);
    const prevHpRef = React.useRef(entity.currentHp);
    const prevLevelRef = React.useRef(entity.level);

    // Damage shake + splatter
    useEffect(() => {
        if (entity.currentHp < prevHpRef.current) {
            const damage = prevHpRef.current - entity.currentHp;
            const id = Date.now();
            setDamageSplatters(prev => [...prev, { id, amount: damage }]);
            controls.start({ x: [0, -8, 8, -4, 4, 0], transition: { duration: 0.35 } });
            setTimeout(() => setDamageSplatters(prev => prev.filter(s => s.id !== id)), 1000);
        }
        prevHpRef.current = entity.currentHp;
    }, [entity.currentHp, controls]);

    // Level-up pop
    useEffect(() => {
        if (entity.level > prevLevelRef.current) {
            setLevelUpVisible(true);
            setTimeout(() => setLevelUpVisible(false), 3000);
        }
        prevLevelRef.current = entity.level;
    }, [entity.level]);

    const currentLevelExp = getExpForLevel(entity.level);
    const nextLevelExp = getExpForLevel(entity.level + 1);
    const xpProgress = ((entity.experience - currentLevelExp) / (nextLevelExp - currentLevelExp)) * 100;

    const hpPercent = (entity.currentHp / entity.maxHp) * 100;
    const previewPercent = Math.max(0, ((entity.currentHp - previewDamage) / entity.maxHp) * 100);
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

    // Energy pips (chunky bars)
    const energyPips: React.ReactNode[] = [];
    for (let i = 0; i < entity.maxEnergy; i++) {
        energyPips.push(
            <div
                key={i}
                className={`hud-energy-pip ${i >= entity.currentEnergy ? 'empty' : ''}`}
            />
        );
    }

    return (
        <motion.div
            className={`hud-card ${isSelected ? 'hud-selected' : ''} ${isTargeted ? 'hud-targeted' : ''}`}
            data-side={isEnemy ? 'enemy' : 'player'}
            animate={controls}
            whileHover={{ scale: 1.02 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            onClick={onClick}
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
                        style={{ background: accent }}
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
                        {entity.statusEffects.map((se, i) => {
                            const info = STATUS_ICONS[se.type] || { icon: '✦', color: '#ccc' };
                            return (
                                <div
                                    key={`${se.type}-${i}`}
                                    className="hud-status-badge"
                                    style={{ borderColor: info.color, color: info.color }}
                                    title={`${se.type} (${se.stacks} stacks)`}
                                >
                                    <span className="hud-status-icon">{info.icon}</span>
                                    {se.stacks > 1 && <span className="hud-status-stacks">×{se.stacks}</span>}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Daemons Row */}
                {entity.daemons && entity.daemons.length > 0 && (
                    <div className="hud-daemons-row">
                        {entity.daemons.map((daemon) => {
                            const data = GetProgramData(daemon.dataId);
                            return (
                                <div
                                    key={daemon.id}
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
                        {/* Preview damage layer */}
                        {previewDamage > 0 && (
                            <div
                                className="hud-hp-preview"
                                style={{
                                    left: `${previewPercent}%`,
                                    width: `${hpPercent - previewPercent}%`,
                                }}
                            />
                        )}
                        {/* HP fill */}
                        <motion.div
                            className="hud-hp-fill"
                            style={{ backgroundColor: hpPercent < 25 ? '#ef4444' : hpPercent < 50 ? '#ff8c00' : '#22c55e' }}
                            initial={{ width: `${hpPercent}%` }}
                            animate={{ width: `${hpPercent}%` }}
                            transition={{ duration: 0.6, ease: 'easeOut' }}
                        />
                    </div>
                    <span className="hud-hp-text">{entity.currentHp}/{entity.maxHp}</span>
                </div>

                {/* Energy Row */}
                <div className="hud-bar-row">
                    <span className="hud-bar-label">E</span>
                    <div className="hud-energy-row">{energyPips}</div>
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

            {/* ── Floating FX ── */}
            <AnimatePresence>
                {damageSplatters.map(s => (
                    <motion.div
                        key={s.id}
                        initial={{ opacity: 0, scale: 0.5, y: 0 }}
                        animate={{ opacity: 1, scale: 1.4, y: -80 }}
                        exit={{ opacity: 0 }}
                        className="hud-damage-splatter"
                    >
                        -{s.amount}
                    </motion.div>
                ))}
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
                {procs.map(proc => (
                    <motion.div
                        key={proc.id}
                        initial={{ opacity: 0, y: 0, scale: 0.5 }}
                        animate={{ opacity: 1, y: -120, scale: 1.5 }}
                        exit={{ opacity: 0 }}
                        className="hud-proc-text"
                    >
                        {proc.text}
                    </motion.div>
                ))}
            </AnimatePresence>
        </motion.div>
    );
};

export default MingmingUnit;
