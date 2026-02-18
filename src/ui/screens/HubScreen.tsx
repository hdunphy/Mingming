import React from 'react';
import { motion } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '../store/store';
import { startBattle } from '../store/battleSlice';
import { resetSave } from '../store/gameSlice';
import { deleteSave } from '../../engine/SaveSystem';
import { MIN_DECK_SIZE } from '../../engine/gameTypes';

const HubScreen: React.FC = () => {
    const dispatch = useDispatch();
    const save = useSelector((state: RootState) => state.game);
    const activeMingming = save.roster.find(m => m.id === save.activeParty[0]);
    const deckCount = save.activeDeck?.cards.length || 0;
    const isDeckValid = deckCount >= MIN_DECK_SIZE;

    const handleStartEncounter = () => {
        const deckCount = save.activeDeck?.cards.length || 0;
        if (!activeMingming || deckCount < MIN_DECK_SIZE) return;

        // Advantage logic: Fire -> Nature -> Water -> Fire
        // We spawn the one WEAK against the player
        let enemyId = 'fenrir';
        const playerElement = activeMingming.definitionId === 'ratatoskr' ? 'Nature' :
            activeMingming.definitionId === 'kraken' ? 'Water' : 'Fire';

        if (playerElement === 'Nature') enemyId = 'kraken'; // Water weak to Nature
        else if (playerElement === 'Water') enemyId = 'fenrir'; // Fire weak to Water
        else enemyId = 'ratatoskr'; // Nature weak to Fire

        dispatch(startBattle({ save, enemyIds: [enemyId] }));
    };

    const handleRestart = () => {
        if (window.confirm("ARE YOU SURE? THIS WILL PERMANENTLY WIPE ALL DATA.")) {
            deleteSave();
            dispatch(resetSave());
            window.location.reload();
        }
    };

    return (
        <div className="hub-screen" style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px',
            background: 'radial-gradient(circle at center, #1a1a2e 0%, #050508 100%)'
        }}>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ textAlign: 'center', marginBottom: '40px' }}
            >
                <h1 style={{ fontSize: '3rem', letterSpacing: '4px', margin: 0 }}>HOME BASE</h1>
                <p style={{ color: '#555' }}>SECTOR 7 | TERMINAL GAUNTLET</p>
            </motion.div>

            <div style={{ display: 'flex', gap: '40px', alignItems: 'center' }}>
                {/* Main Action */}
                <motion.button
                    whileHover={{ scale: isDeckValid ? 1.05 : 1 }}
                    whileTap={{ scale: isDeckValid ? 0.95 : 1 }}
                    onClick={handleStartEncounter}
                    className={`action-button ${!isDeckValid ? 'disabled' : ''}`}
                    disabled={!isDeckValid}
                    style={{
                        padding: '40px 60px',
                        fontSize: '1.5rem',
                        background: isDeckValid
                            ? 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)'
                            : '#333',
                        boxShadow: isDeckValid
                            ? '0 0 30px rgba(124, 58, 237, 0.4)'
                            : 'none',
                        cursor: isDeckValid ? 'pointer' : 'not-allowed',
                        opacity: isDeckValid ? 1 : 0.5
                    }}
                >
                    {isDeckValid ? 'START ENCOUNTER' : `DECK TOO SMALL (${save.activeDeck?.cards.length || 0}/${MIN_DECK_SIZE})`}
                </motion.button>

                {/* Info Panel */}
                <div style={{
                    background: 'rgba(255,255,255,0.05)',
                    padding: '30px',
                    borderRadius: '15px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    minWidth: '300px'
                }}>
                    <h2 style={{ margin: '0 0 20px', fontSize: '1.2rem', color: '#7c3aed' }}>CURRENT ROSTER</h2>
                    {activeMingming ? (
                        <div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{activeMingming.nickname || activeMingming.definitionId.toUpperCase()}</div>
                            <div style={{ color: '#aaa' }}>LEVEL {activeMingming.level}</div>
                            <div style={{ marginTop: '10px', fontSize: '0.9rem', opacity: 0.6 }}>
                                DECK SIZE: {save.activeDeck?.cards.length || 0} CARDS
                            </div>
                        </div>
                    ) : (
                        <div style={{ color: '#ff4444' }}>NO ACTIVE MINGMING</div>
                    )}
                </div>
            </div>

            <button
                onClick={handleRestart}
                style={{
                    marginTop: '60px',
                    background: 'none',
                    border: 'none',
                    color: '#444',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    textDecoration: 'underline'
                }}
            >
                RESTART GAUNTLET (WIPE DATA)
            </button>
        </div>
    );
};

export default HubScreen;
