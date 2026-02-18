import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import { applyRewardBundle } from '../store/gameSlice';
import { setBattleState } from '../store/battleSlice';
import type { IRewardBundle } from '../../engine/gameTypes';
import type { IMingmingState } from '../../engine/types';
import { getExpForLevel } from '../../engine/types';
import { GetProgramData } from '../../engine/data/programRegistry';

interface BattleReportProps {
    bundle: IRewardBundle;
    winners: IMingmingState[];
    onContinue: () => void;
}

const BattleReport: React.FC<BattleReportProps> = ({ bundle, onContinue }) => {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="battle-report-overlay"
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.9)',
                backdropFilter: 'blur(10px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 3000,
                padding: '20px'
            }}
        >
            <motion.div
                initial={{ y: 50, scale: 0.9 }}
                animate={{ y: 0, scale: 1 }}
                style={{
                    width: '100%',
                    maxWidth: '450px',
                    background: '#1a1a1a',
                    borderRadius: '20px',
                    padding: '40px',
                    border: '1px solid #333',
                    boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
                }}
            >
                <h1 style={{ textAlign: 'center', fontSize: '2.5rem', marginBottom: '30px', background: 'linear-gradient(to bottom, #fff, #888)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    BATTLE RECAP
                </h1>

                <div className="report-sections">
                    <div className="loot-report">
                        <h3 style={{ borderBottom: '1px solid #333', paddingBottom: '10px', color: '#ffcc00' }}>LOOT ACQUIRED</h3>
                        <div style={{ marginTop: '15px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                <span>Scraps</span>
                                <span style={{ color: '#00ffaa', fontWeight: 'bold' }}>+{bundle.scraps}</span>
                            </div>

                            {bundle.cards.length > 0 && (
                                <div style={{ marginTop: '20px' }}>
                                    <p style={{ fontSize: '0.9rem', color: '#888', marginBottom: '8px' }}>PROGRAMS:</p>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                        {bundle.cards.map((c, i) => (
                                            <div key={i} style={{ background: '#333', padding: '4px 10px', borderRadius: '4px', fontSize: '0.8rem' }}>
                                                {GetProgramData(c.dataId).name}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {bundle.blueprints.length > 0 && (
                                <div style={{ marginTop: '20px' }}>
                                    <p style={{ fontSize: '0.9rem', color: '#888', marginBottom: '8px' }}>BLUEPRINTS:</p>
                                    {bundle.blueprints.map((b, i) => (
                                        <div key={i} style={{ color: '#ff00ff', fontWeight: 'bold', fontSize: '0.9rem' }}>
                                            {b.name}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* TODO: Still good to show final XP bar */}
                    {/* <div className="right-report">
                        <h3 style={{ borderBottom: '1px solid #333', paddingBottom: '10px', color: '#ffcc00' }}>PROGRESSION</h3>
                        <div style={{ marginTop: '15px' }}>
                            {winners.map(m => (
                                <XpBar key={m.id} member={m} xpGained={xpPerMember} />
                            ))}
                        </div>
                    </div> */}
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '40px' }}>
                    <button
                        onClick={onContinue}
                        className="action-button"
                        style={{ padding: '15px 60px', fontSize: '1.2rem', background: '#0088ff' }}
                    >
                        CONTINUE
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
};

export default BattleReport;
