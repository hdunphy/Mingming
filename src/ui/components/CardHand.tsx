import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store/store';
import { selectCard, playProgram, endTurn } from '../store/battleSlice';
import { GetProgramData } from '../../engine/data/programRegistry';

const CardHand: React.FC = () => {
    const dispatch = useDispatch();
    const hand = useSelector((state: RootState) => state.battle.battle?.playerDeck.hand || []);
    const selectedCardId = useSelector((state: RootState) => state.battle.selectedCardId);
    const selectedSourceId = useSelector((state: RootState) => state.battle.selectedSourceId);
    const selectedTargetId = useSelector((state: RootState) => state.battle.selectedTargetId);
    const phase = useSelector((state: RootState) => state.battle.battle?.phase);
    const activeSide = useSelector((state: RootState) => state.battle.battle?.activeSide);

    const isOurTurn = phase === 'ACTION' && activeSide === 'PLAYER';

    const handlePlay = () => {
        if (selectedCardId && selectedSourceId && selectedTargetId) {
            dispatch(playProgram({
                sourceId: selectedSourceId,
                targetId: selectedTargetId,
                programId: selectedCardId
            }));
            // Reset selection
            dispatch(selectCard(null));
        }
    };

    return (
        <div className="hand-container">
            <div className="hand-fan">
                {hand.map((card, index) => {
                    const data = GetProgramData(card.dataId);
                    const isSelected = selectedCardId === card.id;

                    // Simple fan positioning within the new console area
                    const offset = (index - (hand.length - 1) / 2) * 40;
                    const rotation = (index - (hand.length - 1) / 2) * 3;

                    return (
                        <div
                            key={card.id}
                            className={`program-card ${isSelected ? 'selected' : ''}`}
                            style={{
                                transform: `translateX(${offset}px) rotate(${rotation}deg)`,
                                zIndex: isSelected ? 100 : index
                            }}
                            onClick={() => dispatch(selectCard(isSelected ? null : card.id))}
                        >
                            <div className="card-cost">{data.baseCost}</div>
                            <div className="card-name">{data.name}</div>
                            <div className="card-element">{data.element}</div>
                        </div>
                    );
                })}
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
