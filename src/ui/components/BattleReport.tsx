import React, { useState } from 'react';
import { motion } from 'framer-motion';
import type { IRewardBundle, IOwnedProgram } from '../../engine/gameTypes';
import type { IBattleEntity } from '../../engine/types';
import { GetProgramData } from '../../engine/data/programRegistry';
import { GetRelic } from '../../engine/data/relicRegistry';
import ProgramCard from './ProgramCard';

interface BattleReportProps {
    bundle: IRewardBundle;
    winners: ReadonlyArray<IBattleEntity>;
    onContinue: (chosenCards: IOwnedProgram[], chosenRelic?: string) => void;
}

const BattleReport: React.FC<BattleReportProps> = ({ bundle, winners, onContinue }) => {
    const [selections, setSelections] = useState<Record<number, IOwnedProgram | null>>({});
    const [selectedRelic, setSelectedRelic] = useState<string | null>(null);

    const totalChoices = bundle.cardChoices.length;
    const selectedCount = Object.values(selections).filter(s => !!s).length;
    const allCardsSelected = selectedCount === totalChoices;

    const needsRelic = !!bundle.relicChoices && bundle.relicChoices.length > 0;
    const relicSelected = !needsRelic || selectedRelic !== null;
    const canContinue = allCardsSelected && relicSelected;

    const xpPerMember = winners.length > 0 ? Math.floor(bundle.totalXP / winners.length) : 0;

    const handleSelect = (choiceIndex: number, card: IOwnedProgram) => {
        setSelections(prev => ({ ...prev, [choiceIndex]: card }));
    };

    const handleFinalize = () => {
        if (!canContinue) return;
        const chosen = Object.values(selections).filter((s): s is IOwnedProgram => !!s);
        onContinue(chosen, selectedRelic || undefined);
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="battle-report-overlay"
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(5, 5, 10, 0.95)',
                backdropFilter: 'blur(15px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 3000,
                padding: '20px',
                overflowY: 'auto'
            }}
        >
            <motion.div
                initial={{ y: 50, scale: 0.9, opacity: 0 }}
                animate={{ y: 0, scale: 1, opacity: 1 }}
                style={{
                    width: '100%',
                    maxWidth: '800px',
                    background: 'linear-gradient(135deg, #151520 0%, #0a0a10 100%)',
                    borderRadius: '12px',
                    padding: '30px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.8), inset 0 0 20px rgba(0, 210, 255, 0.05)'
                }}
            >
                <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                    <h1 style={{ margin: 0, fontSize: '2.4rem', fontWeight: 900, color: '#fff', letterSpacing: '2px' }}>
                        BATTLE ANALYSIS COMPLETE
                    </h1>
                    <div style={{ height: '2px', background: 'linear-gradient(90deg, transparent, #00d2ff, transparent)', width: '80%', margin: '15px auto 0' }} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '30px' }}>
                    {/* Left: Summary & XP */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div className="report-summary-box" style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '20px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                            <h3 style={{ margin: '0 0 15px', fontSize: '0.9rem', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>Resource Yield</h3>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <span style={{ color: '#ccc' }}>Scraps Recovered</span>
                                <span style={{ color: '#00ffaa', fontWeight: 'bold', fontSize: '1.2rem' }}>+{bundle.scraps}</span>
                            </div>
                            {bundle.blueprints.length > 0 && (
                                <div style={{
                                    marginTop: '15px',
                                    padding: '12px',
                                    background: 'rgba(255, 0, 255, 0.1)',
                                    border: '1px solid #ff00ff',
                                    borderRadius: '6px',
                                    animation: 'pulse-glow 2s infinite'
                                }}>
                                    <div style={{ fontSize: '0.7rem', color: '#ff00ff', fontWeight: '900', textTransform: 'uppercase', marginBottom: '5px' }}>
                                        New Blueprint Detected
                                    </div>
                                    {bundle.blueprints.map((bp, i) => (
                                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 'bold' }}>{bp.name}</span>
                                            <span style={{ color: '#ff00ff', fontWeight: '900', fontSize: '0.7rem' }}>ACQUIRED</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                        </div>

                        <div className="xp-distribution-box" style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '20px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                            <h3 style={{ margin: '0 0 15px', fontSize: '0.9rem', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>Efficiency Logs</h3>
                            {winners.map(mm => (
                                <div key={mm.id} style={{ marginBottom: '12px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                        <span style={{ color: '#fff', fontSize: '0.9rem', fontWeight: '800' }}>{mm.name.toUpperCase()}</span>
                                        <span style={{ color: '#00d2ff', fontSize: '0.8rem', fontWeight: 'bold' }}>+{xpPerMember} XP</span>
                                    </div>
                                    <div style={{ height: '4px', background: '#333', borderRadius: '2px', overflow: 'hidden' }}>
                                        <div style={{ height: '100%', background: '#00d2ff', width: '60%' }} /> {/* Visual filler for now */}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right: Card Selections */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <h3 style={{ margin: 0, fontSize: '1rem', color: '#ffcc00', letterSpacing: '1px' }}>DECONSTRUCTED PROGRAMS</h3>
                        <p style={{ margin: '-10px 0 10px', fontSize: '0.8rem', color: '#666' }}>PICK ONE PER DEFEATED UNIT</p>

                        <div style={{ flex: 1, overflowY: 'auto', maxHeight: '400px', paddingRight: '10px' }}>
                            {/* Relic Choices */}
                            {needsRelic && (
                                <div style={{ marginBottom: '25px', padding: '15px', background: 'rgba(255,165,0,0.1)', borderRadius: '8px', border: '1px solid rgba(255,165,0,0.5)' }}>
                                    <div style={{ fontSize: '0.8rem', color: '#ffa500', fontWeight: 'bold', marginBottom: '10px', textTransform: 'uppercase' }}>CHOOSE ONE SECTOR RELIC</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                                        {bundle.relicChoices!.map((relicId) => {
                                            const relic = GetRelic(relicId);
                                            const isSelected = selectedRelic === relicId;
                                            return (
                                                <div
                                                    key={relicId}
                                                    onClick={() => setSelectedRelic(relicId)}
                                                    style={{
                                                        padding: '15px',
                                                        background: isSelected ? 'rgba(255,165,0,0.3)' : 'rgba(0,0,0,0.4)',
                                                        border: `2px solid ${isSelected ? '#ffa500' : 'rgba(255,255,255,0.1)'}`,
                                                        borderRadius: '8px',
                                                        cursor: 'pointer',
                                                        textAlign: 'center'
                                                    }}
                                                >
                                                    <div style={{ fontSize: '1.2rem', marginBottom: '10px' }}>🏆</div>
                                                    <div style={{ color: '#fff', fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '5px' }}>{relic.name}</div>
                                                    <div style={{ color: '#aaa', fontSize: '0.75rem', lineHeight: '1.4' }}>{relic.description}</div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {bundle.cardChoices.map((choice, choiceIdx) => (
                                <div key={choiceIdx} style={{ marginBottom: '25px', padding: '15px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ fontSize: '0.7rem', color: '#888', fontWeight: 'bold', marginBottom: '10px', textTransform: 'uppercase' }}>Source: {choice.sourceEntityName}</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                                        {choice.options.map((opt) => {
                                            const data = GetProgramData(opt.dataId);
                                            const isSelected = selections[choiceIdx]?.instanceId === opt.instanceId;
                                            return (
                                                <ProgramCard
                                                    key={opt.instanceId}
                                                    data={data}
                                                    isSelected={isSelected}
                                                    onClick={() => handleSelect(choiceIdx, opt)}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '40px', gap: '10px' }}>
                    {!canContinue && totalChoices > 0 && (
                        <div style={{ color: '#ff4444', fontSize: '0.8rem', fontWeight: 'bold' }}>
                            UNRESOLVED CHOICES REMAINING
                        </div>
                    )}
                    <button
                        onClick={handleFinalize}
                        disabled={!canContinue}
                        className="action-button"
                        style={{
                            padding: '15px 80px',
                            fontSize: '1.4rem',
                            fontWeight: '900',
                            background: canContinue ? '#00d2ff' : '#333',
                            color: canContinue ? '#000' : '#666',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: canContinue ? 'pointer' : 'not-allowed',
                            boxShadow: canContinue ? '0 0 20px rgba(0, 210, 255, 0.4)' : 'none'
                        }}
                    >
                        CONTINUE SYNCHRONIZATION
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
};

export default BattleReport;
