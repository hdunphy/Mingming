import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '../store/store';
import { startBattle } from '../store/battleSlice';
import { startGauntlet } from '../store/gameSlice';
import type { Element } from '../../engine/types';
import { MIN_DECK_SIZE } from '../../engine/gameTypes';

/**
 * Epic 8: Milestone 8.2 - Terminal Hub UI
 * Allows players to select Training Sectors or Gym Gauntlets.
 */

const SECTORS: { id: Element; label: string; description: string; color: string; unlocked: boolean }[] = [
    { id: 'Fire', label: 'FIRE SECTOR', description: 'Volcanic ridges. High Blueprint yield.', color: '#ef4444', unlocked: true },
    { id: 'Water', label: 'WATER SECTOR', description: 'Abyssal depths. Fluid Program rewards.', color: '#3b82f6', unlocked: true },
    { id: 'Nature', label: 'NATURE SECTOR', description: 'Overgrown ruins. Resource-rich farming.', color: '#10b981', unlocked: true },
    { id: 'Earth', label: 'EARTH SECTOR', description: 'Crystal caves. Dense hardware drops.', color: '#8b5e3c', unlocked: false },
    { id: 'Air', label: 'AIR SECTOR', description: 'Cloud spires. Fast-paced encounters.', color: '#06b6d4', unlocked: false },
    { id: 'Ice', label: 'ICE SECTOR', description: 'Frozen wastes. High-risk challenges.', color: '#60a5fa', unlocked: false },
    { id: 'Light', label: 'LIGHT SECTOR', description: 'Solar arrays. Rare OS modules.', color: '#fbbf24', unlocked: false },
    { id: 'Dark', label: 'DARK SECTOR', description: 'Shadow realms. Apex encounters.', color: '#6366f1', unlocked: false },
];

