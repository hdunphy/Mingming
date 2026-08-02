import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '../store/store';
import { startBattle } from '../store/battleSlice';
import { startGauntlet } from '../store/gameSlice';
import type { Element } from '../../engine/types';
import { MIN_DECK_SIZE } from '../../engine/gameTypes';
import { getSectorSpecies } from '../../engine/data/EncounterGenerator';
import { SALVAGE_CHOICES_PER_FOE, DRAFT_ROUND_COUNT } from '../../engine/RewardSystem';
import { TypeChartPanel } from '../components/TypeChart';
import { playSfx } from '../audio/AudioEngine';

/**
 * Epic 8: Milestone 8.2 - Terminal Hub UI
 * Allows players to select Training Sectors or Gym Gauntlets.
 */

const SECTORS: { id: Element; label: string; description: string; color: string; unlocked: boolean }[] = [
    { id: 'Fire', label: 'FIRE SECTOR', description: 'Volcanic ridges.', color: '#ef4444', unlocked: true },
    { id: 'Water', label: 'WATER SECTOR', description: 'Abyssal depths.', color: '#3b82f6', unlocked: true },
    { id: 'Nature', label: 'NATURE SECTOR', description: 'Overgrown ruins.', color: '#10b981', unlocked: true },
    { id: 'Earth', label: 'EARTH SECTOR', description: 'Crystal caves.', color: '#8b5e3c', unlocked: false },
    { id: 'Air', label: 'AIR SECTOR', description: 'Cloud spires.', color: '#06b6d4', unlocked: false },
    { id: 'Ice', label: 'ICE SECTOR', description: 'Frozen wastes.', color: '#60a5fa', unlocked: false },
    { id: 'Light', label: 'LIGHT SECTOR', description: 'Solar arrays.', color: '#fbbf24', unlocked: false },
    { id: 'Dark', label: 'DARK SECTOR', description: 'Shadow realms.', color: '#6366f1', unlocked: false },
];

/** Wild inhabitants line: element-colored discs + names, straight from the encounter pool. */
const SectorSpeciesLine: React.FC<{ element: Element; color: string }> = ({ element, color }) => {
    const species = getSectorSpecies(element);
    return (
        <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 'bold', letterSpacing: '2px', opacity: 0.45 }}>WILD:</span>
            {species.length > 0 ? (
                species.map(def => (
                    <span key={def.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', opacity: 0.8 }}>
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}` }} />
                        {def.name}
                    </span>
                ))
            ) : (
                <span style={{ fontSize: '0.7rem', letterSpacing: '1px', opacity: 0.4 }}>NO SIGNALS DETECTED</span>
            )}
        </div>
    );
};

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
        if (!canDeploy || save.gauntlet) {
            playSfx('uiError');
            return;
        }
        playSfx('uiClick');

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
                <p style={{ opacity: 0.5, fontSize: '0.9rem' }}>SYSTEM STATUS: ONLINE | SECTOR UPLINK ACTIVE</p>
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
                                    {save.unlockedSectors.includes(sector.id) ? 'OPEN' : 'FIREWALLED'}
                                </span>
                                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: sector.color, boxShadow: `0 0 10px ${sector.color}` }} />
                            </div>

                            <h3 style={{ margin: '0 0 10px', fontSize: '1.2rem' }}>{sector.label}</h3>
                            <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.6, lineHeight: '1.4' }}>{sector.description}</p>
                            <SectorSpeciesLine element={sector.id} color={sector.color} />
                        </motion.div>
                    ))}

                    {/* Matchup planner: full-width row at the end of the scrollable
                        sector list, collapsed by default so the grid stays clean. */}
                    <div style={{ gridColumn: '1 / -1' }}>
                        <TypeChartPanel />
                    </div>
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
                                            ? `Free deployment enabled. Wild ${selectedSector}-aligned Mingming roam this sector; enemy groups scale to your party's level.`
                                            : `FIREWALL ACTIVE — defeat the Sector Warden to unlock free deployment. Breach protocol: 3 escalating battles; your party's HP persists between them.`}
                                    </p>

                                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
                                        <div style={{ fontSize: '0.8rem', opacity: 0.5, marginBottom: '10px' }}>EXPECTED REWARDS</div>
                                        <ul style={{ padding: '0 0 0 20px', margin: 0, fontSize: '0.9rem', color: '#7c3aed' }}>
                                            {save.unlockedSectors.includes(selectedSector) ? (
                                                <>
                                                    <li>Card salvage — pick 1 of {SALVAGE_CHOICES_PER_FOE} per defeated foe, weighted to {selectedSector}</li>
                                                    <li>Scrap</li>
                                                    <li>Blueprint chance — collect to synthesize new Mingming</li>
                                                </>
                                            ) : (
                                                <>
                                                    <li>Card draft — {DRAFT_ROUND_COUNT} sequential picks</li>
                                                    <li>Relic choice</li>
                                                    <li>Sector unlocked on Warden defeat</li>
                                                </>
                                            )}
                                        </ul>
                                    </div>
                                </div>

                                {save.gauntlet && (
                                    <div style={{ color: '#ef4444', marginBottom: '15px', fontWeight: 'bold', fontSize: '0.9rem', textAlign: 'center' }}>
                                        ⚠️ WARNING: BREACH IN PROGRESS. RETURN TO HOME BASE TO RESUME.
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
                                    {save.gauntlet ? 'BREACH IN PROGRESS' : !canDeploy ? 'DEPLOYMENT BLOCKED' : save.unlockedSectors.includes(selectedSector) ? '▶ DEPLOY TO SECTOR' : '⚡ BREACH THE FIREWALL'}
                                </button>
                            </motion.div>
                        ) : (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', opacity: 0.3 }}>
                                <div style={{ fontSize: '4rem', marginBottom: '20px' }}>📡</div>
                                <p>SELECT A SECTOR TO REVIEW INTEL</p>
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};

export default SectorTerminal;
