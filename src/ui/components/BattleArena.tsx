import React, { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import type { RootState } from '../store/store';
import MingmingUnit from './MingmingUnit';
import CardHand from './CardHand';
import CombatLog from './CombatLog';
import { selectSource, selectTarget, selectCard, endTurn, playProgram, setBattleState } from '../store/battleSlice';
import type { IBattleEntity } from '../../engine/types';
import { calculateDamage } from '../../engine/combatUtils';
import { GetProgramData } from '../../engine/data/programRegistry';
import { getBestAction } from '../../engine/ai/TacticalAI';
import { battleReducer } from '../../engine/battleReducer';
import { rollDropTable } from '../../engine/RewardSystem';
import BattleReport from './BattleReport';
import { applyRewardBundle as applyRewardAction, resetSave, syncPartyStats } from '../store/gameSlice';
import { deleteSave } from '../../engine/SaveSystem';
import type { IRewardBundle } from '../../engine/gameTypes';

const TurnBanner: React.FC<{ side: 'PLAYER' | 'ENEMY' }> = ({ side }) => (
    <motion.div
        key={side}
        initial={{ scale: 0.5, opacity: 0, x: -200 }}
        animate={{ scale: 1, opacity: 1, x: 0 }}
        exit={{ scale: 1.5, opacity: 0, x: 200 }}
        className="turn-banner"
        style={{
            position: 'absolute',
            top: '40%',
            left: '30%',
            right: '30%',
            padding: '20px',
            background: side === 'PLAYER' ? 'rgba(0, 150, 255, 0.8)' : 'rgba(255, 50, 50, 0.8)',
            color: 'white',
            textAlign: 'center',
            fontSize: '3rem',
            fontWeight: 900,
            borderRadius: '10px',
            backdropFilter: 'blur(10px)',
            zIndex: 1000,
            pointerEvents: 'none'
        }}
    >
        {side === 'PLAYER' ? 'YOUR TURN' : 'ENEMY TURN'}
    </motion.div>
);

const WinLossOverlay: React.FC<{ result: 'WIN' | 'LOSS', onShowReport?: () => void, onDefeatReset?: () => void }> = ({ result, onShowReport, onDefeatReset }) => (
    <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="end-game-overlay"
        style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000
        }}
    >
        <motion.h1
            initial={{ scale: 0 }}
            animate={{ scale: 1.2 }}
            style={{
                fontSize: '5rem',
                color: result === 'WIN' ? '#00ffaa' : '#ff4444',
                textShadow: '0 0 30px currentColor'
            }}
        >
            {result === 'WIN' ? 'VICTORY' : 'DEFEAT'}
        </motion.h1>
        {result === 'LOSS' && (
            <p style={{ color: '#ff8888', marginTop: '-10px', fontSize: '1.2rem', fontWeight: 'bold' }}>
                RUN TERMINATED. DATA WIPED.
            </p>
        )}
        {result === 'WIN' && onShowReport ? (
            <button onClick={onShowReport} className="action-button" style={{ marginTop: '40px' }}>
                VIEW REWARDS
            </button>
        ) : (
            <button onClick={onDefeatReset || (() => window.location.reload())} className="action-button" style={{ marginTop: '40px' }}>
                {result === 'LOSS' ? 'RESTART GAUNTLET' : 'RETURN TO BASE'}
            </button>
        )}
    </motion.div>
);