const SectorTerminal: React.FC = () => {
    const dispatch = useDispatch();
    const save = useSelector((state: RootState) => state.game);
    const [selectedSector, setSelectedSector] = useState<Element | null>(null);

    // Deployment readiness guard (mirrors HubScreen): need an active party member and a valid deck
    const activeMingming = save.roster.find(m => m.id === save.activeParty[0]);
    const deckCount = save.activeDeck?.cards.length || 0;
    const hasParty = !!activeMingming;
    const isDeckValid = deckCount >= MIN_DECK_SIZE;
    const canDeploy = hasParty && isDeckValid;

    const handleStartSector = (element: Element) => {
        // Validate before dispatching anything: an empty party or invalid deck
        // would make startBattle throw, and must never leave a dangling gauntlet.
        if (!canDeploy || save.gauntlet) return;

        const isUnlocked = save.unlockedSectors.includes(element);
        if (isUnlocked) {
            try {
                dispatch(startBattle({ save, enemyIds: [], sectorElement: element }));
            } catch (err) {
                console.error('[SectorTerminal] Failed to start sector battle:', err);
            }
        } else {
            // Pass explicitly updated save to avoid React state staleness
            const newSave = {
                ...save,
                gauntlet: {
                    type: 'Gym' as const,
                    element,
                    currentBattleIndex: 0,
                    totalBattles: 3,
                    persistedStats: {}
                }
            };

            // Start the battle FIRST; only persist the gauntlet once the battle
            // actually started, so a failed startBattle can't strand the save
            // with an active gauntlet and no battle.
            try {
                dispatch(startBattle({ save: newSave, enemyIds: [] }));
                dispatch(startGauntlet({ type: 'Gym', element, totalBattles: 3 }));
            } catch (err) {
                console.error('[SectorTerminal] Failed to start gym gauntlet:', err);
            }
        }
    };

    return (
        <div className="terminal-container" style={{
            height: '100%',
            padding: '40px',
            color: '#fff',
            fontFamily: "'Inter', sans-serif"
        }}>
            <header style={{ marginBottom: '40px' }}>
                <h1 style={{ fontSize: '2.5rem', fontWeight: '900', margin: 0, letterSpacing: '-1px' }}>
                    TERMINAL_<span style={{ color: '#7c3aed' }}>HUB</span>
                </h1>
                <p style={{ opacity: 0.5, fontSize: '0.9rem' }}>SYSTEM STATUS: ONLINE | SECTOR SCANNER ACTIVE</p>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '40px', height: 'calc(100% - 120px)' }}>
                {/* Sector Grid */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: '20px',
                    overflowY: 'auto',
                    paddingRight: '10px'
                }}>
                    {SECTORS.map((sector) => (
                        <motion.div
                            key={sector.id}
                            whileHover={{ scale: 1.02, y: -5 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setSelectedSector(sector.id)}
                            style={{
                                background: 'rgba(255,255,255,0.03)',
                                border: `1px solid ${selectedSector === sector.id ? sector.color : save.unlockedSectors.includes(sector.id) ? 'rgba(255,255,255,0.1)' : 'rgba(255,0,0,0.2)'}`,
                                borderRadius: '12px',
                                padding: '25px',
                                cursor: 'pointer',
                                position: 'relative',
                                overflow: 'hidden',
                                opacity: save.unlockedSectors.includes(sector.id) ? 1 : 0.7,
                                transition: 'border-color 0.2s'
                            }}
                        >
                            <div style={{
                                position: 'absolute',
                                top: 0,
                                right: 0,
                                width: '60px',
                                height: '60px',
                                background: sector.color,
                                opacity: 0.1,
                                filter: 'blur(30px)'
                            }} />

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                                <span style={{
                                    fontSize: '0.7rem',
                                    fontWeight: 'bold',
                                    padding: '4px 8px',
                                    background: save.unlockedSectors.includes(sector.id) ? 'rgba(255,255,255,0.1)' : 'rgba(255,0,0,0.2)',
                                    borderRadius: '4px',
                                    color: save.unlockedSectors.includes(sector.id) ? '#fff' : '#ff4444'
                                }}>
                                    {save.unlockedSectors.includes(sector.id) ? 'AVAILABLE' : 'LOCKED'}
                                </span>
                                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: sector.color, boxShadow: `0 0 10px ${sector.color}` }} />
                            </div>

                            <h3 style={{ margin: '0 0 10px', fontSize: '1.2rem' }}>{sector.label}</h3>
                            <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.6, lineHeight: '1.4' }}>{sector.description}</p>
                        </motion.div>
                    ))}
                </div>

                {/* Detail / Action Panel */}
                <div style={{
                    background: 'rgba(0,0,0,0.3)',
                    borderRadius: '16px',
                    border: '1px solid rgba(255,255,255,0.05)',
                    padding: '30px',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    <AnimatePresence mode="wait">
                        {selectedSector ? (
                            <motion.div
                                key={selectedSector}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
                            >
                                <div style={{ marginBottom: '30px' }}>
                                    <h2 style={{ fontSize: '1.8rem', margin: '0 0 10px' }}>{SECTORS.find(s => s.id === selectedSector)?.label}</h2>
                                    <div style={{ height: '2px', width: '60px', background: SECTORS.find(s => s.id === selectedSector)?.color }} />
                                </div>

                                <div style={{ flex: 1 }}>
                                    <p style={{ fontSize: '1rem', opacity: 0.8, marginBottom: '20px' }}>
                                        {save.unlockedSectors.includes(selectedSector)
                                            ? `Deploying to ${selectedSector} Sector. Expect enemy groups matching this element. High density of localized Blueprints detected.`
                                            : `CHALLENGE GYM GAUNTLET: Defeat the ${selectedSector} Gym Leader to unlock this sector. Prepare for a grueling 3-tier endurance battle.`}
                                    </p>

                                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
                                        <div style={{ fontSize: '0.8rem', opacity: 0.5, marginBottom: '10px' }}>EXPECTED REWARDS</div>
                                        <ul style={{ padding: '0 0 0 20px', margin: 0, fontSize: '0.9rem', color: '#7c3aed' }}>
                                            {save.unlockedSectors.includes(selectedSector) ? (
                                                <>
                                                    <li>Elemental Program Data</li>
                                                    <li>Core Level XP</li>
                                                    <li>Randomized Hardware Fragments</li>
                                                </>
                                            ) : (
                                                <>
                                                    <li>Sector Unlock</li>
                                                    <li>Rare Relic Selection</li>
                                                    <li>Boss Data</li>
                                                </>
                                            )}
                                        </ul>
                                    </div>
                                </div>

                                {save.gauntlet && (
                                    <div style={{ color: '#ef4444', marginBottom: '15px', fontWeight: 'bold', fontSize: '0.9rem', textAlign: 'center' }}>
                                        ⚠️ WARNING: ACTIVE GAUNTLET DETECTED. RETURN TO HUB TO CONTINUE.
                                    </div>
                                )}

                                {!save.gauntlet && !canDeploy && (
                                    <div style={{ color: '#ef4444', marginBottom: '15px', fontWeight: 'bold', fontSize: '0.9rem', textAlign: 'center' }}>
                                        {!hasParty
                                            ? '⚠️ NO ACTIVE PARTY. ASSIGN A MINGMING IN THE ROSTER TERMINAL.'
                                            : `⚠️ DECK TOO SMALL (${deckCount}/${MIN_DECK_SIZE}). CONFIGURE IN THE DECK TERMINAL.`}
                                    </div>
                                )}

                                <button
                                    onClick={() => handleStartSector(selectedSector)}
                                    className="terminal-button primary"
                                    disabled={!!save.gauntlet || !canDeploy}
                                    style={{
                                        width: '100%',
                                        padding: '18px',
                                        background: (save.gauntlet || !canDeploy) ? '#333' : SECTORS.find(s => s.id === selectedSector)?.color,
                                        border: 'none',
                                        borderRadius: '8px',
                                        color: (save.gauntlet || !canDeploy) ? '#888' : '#fff',
                                        fontWeight: 'bold',
                                        fontSize: '1rem',
                                        cursor: (save.gauntlet || !canDeploy) ? 'not-allowed' : 'pointer',
                                        boxShadow: (save.gauntlet || !canDeploy) ? 'none' : `0 10px 20px -5px ${SECTORS.find(s => s.id === selectedSector)?.color}66`
                                    }}
                                >
                                    {save.gauntlet ? 'SYSTEM LOCKED' : !canDeploy ? 'DEPLOYMENT BLOCKED' : save.unlockedSectors.includes(selectedSector) ? 'INITIATE DEPLOYMENT' : 'INITIATE GYM GAUNTLET'}
                                </button>
                            </motion.div>
                        ) : (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', opacity: 0.3 }}>
                                <div style={{ fontSize: '4rem', marginBottom: '20px' }}>📡</div>
                                <p>SELECT A SECTOR TO INITIALIZE SCAN</p>
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};

export default SectorTerminal;
