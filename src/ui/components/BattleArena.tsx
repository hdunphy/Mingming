import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store/store';
import MingmingUnit from './MingmingUnit';
import CardHand from './CardHand';
import { selectSource, selectTarget } from '../store/battleSlice';
import type { IBattleEntity } from '../../engine/types';

const BattleArena: React.FC = () => {
    const dispatch = useDispatch();
    const battleState = useSelector((state: RootState) => state.battle.battle);
    const selectedSourceId = useSelector((state: RootState) => state.battle.selectedSourceId);
    const selectedTargetId = useSelector((state: RootState) => state.battle.selectedTargetId);

    if (!battleState) return <div className="battle-screen">Loading Battle...</div>;

    const renderParty = (party: readonly IBattleEntity[], isEnemy: boolean) => (
        <div className={`party-column ${isEnemy ? 'enemy-side' : 'player-side'}`}>
            {party.map((entity, index) => {
                const isSelected = selectedSourceId === entity.id;
                const isTargeted = selectedTargetId === entity.id;

                // Stagger logic: Middle unit (index 1) is closer to center
                // Player is on Left, Enemy is on Right.
                const translateX = index === 1 ? (isEnemy ? -60 : 60) : 0;

                return (
                    <div
                        key={entity.id}
                        style={{
                            transform: `translateX(${translateX}px)`,
                            transition: 'all 0.3s ease'
                        }}
                    >
                        <MingmingUnit
                            entity={entity}
                            isEnemy={isEnemy}
                            isSelected={isSelected}
                            isTargeted={isTargeted}
                            onClick={() => {
                                if (isEnemy) {
                                    dispatch(selectTarget(isTargeted ? null : entity.id));
                                } else {
                                    dispatch(selectSource(isSelected ? null : entity.id));
                                }
                            }}
                        />
                    </div>
                );
            })}
        </div>
    );

    return (
        <div className="battle-screen">
            {/* Stage: Top 70% */}
            <div className="stage-area">
                {renderParty(battleState.playerParty, false)}
                {renderParty(battleState.enemyParty, true)}
            </div>

            {/* Console: Bottom 30% */}
            <div className="console-area">
                <CardHand />
            </div>
        </div>
    );
};

export default BattleArena;
