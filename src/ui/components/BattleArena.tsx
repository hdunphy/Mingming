import React, { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { store, type RootState } from '../store/store';
import MingmingUnit from './MingmingUnit';
import CardHand from './CardHand';
import CombatLog from './CombatLog';
import BattleStage from './BattleStage';
import { selectSource, selectTarget, selectCard, endTurn, playProgram, setBattleState, executeIntent, startBattle } from '../store/battleSlice';
import type { IBattleEntity, Element } from '../../engine/types';
import { calculateDamage } from '../../engine/combatUtils';
import { GetProgramData } from '../../engine/data/programRegistry';
import { getBestAction } from '../../engine/ai/TacticalAI';
import { battleReducer } from '../../engine/battleReducer';
import { rollDropTable, rollDraftRounds } from '../../engine/RewardSystem';
import BattleReport from './BattleReport';
import { applyRewardBundle as applyRewardAction, resetSave, updateGauntlet, completeGauntlet, addRelic } from '../store/gameSlice';
import { deleteSave } from '../../engine/SaveSystem';
import { RelicRegistry } from '../../engine/data/relicRegistry';
import { PRNG } from '../../engine/core/PRNG';
import type { IRewardBundle, IOwnedProgram } from '../../engine/gameTypes';
import { useBattleVfx } from '../hooks/useBattleVfx';
import { prefersReducedMotion } from '../utils/motionPrefs';
import { playSfx } from '../audio/AudioEngine';
import AudioControls from './AudioControls';

/**
 * Hold the level-up overlay after the queue first populates, so the death FX
 * (450ms CRT glitch + TERMINATED stamp beat) finish before it covers the stage.
 */
const LEVEL_UP_OVERLAY_DELAY_MS = 900;

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

const WinLossOverlay: React.FC<{ result: 'WIN' | 'LOSS', onShowReport?: () => void, onDefeatReset?: () => void }> = ({ result, onShowReport, onDefeatReset }) => {
    // Entrance beat: the headline slams in from oversized + blurred (a digital
    // "lock-on"), then the actions fade up. Reduced motion: simple fade only.
    const reduced = prefersReducedMotion();
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
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
                initial={reduced
                    ? { opacity: 0 }
                    : { scale: 2.3, opacity: 0, filter: 'blur(14px)', letterSpacing: '0.5em' }}
                animate={reduced
                    ? { opacity: 1 }
                    : { scale: 1, opacity: 1, filter: 'blur(0px)', letterSpacing: '0.1em' }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
                style={{
                    fontSize: '5rem',
                    color: result === 'WIN' ? '#00ffaa' : '#ff4444',
                    textShadow: '0 0 30px currentColor'
                }}
            >
                {result === 'WIN' ? 'VICTORY' : 'DEFEAT'}
            </motion.h1>
            {result === 'LOSS' && (
                <motion.p
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.45, duration: 0.3 }}
                    style={{ color: '#ff8888', marginTop: '-10px', fontSize: '1.2rem', fontWeight: 'bold' }}
                >
                    RUN TERMINATED. DATA WIPED.
                </motion.p>
            )}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55, duration: 0.3 }}
            >
                {result === 'WIN' && onShowReport ? (
                    <button
                        onClick={() => { playSfx('uiClick'); onShowReport(); }}
                        className="action-button"
                        style={{ marginTop: '40px' }}
                    >
                        VIEW REWARDS
                    </button>
                ) : (
                    <button
                        onClick={() => { playSfx('uiClick'); (onDefeatReset || (() => window.location.reload()))(); }}
                        className="action-button"
                        style={{ marginTop: '40px' }}
                    >
                        {result === 'LOSS' ? 'RESTART RUN' : 'RETURN TO BASE'}
                    </button>
                )}
            </motion.div>
        </motion.div>
    );
};

