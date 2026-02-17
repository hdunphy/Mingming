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

const XpBar: React.FC<{ member: IMingmingState, xpGained: number }> = ({ member, xpGained }) => {
    const [displayXp, setDisplayXp] = useState(member.experience);
    const [displayLevel, setDisplayLevel] = useState(member.level);
    const targetXp = member.experience + xpGained;

    useEffect(() => {
        let currentXp = member.experience;
        let currentLevel = member.level;
        const step = Math.max(1, Math.floor(xpGained / 60));

        const interval = setInterval(() => {
            if (currentXp < targetXp) {
                currentXp += step;
                if (currentXp > targetXp) currentXp = targetXp;

                while (currentXp >= getExpForLevel(currentLevel + 1)) {
                    currentLevel++;
                    // Trigger level up sound/fx here
                }

                setDisplayXp(currentXp);
                setDisplayLevel(currentLevel);
            } else {
                clearInterval(interval);
            }
        }, 16);
        return () => clearInterval(interval);
    }, [member, xpGained, targetXp]);

    const currentLevelExp = getExpForLevel(displayLevel);
    const nextLevelExp = getExpForLevel(displayLevel + 1);
    const progress = ((displayXp - currentLevelExp) / (nextLevelExp - currentLevelExp)) * 100;

    return (
        <div className="xp-row" style={{ marginBottom: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                <span style={{ fontWeight: 'bold', color: '#00ccff' }}>{member.nickname || member.definitionId}</span>
                <span style={{ color: '#aaa' }}>LVL {displayLevel}</span>
            </div>
            <div style={{ position: 'relative', height: '12px', background: '#222', borderRadius: '6px', overflow: 'hidden', border: '1px solid #444' }}>
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    style={{ height: '100%', background: 'linear-gradient(90deg, #0088ff, #00ffcc)' }}
                />
            </div>
            <div style={{ fontSize: '0.8rem', textAlign: 'right', marginTop: '2px', color: '#888' }}>
                {displayXp} / {nextLevelExp} XP
            </div>
        </div>
    );
};

const BattleReport: React.FC<BattleReportProps> = ({ bundle, winners, onContinue }) => {
    const xpPerMember = winners.length > 0 ? Math.floor(bundle.xp / winners.length) : 0;

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
                    maxWidth: '600px',
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

                <div className="report-sections" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                    <div className="left-report">
                        <h3 style={{ borderBottom: '1px solid #333', paddingBottom: '10px', color: '#ffcc00' }}>LOOT</h3>
                        <div style={{ marginTop: '15px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                <span>Scraps</span>
                                <span style={{ color: '#00ffaa', fontWeight: 'bold' }}>+{bundle.scraps}</span>
                            </div>

                            {bundle.cards.length > 0 && (
                                <div style={{ marginTop: '20px' }}>
                                    <p style={{ fontSize: '0.9rem', color: '#888', marginBottom: '8px' }}>PROGRAMS ACQUIRED:</p>
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
                                    <p style={{ fontSize: '0.9rem', color: '#888', marginBottom: '8px' }}>BLUEPRINTS FOUND:</p>
                                    {bundle.blueprints.map((b, i) => (
                                        <div key={i} style={{ color: '#ff00ff', fontWeight: 'bold', fontSize: '0.9rem' }}>
                                            {b.name}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="right-report">
                        <h3 style={{ borderBottom: '1px solid #333', paddingBottom: '10px', color: '#ffcc00' }}>PROGRESSION</h3>
                        <div style={{ marginTop: '15px' }}>
                            {winners.map(m => (
                                <XpBar key={m.id} member={m} xpGained={xpPerMember} />
                            ))}
                        </div>
                    </div>
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
