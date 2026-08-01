import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { IRewardBundle, IOwnedProgram } from '../../engine/gameTypes';
import type { IBattleEntity } from '../../engine/types';
import { getExpForLevel } from '../../engine/types';
import { GetProgramData } from '../../engine/data/programRegistry';
import { GetRelic } from '../../engine/data/relicRegistry';
import RevealCard, { REVEAL_STAGGER_MS } from './RevealCard';
import { prefersReducedMotion } from '../utils/motionPrefs';

interface BattleReportProps {
    bundle: IRewardBundle;
    winners: ReadonlyArray<IBattleEntity>;
    onContinue: (chosenCards: IOwnedProgram[], chosenRelic?: string) => void;
}

// --- Payoff timing (ms) ---
/** Cards start flipping shortly after the panel lands. */
const REVEAL_BASE_DELAY_MS = 300;
/** Scrap counter starts once the first cards are face-up. */
const SCRAP_COUNT_DELAY_MS = 800;
const SCRAP_COUNT_DURATION_MS = 600;
/** Blueprint line pops in after the scrap counter starts. */
const BLUEPRINT_POP_DELAY_S = 1.1;

/** Scrap total counts up from 0 (instant under prefers-reduced-motion). */
const CountUp: React.FC<{ value: number; delayMs?: number; durationMs?: number }> = ({
    value,
    delayMs = 0,
    durationMs = SCRAP_COUNT_DURATION_MS
}) => {
    const [display, setDisplay] = useState(0);
    const reduced = prefersReducedMotion();

    useEffect(() => {
        if (prefersReducedMotion()) return; // reduced motion renders `value` directly
        let raf = 0;
        let start: number | null = null;
        const timeout = setTimeout(() => {
            const tick = (now: number) => {
                if (start === null) start = now;
                const p = Math.min(1, (now - start) / durationMs);
                // ease-out cubic so the tail slows down as it lands
                setDisplay(Math.round(value * (1 - Math.pow(1 - p, 3))));
                if (p < 1) raf = requestAnimationFrame(tick);
            };
            raf = requestAnimationFrame(tick);
        }, delayMs);
        return () => {
            clearTimeout(timeout);
            cancelAnimationFrame(raf);
        };
    }, [value, delayMs, durationMs]);

    return <>{reduced ? value : display}</>;
};

