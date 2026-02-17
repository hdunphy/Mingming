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
    const [damageSplatters, setDamageSplatters] = React.useState<{ id: number, amount: number }[]>([]);
    const [levelUpVisible, setLevelUpVisible] = React.useState(false);
    const prevHpRef = React.useRef(entity.currentHp);
    const prevLevelRef = React.useRef(entity.level);

    // Trigger damage effects when HP changes
    useEffect(() => {
        if (entity.currentHp < prevHpRef.current) {
            const damage = prevHpRef.current - entity.currentHp;
            const id = Date.now();

            // Add splatter
            setDamageSplatters(prev => [...prev, { id, amount: damage }]);

            // Shake animation
            controls.start({
                x: [0, -10, 10, -5, 5, 0],
                transition: { duration: 0.4 }
            });

            // Cleanup splatter after animation
            setTimeout(() => {
                setDamageSplatters(prev => prev.filter(s => s.id !== id));
            }, 1000);
        }
        prevHpRef.current = entity.currentHp;
    }, [entity.currentHp, controls]);

    // Level Up detection
    useEffect(() => {
        if (entity.level > prevLevelRef.current) {
            setLevelUpVisible(true);
            setTimeout(() => setLevelUpVisible(false), 3000);
        }
        prevLevelRef.current = entity.level;
    }, [entity.level]);

    const hpPercent = (entity.currentHp / entity.maxHp) * 100;
    const previewPercent = Math.max(0, ((entity.currentHp - previewDamage) / entity.maxHp) * 100);

    // XP Progress
    const currentLevelExp = getExpForLevel(entity.level);
    const nextLevelExp = getExpForLevel(entity.level + 1);
    const xpProgress = ((entity.experience - currentLevelExp) / (nextLevelExp - currentLevelExp)) * 100;

    // Generate energy pips
    const energyPips = [];
    for (let i = 0; i < entity.maxEnergy; i++) {
        energyPips.push(
            <div
                key={i}
                className={`energy-pip ${i >= entity.currentEnergy ? 'empty' : ''}`}
            />
        );
    }

    const elementColor = `var(--${entity.primaryElement.toLowerCase()})`;

    return (
        <motion.div
            className={`unit-card ${isSelected ? 'selected' : ''} ${isTargeted ? 'targeted' : ''}`}
            data-side={isEnemy ? 'enemy' : 'player'}
            animate={controls}
            whileHover={{ scale: 1.02 }}
            style={{
                borderTop: `4px solid ${elementColor}`,
                x: isSelected ? (isEnemy ? -20 : 20) : 0,
                display: 'flex',
                alignItems: 'stretch',
                gap: '12px',
                width: '320px', // Wider for horizontal layout
                padding: '12px'
            }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            onClick={onClick}
        >
            <AnimatePresence>
                {damageSplatters.map(s => (
                    <motion.div
                        key={s.id}
                        initial={{ opacity: 0, scale: 0.5, y: 0 }}
                        animate={{ opacity: 1, scale: 1.5, y: -100 }}
                        exit={{ opacity: 0 }}
                        className="damage-splatter"
                        style={{
                            position: 'absolute',
                            top: '20%',
                            left: '40%',
                            color: 'var(--hp-red)',
                            fontWeight: 900,
                            fontSize: '1.5rem',
                            textShadow: '0 0 10px rgba(0,0,0,0.8)',
                            pointerEvents: 'none',
                            zIndex: 1000
                        }}
                    >
                        -{s.amount}
                    </motion.div>
                ))}
                {levelUpVisible && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.5, y: -20 }}
                        animate={{ opacity: 1, scale: 1.2, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="level-up-pop"
                        style={{
                            position: 'absolute',
                            top: '10%',
                            left: '0',
                            width: '100%',
                            textAlign: 'center',
                            zIndex: 1100,
                            pointerEvents: 'none',
                            fontSize: '2rem',
                            letterSpacing: '2px',
                            background: 'linear-gradient(90deg, transparent, rgba(251, 191, 36, 0.2), transparent)'
                        }}
                    >
                        LEVEL UP!
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Left: Art Column */}
            <div style={{
                flex: '0 0 100px',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                position: 'relative',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.05)'
            }}>
                {entity.artReference && (
                    <motion.img
                        src={new URL(`../../assets/battleArt/mingming/${entity.artReference}`, import.meta.url).href}
                        alt={entity.name}
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                            filter: isEnemy ? 'drop-shadow(0 0 8px rgba(0,0,0,0.5))' : 'drop-shadow(0 0 8px rgba(255,255,255,0.15))',
                            transform: isEnemy ? 'scaleX(-1)' : 'none'
                        }}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.5 }}
                    />
                )}
            </div>

            {/* Right: Info Column */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className={`element-badge ${entity.primaryElement.toLowerCase()}`} style={{ fontSize: '0.6rem', width: '18px', height: '18px' }}>
                        {entity.primaryElement[0]}
                    </span>
                    <div className="unit-name" style={{ fontSize: '1rem', margin: 0, textAlign: 'left', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {entity.name}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.65rem', opacity: 0.6, fontWeight: 700 }}>
                            Lv. {entity.level}
                        </div>
                        {/* XP Bar */}
                        <div className="bar-container xp-bar-container" style={{ width: '60px', height: '3px', marginTop: '2px', background: 'rgba(255,255,255,0.1)' }}>
                            <motion.div
                                className="xp-bar"
                                style={{
                                    height: '100%',
                                    backgroundColor: '#00d2ff',
                                    boxShadow: '0 0 5px rgba(0, 210, 255, 0.5)'
                                }}
                                initial={{ width: 0 }}
                                animate={{ width: `${xpProgress}%` }}
                                transition={{ duration: 1, delay: 0.5 }}
                            />
                        </div>
                    </div>
                </div>

                <div style={{ marginTop: '8px' }}>
                    <div className="bar-container" style={{ margin: '4px 0' }}>
                        {/* Preview Damage Layer */}
                        {previewDamage > 0 && (
                            <div
                                className="hp-bar-preview"
                                style={{
                                    left: `${previewPercent}%`,
                                    width: `${hpPercent - previewPercent}%`
                                }}
                            />
                        )}
                        <motion.div
                            className="hp-bar"
                            initial={{ width: `${hpPercent}%` }}
                            animate={{
                                width: `${hpPercent}%`,
                                backgroundColor: hpPercent < 25 ? 'var(--hp-red)' : 'var(--hp-green)'
                            }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                        />
                    </div>
                    <div style={{ fontSize: '0.65rem', textAlign: 'right', opacity: 0.8, fontVariantNumeric: 'tabular-nums', marginTop: '-2px' }}>
                        {entity.currentHp} / {entity.maxHp}
                    </div>
                </div>

                <div className="energy-row" style={{ marginTop: '4px', justifyContent: 'flex-start' }}>
                    {energyPips}
                </div>

                {/* Status Effects */}
                <div className="status-row" style={{ marginTop: '6px', justifyContent: 'flex-start', minHeight: '20px' }}>
                    {entity.statusEffects.length > 0 ? (
                        entity.statusEffects.map((se, i) => {
                            const info = STATUS_ICONS[se.type] || { icon: '✦', color: '#ccc' };
                            return (
                                <div
                                    key={`${se.type}-${i}`}
                                    className="status-badge"
                                    style={{ borderColor: info.color, color: info.color }}
                                    title={`${se.type} (${se.stacks} stacks)`}
                                >
                                    <span className="status-icon" style={{ fontSize: '0.6rem' }}>{info.icon}</span>
                                    {se.stacks > 1 && <span className="status-stacks" style={{ fontSize: '0.5rem' }}>×{se.stacks}</span>}
                                </div>
                            );
                        })
                    ) : (
                        <div style={{ fontSize: '0.6rem', opacity: 0.3 }}>No active effects</div>
                    )}
                </div>
            </div>
        </motion.div>
    );
};

export default MingmingUnit;
