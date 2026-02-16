import React from 'react';
import type { IBattleEntity } from '../../engine/types';

interface MingmingUnitProps {
    entity: IBattleEntity;
    isEnemy?: boolean;
    isSelected?: boolean;
    isTargeted?: boolean;
    onClick?: () => void;
}

const MingmingUnit: React.FC<MingmingUnitProps> = ({
    entity,
    isEnemy = false,
    isSelected = false,
    isTargeted = false,
    onClick
}) => {
    // isEnemy is preserved for future side-specific logic
    const hpPercent = (entity.currentHp / entity.maxHp) * 100;

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
        <div
            className={`unit-card ${isSelected ? 'selected' : ''} ${isTargeted ? 'targeted' : ''}`}
            data-side={isEnemy ? 'enemy' : 'player'}
            style={{
                borderTop: `4px solid ${elementColor}`
            }}
            onClick={onClick}
        >
            <div>
                <div className="unit-name">{entity.name}</div>
                <div style={{ fontSize: '0.7rem', textAlign: 'center', opacity: 0.7 }}>
                    Lv. {entity.level}
                </div>

                <div className="bar-container">
                    <div
                        className="hp-bar"
                        style={{
                            width: `${hpPercent}%`,
                            backgroundColor: hpPercent < 25 ? 'var(--hp-red)' : 'var(--hp-green)'
                        }}
                    />
                </div>

                <div className="energy-row">
                    {energyPips}
                </div>
            </div>
        </div>
    );
};

export default MingmingUnit;