const BattleArena: React.FC = () => {
    const dispatch = useDispatch();
    const battleState = useSelector((state: RootState) => state.battle.battle);
    const selectedSourceId = useSelector((state: RootState) => state.battle.selectedSourceId);
    const selectedTargetId = useSelector((state: RootState) => state.battle.selectedTargetId);
    const selectedCardId = useSelector((state: RootState) => state.battle.selectedCardId);

    const [hoveredUnitId, setHoveredUnitId] = useState<string | null>(null);
    const [showTurnBanner, setShowTurnBanner] = useState(false);
    const [dragPoint, setDragPoint] = useState<{ x: number, y: number } | null>(null);
    const [originPoint, setOriginPoint] = useState<{ x: number, y: number } | null>(null);
    const [isTargeting, setIsTargeting] = useState(false);

    // Epic 3.5: Post-battle state
    const [rewardBundle, setRewardBundle] = useState<IRewardBundle | null>(null);
    const [showReport, setShowReport] = useState(false);

    const prevSideRef = useRef(battleState?.activeSide);

    // Hotkeys implementation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!battleState || battleState.activeSide !== 'PLAYER') return;

            // 1-9: Select Card
            if (e.key >= '1' && e.key <= '9') {
                const index = parseInt(e.key) - 1;
                const hand = battleState.playerDeck.hand;
                if (hand[index]) {
                    dispatch(selectCard(hand[index].id));
                }
            }

            // W, E, R: Select Player Units
            if (e.key.toLowerCase() === 'w') dispatch(selectSource(battleState.playerParty[0]?.id));
            if (e.key.toLowerCase() === 'e') dispatch(selectSource(battleState.playerParty[1]?.id));
            if (e.key.toLowerCase() === 'r') dispatch(selectSource(battleState.playerParty[2]?.id));

            // Space: End Turn
            if (e.key === ' ') {
                e.preventDefault();
                dispatch(endTurn());
            }

            // Esc: Clear selections
            if (e.key === 'Escape') {
                dispatch(selectCard(null));
                dispatch(selectSource(null));
                dispatch(selectTarget(null));
                setDragPoint(null);
                setOriginPoint(null);
                setIsTargeting(false);
            }
        };

        const handleWheel = (e: WheelEvent) => {
            if (!battleState || battleState.activeSide !== 'PLAYER' || !selectedSourceId) return;
            const currentIndex = battleState.playerParty.findIndex(p => p.id === selectedSourceId);
            if (currentIndex === -1) return;

            let nextIndex = currentIndex + (e.deltaY > 0 ? 1 : -1);
            if (nextIndex < 0) nextIndex = battleState.playerParty.length - 1;
            if (nextIndex >= battleState.playerParty.length) nextIndex = 0;

            dispatch(selectSource(battleState.playerParty[nextIndex].id));
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('wheel', handleWheel);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('wheel', handleWheel);
        };
    }, [battleState, dispatch, selectedSourceId]);

    useEffect(() => {
        if (battleState?.activeSide !== prevSideRef.current) {
            setShowTurnBanner(true);
            const timer = setTimeout(() => setShowTurnBanner(false), 2000);
            prevSideRef.current = battleState?.activeSide;
            return () => clearTimeout(timer);
        }
    }, [battleState?.activeSide]);

    // Enemy AI Turn Automation
    useEffect(() => {
        if (!battleState || battleState.activeSide !== 'ENEMY') return;

        // Check if battle is over
        const isOver = battleState.playerParty.every(p => p.currentHp <= 0) ||
            battleState.enemyParty.every(e => e.currentHp <= 0);
        if (isOver) return;

        let cancelled = false;

        const runAI = async () => {
            // Wait for turn banner to display
            await new Promise(r => setTimeout(r, 1200));
            if (cancelled) return;

            let currentState = battleState;
            let safety = 0;

            while (safety < 20) {
                safety++;
                const action = getBestAction(currentState);

                // Apply the action
                currentState = battleReducer(currentState, action);

                // Update the UI
                dispatch(setBattleState(currentState as any));

                // If AI chose END_TURN, we're done
                if (action.type === 'END_TURN') break;

                // Small delay between AI actions for visibility
                await new Promise(r => setTimeout(r, 600));
                if (cancelled) return;
            }
        };

        runAI();

        return () => { cancelled = true; };
    }, [battleState?.activeSide, battleState?.turn]);

    const handlePlay = (cardId: string, targetId: string) => {
        if (!battleState || !selectedSourceId) return;

        dispatch(playProgram({
            sourceId: selectedSourceId,
            targetId,
            programId: cardId
        }));

        // Persist source selection, clear card/drag state
        dispatch(selectCard(null));
        setDragPoint(null);
        setOriginPoint(null);
    };

    const isVictory = battleState?.enemyParty.every(e => e.currentHp <= 0) ?? false;
    const isDefeat = battleState?.playerParty.every(p => p.currentHp <= 0) ?? false;

    // Epic 3.5: Wipe save on defeat
    useEffect(() => {
        if (isDefeat) {
            deleteSave();
        }
    }, [isDefeat]);

    // Roll rewards on victory
    useEffect(() => {
        if (isVictory && !rewardBundle && battleState) {
            const bundle = rollDropTable(battleState.enemyParty, battleState.seed);
            setRewardBundle(bundle);
        }
    }, [isVictory, battleState?.enemyParty, battleState?.seed, rewardBundle]);

    const handleDefeatReset = () => {
        dispatch(resetSave());
        window.location.reload();
    };

    const handleContinue = () => {
        if (battleState) {
            dispatch(syncPartyStats(battleState.playerParty));
        }
        if (rewardBundle) {
            dispatch(applyRewardAction(rewardBundle));
        }
        dispatch(setBattleState(null as any));
    };

    if (!battleState) return <div className="battle-screen">Loading Battle...</div>;

    // Helper: get the currently selected card's program data
    const getSelectedCardData = () => {
        if (!battleState || !selectedCardId) return null;
        const card = battleState.playerDeck.hand.find(c => c.id === selectedCardId);
        if (!card) return null;
        return GetProgramData(card.dataId);
    };

    const renderParty = (party: readonly IBattleEntity[], isEnemy: boolean) => (
        <div className={`party-column ${isEnemy ? 'enemy-side' : 'player-side'}`}>
            {party.map((entity, index) => {
                const isSelected = selectedSourceId === entity.id;
                const isTargeted = selectedTargetId === entity.id;
                const isHovered = hoveredUnitId === entity.id;
                const isDead = entity.currentHp <= 0;

                let previewDamage = 0;
                if (isHovered && !isDead && selectedCardId && selectedSourceId) {
                    const source = battleState.playerParty.find(p => p.id === selectedSourceId) ||
                        battleState.enemyParty.find(e => e.id === selectedSourceId);
                    const card = battleState.playerDeck.hand.find(c => c.id === selectedCardId);

                    if (source && card) {
                        const programData = GetProgramData(card.dataId);
                        const attackAction = programData.actions.find(a => a.type === 'DAMAGE');
                        if (attackAction) {
                            previewDamage = calculateDamage(source, entity, programData, attackAction.power || 0, battleState);
                        }
                    }
                }

                const translateX = 0; // Removed manual offset to allow horizontal layout to breathe

                return (
                    <motion.div
                        key={entity.id}
                        initial={{ opacity: 0, x: isEnemy ? 100 : -100 }}
                        animate={{ opacity: isDead ? 0.35 : 1, x: translateX }}
                        transition={{ delay: index * 0.1, type: 'spring' }}
                        style={{ pointerEvents: isDead ? 'none' : 'auto' }}
                        onMouseEnter={() => !isDead && setHoveredUnitId(entity.id)}
                        onMouseLeave={() => setHoveredUnitId(null)}
                        onPointerUp={() => {
                            if (!selectedCardId || isDead) return;
                            const cardData = getSelectedCardData();
                            if (!cardData) return;

                            // Determine if this is a valid target
                            const targetType = cardData.target;
                            const isValidTarget =
                                (isEnemy && (targetType === 'Single' || targetType === 'Side' || targetType === 'All')) ||
                                (!isEnemy && (targetType === 'Self' || targetType === 'Side' || targetType === 'All')) ||
                                (!isEnemy && cardData.category === 'Heal');

                            if (isValidTarget) {
                                // For Self cards, always target the source
                                const effectiveTargetId = targetType === 'Self' ? (selectedSourceId || entity.id) : entity.id;
                                handlePlay(selectedCardId, effectiveTargetId);
                                dispatch(selectCard(null));
                            }
                        }}
                    >
                        <MingmingUnit
                            entity={entity}
                            isEnemy={isEnemy}
                            isSelected={isSelected}
                            isTargeted={isTargeted}
                            previewDamage={previewDamage}
                            onClick={() => {
                                if (isDead) return;

                                // If we have a card selected, check if this is a valid target
                                if (selectedCardId) {
                                    const cardData = getSelectedCardData();
                                    if (cardData) {
                                        const targetType = cardData.target;
                                        const canTarget =
                                            (isEnemy && (targetType === 'Single' || targetType === 'Side' || targetType === 'All')) ||
                                            (!isEnemy && (targetType === 'Self' || targetType === 'Side' || targetType === 'All')) ||
                                            (!isEnemy && cardData.category === 'Heal');

                                        if (canTarget) {
                                            dispatch(selectTarget(isTargeted ? null : entity.id));
                                            return;
                                        }
                                    }
                                }

                                // Default behavior: enemy = target, friendly = source
                                if (isEnemy) {
                                    dispatch(selectTarget(isTargeted ? null : entity.id));
                                } else {
                                    dispatch(selectSource(isSelected ? null : entity.id));
                                }
                            }}
                        />
                    </motion.div>
                );
            })}
        </div>
    );

    return (
        <div className="battle-screen"
            onPointerMove={(e) => {
                if (isTargeting && selectedCardId) {
                    setDragPoint({ x: e.clientX, y: e.clientY });
                }
            }}
            onPointerUp={() => {
                setIsTargeting(false);
                setDragPoint(null);
                setOriginPoint(null);
            }}
        >
            <AnimatePresence>
                {showTurnBanner && <TurnBanner side={battleState.activeSide} />}
                {isVictory && !showReport && (
                    <WinLossOverlay
                        result="WIN"
                        onShowReport={() => setShowReport(true)}
                    />
                )}
                {isDefeat && (
                    <WinLossOverlay
                        result="LOSS"
                        onDefeatReset={handleDefeatReset}
                    />
                )}
                {isVictory && showReport && rewardBundle && (
                    <BattleReport
                        bundle={rewardBundle}
                        winners={battleState.playerParty as any}
                        onContinue={handleContinue}
                    />
                )}
            </AnimatePresence>

            {/* Targeting Line SVG */}
            {selectedCardId && dragPoint && originPoint && (
                <svg style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 1000, width: '100%', height: '100%' }}>
                    <motion.line
                        x1={originPoint.x}
                        y1={originPoint.y}
                        x2={dragPoint.x}
                        y2={dragPoint.y}
                        stroke="rgba(255, 255, 255, 0.5)"
                        strokeWidth="4"
                        strokeDasharray="10 10"
                        animate={{ strokeDashoffset: [0, -20] }}
                        transition={{ duration: 0.5, repeat: Infinity, ease: "linear" }}
                    />
                    <circle cx={dragPoint.x} cy={dragPoint.y} r="8" fill="white" />
                </svg>
            )}

            {/* Stage: Top 70% */}
            <motion.div
                className="stage-area"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1 }}
            >
                {renderParty(battleState.playerParty, false)}

                <CombatLog />

                {renderParty(battleState.enemyParty, true)}
            </motion.div>

            {/* Console: Bottom 30% */}
            <div
                className="console-area"
                onPointerUp={() => {
                    setDragPoint(null);
                    setOriginPoint(null);
                }}
            >
                <CardHand
                    onTargetingStart={(point) => {
                        setOriginPoint(point);
                        setIsTargeting(true);
                    }}
                    onTargetingEnd={() => {
                        setIsTargeting(false);
                        setDragPoint(null);
                        setOriginPoint(null);
                    }}
                />
            </div>
        </div>
    );
};


export default BattleArena;
