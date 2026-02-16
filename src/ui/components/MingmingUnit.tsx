import React, { useEffect } from 'react';
import { motion, useAnimation, AnimatePresence } from 'framer-motion';
import type { IBattleEntity } from '../../engine/types';

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
    const prevHpRef = React.useRef(entity.currentHp);

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

    const hpPercent = (entity.currentHp / entity.maxHp) * 100;
    const previewPercent = Math.max(0, ((entity.currentHp - previewDamage) / entity.maxHp) * 100);

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
            whileHover={{ scale: 1.05 }}
            style={{
                borderTop: `4px solid ${elementColor}`,
                x: isSelected ? (isEnemy ? -40 : 40) : 0,
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
            </AnimatePresence>
            <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                    <span className={`element-badge ${entity.primaryElement.toLowerCase()}`}>
                        {entity.primaryElement[0]}
                    </span>
                    <div className="unit-name">{entity.name}</div>
                </div>
                <div style={{ fontSize: '0.7rem', textAlign: 'center', opacity: 0.7 }}>
                    Lv. {entity.level}
                </div>

                <div className="bar-container">
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
                <div style={{ fontSize: '0.65rem', textAlign: 'center', opacity: 0.8, fontVariantNumeric: 'tabular-nums' }}>
                    {entity.currentHp} / {entity.maxHp}
                </div>

                <div className="energy-row">
                    {energyPips}
                </div>

                {/* Status Effects */}
                {entity.statusEffects.length > 0 && (
                    <div className="status-row">
                        {entity.statusEffects.map((se, i) => {
                            const info = STATUS_ICONS[se.type] || { icon: '✦', color: '#ccc' };
                            return (
                                <div
                                    key={`${se.type}-${i}`}
                                    className="status-badge"
                                    style={{ borderColor: info.color, color: info.color }}
                                    title={`${se.type} (${se.stacks} stacks)`}
                                >
                                    <span className="status-icon">{info.icon}</span>
                                    {se.stacks > 1 && <span className="status-stacks">×{se.stacks}</span>}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </motion.div>
    );
};

export default MingmingUnit;
