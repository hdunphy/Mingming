import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import type { RootState } from '../store/store';
import { selectCard, playProgram, endTurn } from '../store/battleSlice';
import { GetProgramData } from '../../engine/data/programRegistry';

// Helper to format an action for display
const formatAction = (action: any): string => {
    switch (action.type) {
        case 'ATTACK':
            return `⚔️ ${action.power} ${action.element || ''} dmg`;
        case 'HEAL':
            return `💚 Heal ${action.power}`;
        case 'APPLY_STATUS':
            return `✦ ${action.status} ×${action.stacks || 1}`;
        case 'DRAW':
            return `🃏 Draw ${action.count || 1}`;
        case 'REMOVE_STATUS':
            return `✖ Remove ${action.status || 'all'}`;
        case 'ADD_ENERGY':
            return `⚡ +${action.amount} Energy`;
        case 'REVIVE':
            return `♻️ Revive`;
        default:
            return action.type;
    }
};

const formatConstraint = (c: any): string => {
    switch (c.type) {
        case 'HAS_STATUS':
            return `Requires: ${c.target === 'SELF' ? 'Self' : 'Target'} has ${c.value}`;
        case 'HEALTH_THRESHOLD':
            return `Requires: HP ${c.value}`;
        case 'BASE':
            return ''; // Don't display base energy check
        default:
            return c.type;
    }
};

const CardHand: React.FC<{
    onTargetingStart?: (point: { x: number, y: number }) => void;
    onTargetingEnd?: () => void;
}> = ({ onTargetingStart }) => {
    const dispatch = useDispatch();
    const hand = useSelector((state: RootState) => state.battle.battle?.playerDeck.hand || []);
    const selectedCardId = useSelector((state: RootState) => state.battle.selectedCardId);
    const selectedSourceId = useSelector((state: RootState) => state.battle.selectedSourceId);
    const selectedTargetId = useSelector((state: RootState) => state.battle.selectedTargetId);
    const isOurTurn = useSelector((state: RootState) => state.battle.battle?.activeSide === 'PLAYER');
    const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);

    const handlePlay = () => {
        if (selectedCardId && selectedSourceId && selectedTargetId) {
            dispatch(playProgram({
                sourceId: selectedSourceId,
                targetId: selectedTargetId,
                programId: selectedCardId
            }));
        }
    };

    return (
        <div className="hand-container">
            <div className="hand-row">
                <AnimatePresence>
                    {hand.map((card, index) => {
                        const data = GetProgramData(card.dataId);
                        const isSelected = selectedCardId === card.id;
                        const isHovered = hoveredCardId === card.id;

                        const centerOffset = index - (hand.length - 1) / 2;
                        const rotation = centerOffset * 5;
                        const arcDip = Math.abs(centerOffset) * 4;

                        const constraints = (data.constraints || [])
                            .map(formatConstraint)
                            .filter(Boolean);

                        return (
                            <motion.div
                                key={card.id}
                                initial={{ opacity: 0, y: 40, scale: 0.9 }}
                                animate={{
                                    opacity: 1,
                                    y: isSelected ? -30 : arcDip,
                                    scale: isSelected ? 1.08 : 1,
                                    rotate: isSelected ? 0 : rotation,
                                }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                transition={{ duration: 0.2 }}
                                className={`program-card ${isSelected ? 'selected' : ''}`}
                                onClick={() => dispatch(selectCard(isSelected ? null : card.id))}
                                onPointerDown={(e) => {
                                    dispatch(selectCard(card.id));
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    onTargetingStart?.({
                                        x: rect.left + rect.width / 2,
                                        y: rect.top + rect.height / 2
                                    });
                                }}
                                onMouseEnter={() => setHoveredCardId(card.id)}
                                onMouseLeave={() => setHoveredCardId(null)}
                                style={{
                                    cursor: 'pointer',
                                    flexShrink: 0,
                                    transformOrigin: 'center bottom',
                                    zIndex: isSelected ? 100 : (isHovered ? 99 : hand.length - Math.abs(centerOffset)),
                                }}
                            >
                                {/* Cost badge */}
                                <div className="card-cost">{card.currentCost}</div>

                                {/* Header: element + name */}
                                <div className="card-header">
                                    <span className={`element-badge ${data.element.toLowerCase()}`}>
                                        {data.element[0]}
                                    </span>
                                    <div className="card-name">{data.name}</div>
                                </div>

                                {/* Description */}
                                <div className="card-description">{data.description}</div>

                                {/* Target type */}
                                <div className="card-target">{data.target}</div>

                                {/* Hover tooltip: actions & constraints */}
                                <AnimatePresence>
                                    {isHovered && (
                                        <motion.div
                                            className="card-tooltip"
                                            initial={{ opacity: 0, y: 5 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: 5 }}
                                            transition={{ duration: 0.15 }}
                                        >
                                            {constraints.length > 0 && (
                                                <div className="tooltip-section">
                                                    <div className="tooltip-label">Requires</div>
                                                    {constraints.map((c, i) => (
                                                        <div key={i} className="tooltip-constraint">{c}</div>
                                                    ))}
                                                </div>
                                            )}
                                            <div className="tooltip-section">
                                                <div className="tooltip-label">Effects</div>
                                                {data.actions.map((action, i) => (
                                                    <div key={i} className="tooltip-action">{formatAction(action)}</div>
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>

            <div className="battle-controls">
                <button
                    disabled={!isOurTurn || !selectedCardId || !selectedSourceId || !selectedTargetId}
                    onClick={handlePlay}
                    className="action-button"
                >
                    PLAY PROGRAM
                </button>
                <button
                    disabled={!isOurTurn}
                    onClick={() => dispatch(endTurn())}
                    className="action-button end-turn"
                >
                    END TURN
                </button>
            </div>
        </div>
    );
};

export default CardHand;