const BattleReport: React.FC<BattleReportProps> = ({ bundle, winners, onContinue }) => {
    const [selections, setSelections] = useState<Record<number, IOwnedProgram | null>>({});
    const [selectedRelic, setSelectedRelic] = useState<string | null>(null);

    // --- Gym-clear mini-draft (3 sequential pick-1-of-3 rounds) ---
    const draftRounds = bundle.draftRounds ?? [];
    const [draftIndex, setDraftIndex] = useState(0);
    const [draftPicks, setDraftPicks] = useState<IOwnedProgram[]>([]);
    /** instanceId of the card currently playing its selection pulse. */
    const [pendingPickId, setPendingPickId] = useState<string | null>(null);
    const draftActive = draftIndex < draftRounds.length;

    const totalChoices = bundle.cardChoices.length;
    const selectedCount = Object.values(selections).filter(s => !!s).length;
    const allCardsSelected = selectedCount === totalChoices;

    const needsRelic = !!bundle.relicChoices && bundle.relicChoices.length > 0;
    const relicSelected = !needsRelic || selectedRelic !== null;
    const canContinue = allCardsSelected && relicSelected;

    const handleSelect = (choiceIndex: number, card: IOwnedProgram) => {
        setSelections(prev => ({ ...prev, [choiceIndex]: card }));
    };

    const handleFinalize = () => {
        if (!canContinue) return;
        const chosen = [
            ...Object.values(selections).filter((s): s is IOwnedProgram => !!s),
            ...draftPicks
        ];
        onContinue(chosen, selectedRelic || undefined);
    };

    /** Advance the draft; card=null means the round was skipped. */
    const commitDraftPick = (card: IOwnedProgram | null) => {
        if (card) setDraftPicks(prev => [...prev, card]);
        setPendingPickId(null);
        setDraftIndex(prev => prev + 1);
    };

    // --- Draft phase: shown INSTEAD of the report until all rounds resolve ---
    if (draftActive) {
        const round = draftRounds[draftIndex];
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
                    padding: '20px'
                }}
            >
                {/* key remounts the panel per round → fresh face-down flips */}
                <motion.div
                    key={draftIndex}
                    initial={{ y: 30, scale: 0.95, opacity: 0 }}
                    animate={{ y: 0, scale: 1, opacity: 1 }}
                    style={{
                        width: '100%',
                        maxWidth: '720px',
                        background: 'linear-gradient(135deg, #151520 0%, #0a0a10 100%)',
                        borderRadius: '12px',
                        padding: '30px 40px 25px',
                        border: '1px solid rgba(0, 210, 255, 0.25)',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.8), inset 0 0 30px rgba(0, 210, 255, 0.06)',
                        textAlign: 'center'
                    }}
                >
                    <div style={{ fontSize: '0.75rem', color: '#ffcc00', fontWeight: 900, letterSpacing: '4px', marginBottom: '6px' }}>
                        GYM FIREWALL BREACHED
                    </div>
                    <h1 style={{ margin: 0, fontSize: '1.9rem', fontWeight: 900, color: '#fff', letterSpacing: '2px' }}>
                        SPOILS PROTOCOL
                    </h1>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', margin: '12px 0 25px' }}>
                        <span style={{ color: '#00d2ff', fontSize: '0.85rem', fontWeight: 900, letterSpacing: '2px' }}>
                            DRAFT {draftIndex + 1}/{draftRounds.length}
                        </span>
                        <span style={{ display: 'flex', gap: '5px' }}>
                            {draftRounds.map((_, i) => (
                                <span
                                    key={i}
                                    style={{
                                        width: '18px',
                                        height: '4px',
                                        borderRadius: '2px',
                                        background: i < draftIndex ? '#00ffaa' : i === draftIndex ? '#00d2ff' : '#2a2a3a',
                                        boxShadow: i === draftIndex ? '0 0 6px #00d2ff' : 'none'
                                    }}
                                />
                            ))}
                        </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginBottom: '25px' }}>
                        {round.options.map((opt, i) => (
                            <RevealCard
                                key={`${draftIndex}-${opt.instanceId}`}
                                data={GetProgramData(opt.dataId)}
                                revealDelayMs={REVEAL_BASE_DELAY_MS + i * REVEAL_STAGGER_MS}
                                isSelected={pendingPickId === opt.instanceId}
                                disabled={pendingPickId !== null}
                                onSelect={() => setPendingPickId(opt.instanceId)}
                                onPulseComplete={() => commitDraftPick(opt)}
                            />
                        ))}
                    </div>

                    <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '15px', letterSpacing: '1px' }}>
                        SELECT ONE PROGRAM TO EXTRACT
                    </div>

                    {/* Skipping is allowed but visually discouraged */}
                    <button
                        onClick={() => commitDraftPick(null)}
                        disabled={pendingPickId !== null}
                        style={{
                            background: 'none',
                            border: '1px solid rgba(255,255,255,0.12)',
                            color: '#555',
                            padding: '6px 18px',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            letterSpacing: '2px',
                            cursor: pendingPickId !== null ? 'default' : 'pointer'
                        }}
                    >
                        SKIP
                    </button>
                </motion.div>
            </motion.div>
        );
    }

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
                                <span style={{ color: '#00ffaa', fontWeight: 'bold', fontSize: '1.2rem' }}>
                                    +<CountUp value={bundle.scraps} delayMs={SCRAP_COUNT_DELAY_MS} />
                                </span>
                            </div>
                            {bundle.blueprints.length > 0 && (
                                <motion.div
                                    initial={prefersReducedMotion() ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.96 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    transition={{ delay: BLUEPRINT_POP_DELAY_S, duration: 0.35, ease: 'easeOut' }}
                                    style={{
                                        marginTop: '15px',
                                        padding: '12px',
                                        background: 'rgba(255, 0, 255, 0.1)',
                                        border: '1px solid #ff00ff',
                                        borderRadius: '6px',
                                        animation: 'pulse-glow 2s infinite'
                                    }}
                                >
                                    <div style={{ fontSize: '0.7rem', color: '#ff00ff', fontWeight: '900', textTransform: 'uppercase', marginBottom: '5px' }}>
                                        New Blueprint Detected
                                    </div>
                                    {bundle.blueprints.map((bp, i) => (
                                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 'bold' }}>{bp.name}</span>
                                            <span style={{ color: '#ff00ff', fontWeight: '900', fontSize: '0.7rem' }}>ACQUIRED</span>
                                        </div>
                                    ))}
                                </motion.div>
                            )}

                        </div>

                        <div className="xp-distribution-box" style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '20px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                            <h3 style={{ margin: '0 0 15px', fontSize: '0.9rem', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>Efficiency Logs</h3>
                            {winners.map(mm => {
                                // XP is earned in-battle (death-XP system); show current progress toward next level.
                                const currentLevelExp = getExpForLevel(mm.level);
                                const nextLevelExp = getExpForLevel(mm.level + 1);
                                const span = nextLevelExp - currentLevelExp;
                                const xpProgress = span > 0
                                    ? Math.min(100, Math.max(0, ((mm.experience - currentLevelExp) / span) * 100))
                                    : 0;
                                return (
                                    <div key={mm.id} style={{ marginBottom: '12px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                            <span style={{ color: '#fff', fontSize: '0.9rem', fontWeight: '800' }}>{mm.name.toUpperCase()}</span>
                                            <span style={{ color: '#00d2ff', fontSize: '0.8rem', fontWeight: 'bold' }}>LV {mm.level}</span>
                                        </div>
                                        <div style={{ height: '4px', background: '#333', borderRadius: '2px', overflow: 'hidden' }}>
                                            <div style={{ height: '100%', background: '#00d2ff', width: `${xpProgress}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right: Card Selections */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <h3 style={{ margin: 0, fontSize: '1rem', color: '#ffcc00', letterSpacing: '1px' }}>DECONSTRUCTED PROGRAMS</h3>
                        {totalChoices > 0 && (
                            <p style={{ margin: '-10px 0 10px', fontSize: '0.8rem', color: '#666' }}>PICK ONE PER DEFEATED UNIT</p>
                        )}

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

                            {/* Gym-clear draft summary (draft already resolved above) */}
                            {draftRounds.length > 0 && (
                                <div style={{ marginBottom: '25px', padding: '15px', background: 'rgba(0, 255, 170, 0.05)', borderRadius: '8px', border: '1px solid rgba(0, 255, 170, 0.3)' }}>
                                    <div style={{ fontSize: '0.7rem', color: '#00ffaa', fontWeight: 'bold', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                        Draft Complete — {draftPicks.length}/{draftRounds.length} Programs Extracted
                                    </div>
                                    {draftPicks.length > 0 ? (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                            {draftPicks.map(pick => (
                                                <span
                                                    key={pick.instanceId}
                                                    style={{
                                                        padding: '3px 10px',
                                                        borderRadius: '4px',
                                                        background: 'rgba(0,0,0,0.4)',
                                                        border: '1px solid rgba(0, 255, 170, 0.4)',
                                                        color: '#d6ffef',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 700
                                                    }}
                                                >
                                                    {GetProgramData(pick.dataId).name}
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <div style={{ color: '#667', fontSize: '0.8rem' }}>All rounds skipped.</div>
                                    )}
                                </div>
                            )}

                            {bundle.cardChoices.map((choice, choiceIdx) => (
                                <div key={choiceIdx} style={{ marginBottom: '25px', padding: '15px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ fontSize: '0.7rem', color: '#888', fontWeight: 'bold', marginBottom: '10px', textTransform: 'uppercase' }}>Source: {choice.sourceEntityName}</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                                        {choice.options.map((opt, optIdx) => {
                                            const data = GetProgramData(opt.dataId);
                                            const isSelected = selections[choiceIdx]?.instanceId === opt.instanceId;
                                            return (
                                                <RevealCard
                                                    key={opt.instanceId}
                                                    data={data}
                                                    revealDelayMs={REVEAL_BASE_DELAY_MS + (choiceIdx * 3 + optIdx) * REVEAL_STAGGER_MS}
                                                    isSelected={isSelected}
                                                    onSelect={() => handleSelect(choiceIdx, opt)}
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