const BattleArena: React.FC = () => {
    const dispatch = useDispatch();
    const battleState = useSelector((state: RootState) => state.battle.battle);
    const selectedSourceId = useSelector((state: RootState) => state.battle.selectedSourceId);
    const selectedTargetId = useSelector((state: RootState) => state.battle.selectedTargetId);
    const selectedCardId = useSelector((state: RootState) => state.battle.selectedCardId);
    const save = useSelector((state: RootState) => state.game);

    const [hoveredUnitId, setHoveredUnitId] = useState<string | null>(null);
    const [showTurnBanner, setShowTurnBanner] = useState(false);
    const [dragPoint, setDragPoint] = useState<{ x: number, y: number } | null>(null);
    const [originPoint, setOriginPoint] = useState<{ x: number, y: number } | null>(null);
    const [isTargeting, setIsTargeting] = useState(false);
    const [hoveredEntityId, setHoveredEntityId] = useState<string | null>(null);

    // Epic 3.5: Post-battle state
    const [rewardBundle, setRewardBundle] = useState<IRewardBundle | null>(null);
    const [showReport, setShowReport] = useState(false);

    // Combat juice: event-bus driven VFX (floats, flashes, lunges, arena shake)
    const vfx = useBattleVfx(battleState);
    const { triggerLunge } = vfx; // stable callback, safe as an effect dep
    const stageControls = useAnimation();

    // Stage fade-in on mount (was a declarative animate; controls now own it so
    // the big-hit shake below can share the same motion component).
    useEffect(() => {
        stageControls.start({ opacity: 1, transition: { duration: 1 } });
    }, [stageControls]);

    // Big hits (>= 33% max HP) nudge the whole arena a few px.
    useEffect(() => {
        if (!vfx.shakeKey || prefersReducedMotion()) return;
        stageControls.start({ x: [0, -3, 3, -2, 2, 0], transition: { duration: 0.22 } });
    }, [vfx.shakeKey, stageControls]);

    const prevSideRef = useRef(battleState?.activeSide);
    // Separate ref for the enemy-AI effect so it doesn't race the turn-banner effect
    // (sharing prevSideRef meant the "wait for banner" branch never triggered).
    const aiPrevSideRef = useRef(battleState?.activeSide);

    // Clear the selected source if that unit dies
    useEffect(() => {
        if (!selectedSourceId || !battleState) return;
        const selected = battleState.playerParty.find(p => p.id === selectedSourceId);
        if (!selected || selected.currentHp <= 0) {
            dispatch(selectSource(null));
        }
    }, [battleState, selectedSourceId, dispatch]);

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

            // W, E, R: Select Player Units (skip dead units)
            const selectAliveUnit = (index: number) => {
                const unit = battleState.playerParty[index];
                if (unit && unit.currentHp > 0) dispatch(selectSource(unit.id));
            };
            if (e.key.toLowerCase() === 'w') selectAliveUnit(0);
            if (e.key.toLowerCase() === 'e') selectAliveUnit(1);
            if (e.key.toLowerCase() === 'r') selectAliveUnit(2);

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
            const aliveParty = battleState.playerParty.filter(p => p.currentHp > 0);
            if (aliveParty.length === 0) return;
            const currentIndex = aliveParty.findIndex(p => p.id === selectedSourceId);
            if (currentIndex === -1) return;

            let nextIndex = currentIndex + (e.deltaY > 0 ? 1 : -1);
            if (nextIndex < 0) nextIndex = aliveParty.length - 1;
            if (nextIndex >= aliveParty.length) nextIndex = 0;

            dispatch(selectSource(aliveParty[nextIndex].id));
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
        if (!battleState || battleState.activeSide !== 'ENEMY') {
            if (aiPrevSideRef.current !== battleState?.activeSide) {
                aiPrevSideRef.current = battleState?.activeSide;
            }
            return;
        }

        // Check if battle is over
        const isOver = battleState.playerParty.every(p => p.currentHp <= 0) ||
            battleState.enemyParty.every(e => e.currentHp <= 0);
        if (isOver) return;

        let cancelled = false;

        const runAI = async () => {
            // Wait for turn banner if this is the start of the enemy turn
            if (aiPrevSideRef.current !== 'ENEMY') {
                await new Promise(r => setTimeout(r, 1200));
            } else {
                // Delay between actions
                await new Promise(r => setTimeout(r, 600));
            }

            if (cancelled) return;
            aiPrevSideRef.current = 'ENEMY';

            const action = getBestAction(battleState);

            if (action.type === 'PLAY_PROGRAM') {
                dispatch(playProgram(action.payload));
            } else if (action.type === 'EXECUTE_INTENT') {
                // EXECUTE_INTENT emits no PROGRAM_PLAYED event, so nudge the
                // attacker's lunge from here (purely visual, no reducer delay).
                triggerLunge(action.payload.sourceId);
                dispatch(executeIntent(action.payload));
            } else if (action.type === 'END_TURN') {
                dispatch(endTurn());
            }
        };

        runAI();

        return () => { cancelled = true; };
    }, [battleState, dispatch, triggerLunge]);

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
        setIsTargeting(false);
    };

    const isVictory = battleState?.enemyParty.every(e => e.currentHp <= 0) ?? false;
    // Victory takes precedence: if both sides fall in the same resolution, count it as a win
    // so the defeat overlay never renders and the save is never wiped.
    const isDefeat = !isVictory && (battleState?.playerParty.every(p => p.currentHp <= 0) ?? false);

    // Epic 3.5: Wipe save on defeat (never on victory)
    useEffect(() => {
        if (isDefeat && !isVictory) {
            deleteSave();
        }
    }, [isDefeat, isVictory]);

    const rosterSize = useSelector((state: RootState) => state.game.roster.length);

    // Audio: battle-end stinger, played once per battle (seed = battle identity;
    // gauntlets chain battles without ever passing through battleState === null).
    const endSoundPlayedRef = useRef(false);
    const battleSeed = battleState?.seed;
    useEffect(() => {
        endSoundPlayedRef.current = false;
    }, [battleSeed]);
    useEffect(() => {
        if (endSoundPlayedRef.current) return;
        if (isVictory) {
            endSoundPlayedRef.current = true;
            playSfx('victory');
        } else if (isDefeat) {
            endSoundPlayedRef.current = true;
            playSfx('defeat');
        }
    }, [isVictory, isDefeat]);

    // Audio: charge-up zap when a next-program discount primes on a player unit
    // (e.g. Gullinbursti's UNSTOPPABLE_MASS). Watches the modifier appearing.
    const primedIdsRef = useRef<Set<string>>(new Set());
    useEffect(() => {
        const next = new Set<string>();
        battleState?.playerParty.forEach(p => {
            if (p.nextProgramModifier) next.add(p.id);
        });
        for (const id of next) {
            if (!primedIdsRef.current.has(id)) {
                playSfx('discountPrimed');
                break;
            }
        }
        primedIdsRef.current = next;
    }, [battleState]);

    // Roll rewards on victory
    useEffect(() => {
        if (isVictory && !rewardBundle && battleState) {
            let bundle = rollDropTable(battleState.enemyParty, rosterSize, battleState.seed);

            // Check for Gauntlet completion to add Relic choices
            if (save.gauntlet && save.gauntlet.currentBattleIndex >= save.gauntlet.totalBattles - 1) {
                const allRelics = Object.keys(RelicRegistry);
                const available = allRelics.filter(r => !save.relics.includes(r));

                if (available.length > 0) {
                    const prng = new PRNG(Date.now().toString());
                    const { shuffled } = prng.shuffle(available);
                    bundle = { ...bundle, relicChoices: shuffled.slice(0, 3) };
                }

                // GYM CLEAR: the single pick-1-of-3 upgrades into a 3-round
                // sequential mini-draft weighted toward the gym's element.
                // cardChoices are replaced (not stacked) — scrap/blueprints
                // and everything else the bundle grants stay unchanged.
                if (save.gauntlet.type === 'Gym') {
                    bundle = {
                        ...bundle,
                        cardChoices: [],
                        draftRounds: rollDraftRounds(
                            `${battleState.seed}-gym-draft`,
                            save.gauntlet.element as Element
                        )
                    };
                }
            }

            setRewardBundle(bundle);
        }
    }, [isVictory, battleState?.enemyParty, battleState?.seed, rewardBundle, rosterSize, save.gauntlet, save.relics]);

    const handleDefeatReset = () => {
        deleteSave();
        dispatch(resetSave());
        window.location.reload();
    };

    const handleContinue = (chosenCards: IOwnedProgram[], chosenRelic?: string) => {
        if (battleState) {
            // Ticket 21: `syncPartyStats` used to write level and XP back to the roster here.
            // With leveling removed it had nothing left to persist and was deleted; a battle no
            // longer mutates the roster at all.

            if (save.gauntlet) {
                const persistedStats: Record<string, { hp: number }> = {};
                battleState.playerParty.forEach(p => {
                    persistedStats[p.id] = { hp: p.currentHp };
                });
                dispatch(updateGauntlet({ persistedStats }));
            }
        }
        if (rewardBundle) {
            const finalBundle: IRewardBundle = {
                ...rewardBundle,
                cards: chosenCards
            };
            dispatch(applyRewardAction(finalBundle));
            if (chosenRelic) {
                dispatch(addRelic(chosenRelic));
            }
        }

        if (save.gauntlet) {
            if (save.gauntlet.currentBattleIndex >= save.gauntlet.totalBattles - 1) {
                dispatch(completeGauntlet());
                dispatch(setBattleState(null as any));
            } else {
                const updatedSave = (store.getState() as RootState).game;
                dispatch(startBattle({ save: updatedSave, enemyIds: [] }));

                setRewardBundle(null);
                setShowReport(false);
            }
        } else {
            dispatch(setBattleState(null as any));
        }
    };

    if (!battleState) return <div className="battle-screen">Loading Battle...</div>;

    // Helper: get the currently selected card's program data
    const getSelectedCardData = () => {
        if (!battleState || !selectedCardId) return null;
        const card = battleState.playerDeck.hand.find(c => c.id === selectedCardId);
        if (!card) return null;
        return GetProgramData(card.dataId);
    };

    // ── Shared targeting logic ──
    // One source of truth for "can this card land on this unit", used by BOTH
    // the sidebar HUD cards and the center-stage spotlights.
    const isValidCardTarget = (cardData: ReturnType<typeof GetProgramData>, isEnemy: boolean) => {
        const targetType = cardData.target;
        return (
            (isEnemy && (targetType === 'Single' || targetType === 'Side' || targetType === 'All')) ||
            (!isEnemy && (targetType === 'Self' || targetType === 'Side' || targetType === 'All')) ||
            (!isEnemy && cardData.actions.some(a => a.type === 'HEAL' || a.type === 'STATUS'))
        );
    };

    /** Drop a dragged/selected card on this unit (sidebar card or stage spotlight). */
    const handleEntityPointerUp = (entity: IBattleEntity, isEnemy: boolean) => {
        if (!selectedCardId || entity.currentHp <= 0) return;
        const cardData = getSelectedCardData();
        if (!cardData) return;

        if (isValidCardTarget(cardData, isEnemy)) {
            // For Self cards, always target the source
            const effectiveTargetId = cardData.target === 'Self' ? (selectedSourceId || entity.id) : entity.id;
            handlePlay(selectedCardId, effectiveTargetId);
            dispatch(selectCard(null));
        }
    };

    /** Click a unit (sidebar card or stage spotlight): target enemies / select allies. */
    const handleEntityClick = (entity: IBattleEntity, isEnemy: boolean) => {
        if (entity.currentHp <= 0) return;
        const isTargeted = selectedTargetId === entity.id;

        // If we have a card selected, check if this is a valid target
        if (selectedCardId) {
            const cardData = getSelectedCardData();
            if (cardData && isValidCardTarget(cardData, isEnemy)) {
                dispatch(selectTarget(isTargeted ? null : entity.id));
                return;
            }
        }

        // Default behavior: enemy = target, friendly = source
        if (isEnemy) {
            dispatch(selectTarget(isTargeted ? null : entity.id));
        } else {
            dispatch(selectSource(selectedSourceId === entity.id ? null : entity.id));
        }
    };

    const renderParty = (party: readonly IBattleEntity[], isEnemy: boolean) => (
        <div className={`party-column ${isEnemy ? 'enemy-side' : 'player-side'}`}>
            {party.map((entity, index) => {
                const isSelected = selectedSourceId === entity.id;
                const isTargeted = selectedTargetId === entity.id;
                const isDead = entity.currentHp <= 0;

                if (!entity.id) {
                    console.warn(`[BattleArena] Entity at index ${index} (isEnemy: ${isEnemy}) has an empty ID!`);
                }
                const entityKey = entity.id || `entity-${isEnemy ? 'enemy' : 'player'}-${index}`;

                const translateX = 0;

                return (
                    <motion.div
                        key={entityKey}
                        initial={{ opacity: 0, x: isEnemy ? 100 : -100 }}
                        animate={{ opacity: isDead ? 0.55 : 1, x: translateX, scale: isDead ? 0.96 : 1 }}
                        transition={{ delay: index * 0.1, type: 'spring' }}
                        // Pointer events must stay 'auto' even for dead units,
                        // so they can correctly receive the 'onPointerUp' to clear targeting state.
                        // Desaturation of dead units lives on .hud-dead (inside the card),
                        // so the TERMINATED stamp keeps its neon red.
                        style={{ pointerEvents: 'auto' }}
                        onMouseEnter={() => {
                            if (isTargeting) setHoveredEntityId(entity.id);
                        }}
                        onMouseLeave={() => {
                            if (hoveredEntityId === entity.id) setHoveredEntityId(null);
                        }}
                        onPointerUp={() => handleEntityPointerUp(entity, isEnemy)}
                    >
                        <MingmingUnit
                            entity={entity}
                            isEnemy={isEnemy}
                            isSelected={isSelected}
                            isTargeted={isTargeted}
                            fx={vfx.unitFx[entity.id]}
                            battleState={battleState}
                            selectedCardId={selectedCardId}
                            selectedSourceId={selectedSourceId}
                            isHoveredTarget={hoveredEntityId === entity.id}
                            onClick={() => handleEntityClick(entity, isEnemy)}
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
            {/* Audio toggle/volume — the nav bar (its usual home) is hidden in battle */}
            <AudioControls floating />

            {/* Breach progress: small truthful indicator of which breach battle this is */}
            {save.gauntlet && (
                <div
                    style={{
                        position: 'fixed',
                        top: '10px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 1500,
                        pointerEvents: 'none',
                        padding: '4px 14px',
                        borderRadius: '4px',
                        background: 'rgba(0, 0, 0, 0.55)',
                        border: '1px solid rgba(255, 204, 0, 0.35)',
                        color: '#ffcc00',
                        fontSize: '0.7rem',
                        fontWeight: 900,
                        letterSpacing: '3px'
                    }}
                >
                    BREACH — BATTLE {Math.min(save.gauntlet.currentBattleIndex + 1, save.gauntlet.totalBattles)}/{save.gauntlet.totalBattles}
                </div>
            )}

            {/* Ticket 90, playtest round 1: Henry had no way to see the turn number or how many
                cards he had played - and `stampede`/`momentum_crash` scale on exactly that count,
                so the deck's whole plan was invisible while piloting it. Fixed to the top-left,
                out of the way of the party columns and the card fan. */}
            <div
                style={{
                    position: 'fixed', top: '10px', left: '12px', zIndex: 1500, pointerEvents: 'none',
                    display: 'flex', gap: '8px', alignItems: 'center',
                    fontSize: '0.7rem', fontWeight: 900, letterSpacing: '2px',
                }}
            >
                <span style={{
                    padding: '4px 12px', borderRadius: '4px', background: 'rgba(0,0,0,0.55)',
                    border: '1px solid rgba(255,255,255,0.18)', color: '#e8e4dc',
                }}>
                    TURN {battleState.turn}
                </span>
                <span
                    title="Cards you have played this turn - what stampede, momentum crash and the other per-card scalers multiply by."
                    style={{
                        padding: '4px 12px', borderRadius: '4px', background: 'rgba(0,0,0,0.55)',
                        border: `1px solid ${battleState.cardsPlayedThisTurn > 0 ? 'rgba(0,229,255,0.45)' : 'rgba(255,255,255,0.18)'}`,
                        color: battleState.cardsPlayedThisTurn > 0 ? '#00e5ff' : '#8a837b',
                    }}
                >
                    CARDS PLAYED {battleState.cardsPlayedThisTurn}
                </span>
            </div>

            <AnimatePresence>
                {showTurnBanner && <TurnBanner key="turn-banner" side={battleState.activeSide} />}
                {isVictory && !showReport && (
                    <WinLossOverlay
                        key="win-overlay"
                        result="WIN"
                        onShowReport={() => setShowReport(true)}
                    />
                )}
                {isDefeat && (
                    <WinLossOverlay
                        key="loss-overlay"
                        result="LOSS"
                        onDefeatReset={handleDefeatReset}
                    />
                )}
                {isVictory && showReport && rewardBundle && (
                    <BattleReport
                        key="battle-report"
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

            {/* Stage: Top 70% (controls: fade-in on mount + big-hit shake) */}
            <motion.div
                className="stage-area"
                initial={{ opacity: 0 }}
                animate={stageControls}
            >
                {/* Center stage: big spotlight sprites for the selected unit + focus enemy */}
                <BattleStage
                    battleState={battleState}
                    selectedSourceId={selectedSourceId}
                    selectedTargetId={selectedTargetId}
                    hoveredEntityId={hoveredEntityId}
                    isTargeting={isTargeting}
                    unitFx={vfx.unitFx}
                    onEntityClick={handleEntityClick}
                    onEntityPointerUp={handleEntityPointerUp}
                    onEnemyHoverChange={setHoveredEntityId}
                />

                {renderParty(battleState.playerParty, false)}

                <CombatLog />

                {renderParty(battleState.enemyParty, true)}
            </motion.div>

            <div
                className="console-area"
                onPointerUp={() => {
                    setDragPoint(null);
                    setOriginPoint(null);
                }}
            >
                <CardHand
                    hoveredEntityId={hoveredEntityId}
                    onTargetingStart={(point) => {
                        setOriginPoint(point);
                        setIsTargeting(true);
                    }}
                    onTargetingEnd={() => {
                        setIsTargeting(false);
                        setDragPoint(null);
                        setOriginPoint(null);
                        setHoveredEntityId(null);
                    }}
                />
            </div>
        </div>
    );
};


export default BattleArena;
