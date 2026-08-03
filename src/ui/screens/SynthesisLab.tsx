import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { motion } from 'framer-motion';
import type { RootState } from '../store/store';
import {
    removeCardFromInventory,
    addScrap,
    spendScrap,
    addToRoster,
    addBlueprint
} from '../store/gameSlice';
import { getScrapYield } from '../../engine/RewardSystem';
import { GetProgramData } from '../../engine/data/programRegistry';
import { GetMingmingData } from '../../engine/data/mingmingRegistry';
import { createMingmingInstance } from '../../engine/gameTypes';
import type { IBlueprint } from '../../engine/gameTypes';
import { getOSBehavior } from '../../engine/data/firmwareRegistry';
import ProgramCard, { getElementColor, getElementIcon } from '../components/ProgramCard';
import RevealCard, { REVEAL_STAGGER_MS } from '../components/RevealCard';
import { prefersReducedMotion } from '../utils/motionPrefs';

// --- First-synthesis celebration timing (ms) ---
/** Cards start flipping once the name slam has landed. */
const FAN_BASE_DELAY_MS = 700;
/** 'BASE DECK ACQUIRED' caption lands after the last card flips. */
const CAPTION_DELAY_MS = FAN_BASE_DELAY_MS + 9 * REVEAL_STAGGER_MS + 550;
/** Celebration auto-dismisses if not clicked through. */
const CELEBRATION_AUTO_DISMISS_MS = 8000;

interface CelebrationData {
    name: string;
    element: string;
    cardIds: string[];
}

/**
 * First-synthesis payoff: the new Mingming's name/element slams in, its 10
 * base-deck cards appear face-down in a two-row arc (5 + 5, full-size shared
 * RevealCard faces — the same real ProgramCards you see in your hand) and flip
 * over in a stagger, capped with a 'BASE DECK ACQUIRED' caption.
 * Click anywhere to dismiss; auto-dismisses via the parent's timer.
 */
const BaseDeckCelebration: React.FC<{ data: CelebrationData; onDismiss: () => void }> = ({ data, onDismiss }) => {
    const reduced = prefersReducedMotion();
    const accent = getElementColor(data.element);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={onDismiss}
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 4000,
                background: 'rgba(3, 4, 8, 0.94)',
                backdropFilter: 'blur(12px)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                overflow: 'hidden'
            }}
        >
            {/* Content column — capped/scaled via CSS so the whole beat fits 1280×720 */}
            <div
                className="celebration-content"
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
            >
                {/* Name slam */}
                <motion.h1
                    initial={reduced
                        ? { opacity: 0 }
                        : { scale: 2.4, opacity: 0, filter: 'blur(14px)', letterSpacing: '0.6em' }}
                    animate={reduced
                        ? { opacity: 1 }
                        : { scale: 1, opacity: 1, filter: 'blur(0px)', letterSpacing: '0.12em' }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
                    style={{
                        margin: 0,
                        fontSize: '3.6rem',
                        fontWeight: 900,
                        color: '#fff',
                        textShadow: `0 0 30px ${accent}`
                    }}
                >
                    {data.name.toUpperCase()}
                </motion.h1>
                <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.45, duration: 0.3 }}
                    style={{
                        marginTop: '6px',
                        fontSize: '0.95rem',
                        fontWeight: 900,
                        letterSpacing: '5px',
                        color: accent,
                        textShadow: `0 0 12px ${accent}`
                    }}
                >
                    {getElementIcon(data.element)} {data.element.toUpperCase()} CLASS COMPILED
                </motion.div>
    
                {/* Base deck: 10 full-size cards in a gentle 5+5 two-row arc.
                    Each face is the real ProgramCard (via the shared RevealCard flip),
                    sized like the battle-report reward row so every name/cost/category
                    stays readable — slight per-column dip/tilt for flair, near-zero
                    overlap. */}
                <div className="celebration-deck-grid">
                    {data.cardIds.map((dataId, i) => {
                        const col = i % 5;
                        const arcTilt = (col - 2) * 1.6; // deg — edges tilt outward
                        const arcDip = Math.abs(col - 2) * 7; // px — edges dip down
                        return (
                            <div
                                key={`${dataId}-${i}`}
                                style={{
                                    transform: reduced
                                        ? 'none'
                                        : `translateY(${arcDip}px) rotate(${arcTilt}deg)`
                                }}
                            >
                                <RevealCard
                                    data={GetProgramData(dataId)}
                                    revealDelayMs={FAN_BASE_DELAY_MS + i * REVEAL_STAGGER_MS}
                                    disabled
                                />
                            </div>
                        );
                    })}
                </div>
    
                {/* Caption beat */}
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: CAPTION_DELAY_MS / 1000, duration: 0.35, ease: 'easeOut' }}
                    style={{
                        marginTop: '30px',
                        fontSize: '1.3rem',
                        fontWeight: 900,
                        letterSpacing: '6px',
                        color: '#00ffaa',
                        textShadow: '0 0 18px rgba(0, 255, 170, 0.8)'
                    }}
                >
                    BASE DECK ACQUIRED
                </motion.div>
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.5 }}
                    transition={{ delay: CAPTION_DELAY_MS / 1000 + 0.4, duration: 0.4 }}
                    style={{ marginTop: '14px', fontSize: '0.7rem', letterSpacing: '3px', color: '#8892a8' }}
                >
                    CLICK ANYWHERE TO CONTINUE
                </motion.div>
            </div>
        </motion.div>
    );
};

