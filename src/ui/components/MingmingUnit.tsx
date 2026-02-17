import React, { useEffect } from 'react';
import { motion, useAnimation, AnimatePresence } from 'framer-motion';
import type { IBattleEntity } from '../../engine/types';
import { getExpForLevel } from '../../engine/types';

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
}

const MingmingUnit: React.FC<MingmingUnitProps> = ({
    entity,
    isEnemy = false,
    isSelected = false,
    isTargeted = false,
    previewDamage = 0,
    onClick
}) => {
    const controls = useAnimation();
    const [damageSplatters, setDamageSplatters] = React.useState<{ id: number; amount: number }[]>([]);
    const [levelUpVisible, setLevelUpVisible] = React.useState(false);
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
            </AnimatePresence>
        </motion.div>
    );
};

export default MingmingUnit;
