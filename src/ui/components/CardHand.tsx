import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import type { RootState } from '../store/store';
import { selectCard, playProgram, endTurn } from '../store/battleSlice';
import { GetProgramData } from '../../engine/data/programRegistry';
import { validateSingleConstraint } from '../../engine/battleReducer';
import { getConstraintBehavior } from '../../engine/ConstraintBehavior';

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
        case 'NOT_STATUS':
            return `Requires: ${c.target === 'SELF' ? 'Self' : 'Target'} does not have ${c.value}`;
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
    const playerParty = useSelector((state: RootState) => state.battle.battle?.playerParty || []);
    const selectedCardId = useSelector((state: RootState) => state.battle.selectedCardId);
    const selectedSourceId = useSelector((state: RootState) => state.battle.selectedSourceId);
    const selectedTargetId = useSelector((state: RootState) => state.battle.selectedTargetId);
    const isOurTurn = useSelector((state: RootState) => state.battle.battle?.activeSide === 'PLAYER');
    const drawPileCount = useSelector((state: RootState) => state.battle.battle?.playerDeck.drawpile.length || 0);
    const discardPileCount = useSelector((state: RootState) => state.battle.battle?.playerDeck.discard.length || 0);
    const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);

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
                        const arcDip = Math.abs(centerOffset) * 12;

                        // Ticket 14: unplayable check

                        const source = playerParty.find(u => u.id === selectedSourceId);
                        const constraints = (data.constraints || [])
                            .filter(c => c.target === 'SELF' && source && !getConstraintBehavior(c.type).validate(c, { source, cost: card.currentCost }))
                            .map(formatConstraint);
                        const isUnplayable = !selectedSourceId || constraints.length > 0;
                        console.log(constraints);

                        return (
                            <motion.div
                                key={card.id}
                                initial={{ opacity: 0, y: 40, scale: 0.9 }}
                                animate={{
                                    opacity: isUnplayable ? 0.45 : 1,
                                    y: isSelected ? -30 : (isHovered ? -30 : arcDip),
                                    scale: isSelected ? 1.08 : (isHovered ? 1.05 : 1),
                                    rotate: isSelected ? 0 : (isHovered ? 0 : rotation),
                                }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                transition={{ duration: 0.2 }}
                                className={`program-card ${isSelected ? 'selected' : ''} ${isUnplayable ? 'grayscale' : ''}`}
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
                                    zIndex: isSelected ? 100 : (isHovered ? 99 : index),
                                    filter: isUnplayable ? 'grayscale(0.6)' : 'none',
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
                                                    <div className="tooltip-label">⚠️ Requirements</div>
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

            <div className="hand-footer">
                <div className="pile-indicator draw-pile">
                    <span className="pile-icon">🃏</span>
                    <span className="pile-count">{drawPileCount}</span>
                    <span className="pile-label">DRAW</span>
                </div>
                <div className="battle-controls">
                    <button
                        disabled={!isOurTurn}
                        onClick={() => dispatch(endTurn())}
                        className="action-button end-turn"
                    >
                        END TURN
                    </button>
                </div>
                <div className="pile-indicator discard-pile">
                    <span className="pile-icon">🗑️</span>
                    <span className="pile-count">{discardPileCount}</span>
                    <span className="pile-label">DISCARD</span>
                </div>
            </div>
        </div>
    );
};

export default CardHand;

