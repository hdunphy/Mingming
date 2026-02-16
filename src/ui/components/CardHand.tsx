import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import type { RootState } from '../store/store';
import { selectCard, playProgram, endTurn } from '../store/battleSlice';
import { GetProgramData } from '../../engine/data/programRegistry';

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

                        // Fan rotation: cards at edges rotate more
                        const centerOffset = index - (hand.length - 1) / 2;
                        const rotation = centerOffset * 5; // degrees per position
                        const arcDip = Math.abs(centerOffset) * 4; // edge cards dip down slightly

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
                                style={{
                                    cursor: 'pointer',
                                    flexShrink: 0,
                                    transformOrigin: 'center bottom',
                                    zIndex: isSelected ? 100 : hand.length - Math.abs(centerOffset),
                                }}
                            >
                                <div className="card-cost">{data.baseCost}</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '15px' }}>
                                    <span className={`element-badge ${data.element.toLowerCase()}`}>
                                        {data.element[0]}
                                    </span>
                                    <div className="card-name">{data.name}</div>
                                </div>
                                <div className="card-element">{data.element}</div>
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