export default function SynthesisLab() {
    const dispatch = useDispatch();
    const { cardInventory, scrapCount, blueprints, baseDecksGranted } = useSelector((s: RootState) => s.game);
    const [selectedCards, setSelectedCards] = useState<Map<string, string[]>>(new Map()); // dataId -> instanceIds
    const [lastCompiled, setLastCompiled] = useState<string | null>(null);
    const [celebration, setCelebration] = useState<CelebrationData | null>(null);
    const [isInstalling, setIsInstalling] = useState<IBlueprint | null>(null);
    const [selectedOS, setSelectedOS] = useState<string | null>(null);

    // All pending timeouts cleared on unmount (pendingTimeoutsRef pattern).
    const pendingTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
    useEffect(() => {
        const timeouts = pendingTimeoutsRef.current;
        return () => {
            timeouts.forEach(clearTimeout);
            timeouts.length = 0;
        };
    }, []);
    const schedule = (fn: () => void, ms: number) => {
        pendingTimeoutsRef.current.push(setTimeout(fn, ms));
    };

    const selectedScrap = useMemo(() => {
        let total = 0;
        selectedCards.forEach((ids, dataId) => {
            // Pass the card's rarity so the rarity yield table actually applies
            const rarity = GetProgramData(dataId)?.rarity;
            total += ids.length * getScrapYield(rarity);
        });
        return total;
    }, [selectedCards]);

    const addOne = (dataId: string, availableIds: string[]) => {
        setSelectedCards(prev => {
            const next = new Map(prev);
            const current = next.get(dataId) || [];
            if (current.length < availableIds.length) {
                // Find an ID not already selected
                const nextId = availableIds.find(id => !current.includes(id));
                if (nextId) next.set(dataId, [...current, nextId]);
            }
            return next;
        });
    };

    const removeOne = (dataId: string) => {
        setSelectedCards(prev => {
            const next = new Map(prev);
            const current = next.get(dataId) || [];
            if (current.length > 0) {
                const updated = current.slice(0, -1);
                if (updated.length === 0) next.delete(dataId);
                else next.set(dataId, updated);
            }
            return next;
        });
    };

    const scrapSelected = () => {
        selectedCards.forEach(ids => {
            ids.forEach(id => dispatch(removeCardFromInventory(id)));
        });
        dispatch(addScrap(selectedScrap));
        setSelectedCards(new Map());
    };

    const compileMingming = (architectureId: string, cost: number, activeOS: string) => {
        if (scrapCount < cost) return;
        // First compile of a species also grants its base deck (handled in addToRoster)
        const firstSynthesis = !baseDecksGranted.includes(architectureId);
        dispatch(spendScrap(cost));
        const newMm = {
            ...createMingmingInstance(architectureId, 1),
            activeOS
        };
        dispatch(addToRoster(newMm));
        setIsInstalling(null);
        setSelectedOS(null);

        if (firstSynthesis) {
            // Base-deck kit granted: full celebration beat (name slam → card
            // fan flip → 'BASE DECK ACQUIRED'). Click-through or auto-dismiss.
            const def = GetMingmingData(architectureId);
            setCelebration({
                name: def.name,
                element: def.primaryElement,
                cardIds: [...def.baseDeck]
            });
            schedule(() => setCelebration(null), CELEBRATION_AUTO_DISMISS_MS);
        } else {
            // Re-synthesis (no base deck): keep the simple success flash.
            setLastCompiled(architectureId);
            schedule(() => setLastCompiled(null), 2000);
        }
    };

    const groupedCardInventory = useMemo(() => {
        const groups: Record<string, { dataId: string; instances: string[]; data: any }> = {};
        cardInventory.forEach(c => {
            if (!groups[c.dataId]) {
                groups[c.dataId] = { dataId: c.dataId, instances: [], data: GetProgramData(c.dataId) };
            }
            groups[c.dataId].instances.push(c.instanceId);
        });
        return Object.values(groups);
    }, [cardInventory]);

    return (
        <div className="synthesis-lab">
            <div className="synthesis-header">
                <h1>🔬 Synthesis Lab</h1>
                <div className="scrap-balance">
                    <span className="scrap-icon">⚙️</span>
                    <span className="scrap-count">{scrapCount}</span>
                    <span className="scrap-label">Scrap</span>
                </div>
            </div>

            <div className="synthesis-body">
                {/* Left: Deconstruction */}
                <div className="synthesis-panel">
                    <h2>🔥 Deconstruct Programs</h2>
                    <p className="synthesis-hint">Select cards to scrap for materials</p>

                    <div className="card-grid">
                        {groupedCardInventory.length === 0 && (
                            <div className="empty-state">No cards to scrap</div>
                        )}
                        {groupedCardInventory.map(group => {
                            const selectedIds = selectedCards.get(group.dataId) || [];
                            return (
                                <ProgramCard
                                    key={group.dataId}
                                    data={group.data}
                                    count={group.instances.length}
                                    showBadge={selectedIds.length > 0 ? `${selectedIds.length} MARKED` : undefined}
                                    onClick={() => {
                                        addOne(group.dataId, group.instances);
                                    }}
                                    onContextMenu={(e) => {
                                        e.preventDefault();
                                        removeOne(group.dataId);
                                    }}
                                />
                            );
                        })}
                    </div>

                    <p style={{ fontSize: '0.8rem', opacity: 0.5, textAlign: 'center' }}>
                        Left Click: Add to scrap | Right Click: Remove from scrap
                    </p>

                    {selectedScrap > 0 && (
                        <button className="scrap-button" onClick={scrapSelected}>
                            🔥 Scrap Identified Programs → +{selectedScrap} ⚙️
                        </button>
                    )}
                </div>

                {/* Right: Compilation */}
                <div className="synthesis-panel">
                    <h2>🛠️ Compile MingMing</h2>
                    <p className="synthesis-hint">Use Blueprints + Scrap to create units</p>

                    <div className="blueprint-grid">
                        {blueprints.length === 0 && (
                            <div className="empty-state">No blueprints found. Defeat enemies for rare drops!</div>
                        )}
                        {blueprints.map(bp => {
                            const canAfford = scrapCount >= bp.compileCost;
                            return (
                                <div
                                    key={bp.architectureId}
                                    className={`blueprint-card ${canAfford ? 'affordable' : 'locked'}`}
                                    onClick={() => canAfford && setIsInstalling(bp)}
                                >
                                    <div className="bp-name">{bp.name}</div>
                                    <div className="bp-cost">
                                        {bp.compileCost} ⚙️
                                    </div>
                                    {lastCompiled === bp.architectureId && (
                                        <div className="compile-flash">✨ Compiled!</div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* First-synthesis base-deck celebration */}
            {celebration && (
                <BaseDeckCelebration
                    data={celebration}
                    onDismiss={() => setCelebration(null)}
                />
            )}

            {/* Installation Wizard Overlay */}
            {isInstalling && (
                <div className="wizard-overlay">
                    <div className="wizard-modal">
                        <div className="wizard-header">
                            <h2>INSTALLATION WIZARD v1.4.2</h2>
                            <button className="close-wizard" onClick={() => setIsInstalling(null)}>×</button>
                        </div>
                        <div className="wizard-step-container">
                            <div className="wizard-title">SELECT OPERATING SYSTEM</div>
                            <div className="wizard-subtitle">Determining kernel architecture for {isInstalling.name}...</div>

                            <div className="os-choice-grid">
                                {['v1', 'v2'].map(v => {
                                    const osId = `${isInstalling.architectureId}_${v}`;
                                    const behavior = getOSBehavior(osId);
                                    const isSelected = selectedOS === osId;

                                    return (
                                        <div
                                            key={v}
                                            className={`os-choice-card ${isSelected ? 'selected' : ''}`}
                                            onClick={() => setSelectedOS(osId)}
                                        >
                                            <div className="os-choice-header">
                                                <span className="os-version-tag">{v.toUpperCase()} ARCH</span>
                                                <span className="os-name-tag">{behavior?.name}</span>
                                            </div>
                                            <div className="os-description">
                                                {behavior?.description}
                                            </div>
                                            <div className="os-select-indicator">
                                                {isSelected ? '✓ SELECTED' : 'SELECT CORE'}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="wizard-actions">
                                <button className="wizard-cancel" onClick={() => setIsInstalling(null)}>ABORT</button>
                                <button
                                    className="wizard-confirm"
                                    disabled={!selectedOS}
                                    onClick={() => compileMingming(isInstalling.architectureId, isInstalling.compileCost, selectedOS!)}
                                >
                                    INITIALIZE COMPILATION
                                </button>
                            </div>
                        </div>
                        <div className="wizard-footer">
                            READY TO FLASH // SCRAP COST: {isInstalling.compileCost}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
