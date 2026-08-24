import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { IRewardBundle, IOwnedProgram } from '../../engine/gameTypes';
import type { IBattleEntity } from '../../engine/types';
import { GetProgramData } from '../../engine/data/programRegistry';
import { GetMingmingData } from '../../engine/data/mingmingRegistry';
import { GetRelic } from '../../engine/data/relicRegistry';
import RevealCard, { REVEAL_STAGGER_MS } from './RevealCard';
import { prefersReducedMotion } from '../utils/motionPrefs';
import { playSfx } from '../audio/AudioEngine';

/**
 * The post-fight reward screen — refitted by ticket 12.
 *
 * What it shows is now exactly what a fight pays: **scrap**, **any blueprint**, and **one
 * pick-1-of-3 per defeated enemy**. There is no XP panel (ticket 21 deleted levelling; ticket 12
 * removed the last field), and the gym-clear draft is parked for ticket 18 — see `draftRounds`
 * below.
 *
 * The component decides nothing about the rewards themselves. `RewardSystem` rolls the bundle and
 * `BattleArena` routes each half to its slice — blueprints to the ranch the moment they drop, scrap
 * and the picked cards to the run when `onContinue` fires. So the only state here is *which option
 * the player clicked*.
 */
interface BattleReportProps {
    bundle: IRewardBundle;
    winners: ReadonlyArray<IBattleEntity>;
    /** Picked cards, in choice order. `BattleArena` mints them into `IRunState.deck`. */
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

// `winners` is still part of the props contract but nothing reads it, and **ticket 12 looked and
// still does not need it**: the refit's inputs are the node kind and the *party* (for the pick
// pool), both of which `BattleArena` resolves before it rolls, so the report is handed a finished
// bundle and never has to ask who survived. Left in the interface for ticket 19's run-end screen,
// which is the next thing likely to want the surviving party. Destructured out and voided.
const BattleReport: React.FC<BattleReportProps> = ({ bundle, winners, onContinue }) => {
    void winners;
    const [selections, setSelections] = useState<Record<number, IOwnedProgram | null>>({});
    /**
     * Which picks the player has DECLINED — ruling 4 (Henry, playtest 2026-08-24): *"you should be
     * able to skip rewards"*, and, asked per-card or per-screen, *"skip per card"*.
     *
     * A separate map rather than a third value in `selections` because the three states are not
     * one axis: a pick is unresolved, taken, or declined, and only the first blocks CONTINUE. The
     * old screen had no third state at all, so a 3v3 win forced three cards into the deck — with
     * one mandatory pick per defeated body and roughly eleven fights in a run, that is ~16 forced
     * cards against `economy-session.md`'s 20-25 gate, on top of the 18 the party already brings.
     * Card removal costs 20 and a run sees three markets. The deck was being diluted faster than
     * anyone could clean it, which is most of *"it was too hard to build a good deck."*
     */
    const [skipped, setSkipped] = useState<Record<number, boolean>>({});
    const [selectedRelic, setSelectedRelic] = useState<string | null>(null);

    // --- Gym-clear mini-draft (3 sequential pick-1-of-3 rounds) ---
    //
    // **Unreachable since ticket 12, on purpose.** Nothing sets `bundle.draftRounds` any more: the
    // gauntlet and its draft belong to ticket 18, which is where the `rollDraftRounds` invocation
    // went. The panel below, `RewardSystem.rollDraftRounds` and `IRewardBundle.draftRounds` are the
    // three halves of one parked feature, kept together so 18 re-wires rather than rewrites. The
    // `?? []` is what makes it dormant instead of broken.
    const draftRounds = bundle.draftRounds ?? [];
    const [draftIndex, setDraftIndex] = useState(0);
    const [draftPicks, setDraftPicks] = useState<IOwnedProgram[]>([]);
    /** instanceId of the card currently playing its selection pulse. */
    const [pendingPickId, setPendingPickId] = useState<string | null>(null);
    const draftActive = draftIndex < draftRounds.length;

    // Audio: dramatic unlock swell the first time the FIREWALL BREACHED draft
    // panel appears (gym-clear spoils).
    const breachPlayedRef = React.useRef(false);
    useEffect(() => {
        if (draftActive && !breachPlayedRef.current) {
            breachPlayedRef.current = true;
            playSfx('breach');
        }
    }, [draftActive]);

    const totalChoices = bundle.cardChoices.length;
    /** A pick is RESOLVED when it has been taken or declined. Only unresolved picks block. */
    const isResolved = (index: number): boolean => !!selections[index] || skipped[index] === true;
    const allCardsResolved = bundle.cardChoices.every((_, index) => isResolved(index));

    const needsRelic = !!bundle.relicChoices && bundle.relicChoices.length > 0;
    // The relic is still mandatory, and deliberately: there is at most one per run (the last
    // gauntlet fight), it is a party-wide passive rather than a card in the deck, and it cannot
    // dilute anything. Nothing in the playtest complained about it.
    const relicSelected = !needsRelic || selectedRelic !== null;
    const canContinue = allCardsResolved && relicSelected;

    const handleSelect = (choiceIndex: number, card: IOwnedProgram) => {
        // Taking a card un-declines the pick, so a mis-click on SKIP is one click to undo.
        setSelections(prev => ({ ...prev, [choiceIndex]: card }));
        setSkipped(prev => (prev[choiceIndex] ? { ...prev, [choiceIndex]: false } : prev));
    };

    /** Decline one pick. Toggles, so SKIP twice returns it to unresolved rather than trapping it. */
    const handleSkip = (choiceIndex: number) => {
        playSfx('uiClick');
        setSkipped(prev => ({ ...prev, [choiceIndex]: !prev[choiceIndex] }));
        setSelections(prev => (prev[choiceIndex] ? { ...prev, [choiceIndex]: null } : prev));
    };

    const handleFinalize = () => {
        if (!canContinue) return;
        playSfx('uiClick');
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
                    className="report-body"
                    initial={{ y: 30, scale: 0.95, opacity: 0 }}
                    animate={{ y: 0, scale: 1, opacity: 1 }}
                    style={{
                        width: '100%',
                        maxWidth: 'min(720px, 90vw)',
                        maxHeight: '92vh',
                        background: 'linear-gradient(135deg, #151520 0%, #0a0a10 100%)',
                        borderRadius: '12px',
                        padding: '24px 32px 20px',
                        border: '1px solid rgba(0, 210, 255, 0.25)',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.8), inset 0 0 30px rgba(0, 210, 255, 0.06)',
                        textAlign: 'center'
                    }}
                >
                    <div style={{ fontSize: '0.75rem', color: '#ffcc00', fontWeight: 900, letterSpacing: '4px', marginBottom: '6px' }}>
                        FIREWALL BREACHED
                    </div>
                    <h1 style={{ margin: 0, fontSize: '1.9rem', fontWeight: 900, color: '#fff', letterSpacing: '2px' }}>
                        BREACH SPOILS
                    </h1>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', margin: '10px 0 20px' }}>
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

                    <div className="reward-card-row" style={{ marginBottom: '20px' }}>
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
                        onClick={() => { playSfx('uiClick'); commitDraftPick(null); }}
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
                padding: '16px'
            }}
        >
            {/* Panel: header/footer fixed, body scrolls if the content ever outgrows 92vh */}
            <motion.div
                initial={{ y: 50, scale: 0.9, opacity: 0 }}
                animate={{ y: 0, scale: 1, opacity: 1 }}
                style={{
                    width: '100%',
                    maxWidth: 'min(960px, 90vw)',
                    maxHeight: '92vh',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    background: 'linear-gradient(135deg, #151520 0%, #0a0a10 100%)',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.8), inset 0 0 20px rgba(0, 210, 255, 0.05)'
                }}
            >
                <div style={{ textAlign: 'center', padding: '20px 28px 14px', flexShrink: 0 }}>
                    <h1 style={{ margin: 0, fontSize: '1.7rem', fontWeight: 900, color: '#fff', letterSpacing: '2px' }}>
                        BATTLE ANALYSIS COMPLETE
                    </h1>
                    <div style={{ height: '2px', background: 'linear-gradient(90deg, transparent, #00d2ff, transparent)', width: '70%', margin: '10px auto 0' }} />
                </div>

                <div className="report-body report-columns" style={{ flex: '1 1 auto', padding: '6px 28px 12px' }}>
                    {/* Left: what the fight paid — scrap, and any blueprint. No XP: ticket 21
                        deleted levelling and ticket 12 removed the field from the bundle. */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <div className="report-summary-box" style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                            <h3 style={{ margin: '0 0 12px', fontSize: '0.8rem', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>Resource Yield</h3>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                                    className="blueprint-flash"
                                    style={{
                                        marginTop: '12px',
                                        padding: '12px',
                                        background: 'rgba(255, 0, 255, 0.1)',
                                        border: '1px solid #ff00ff',
                                        borderRadius: '6px'
                                    }}
                                >
                                    {/* Ticket 12: "NEW BLUEPRINT DETECTED" was a lie the moment
                                        blueprints became consumable counts (ticket 20) — a species
                                        you already own drops again, and that repeat drop IS the
                                        re-roll grind rather than a mistake. The line reads as a
                                        quantity for the same reason the ranch stores one, and the
                                        "+1" says it stacked onto whatever was there. */}
                                    <div style={{ fontSize: '0.7rem', color: '#ff00ff', fontWeight: '900', textTransform: 'uppercase', marginBottom: '5px' }}>
                                        Blueprint Recovered
                                    </div>
                                    {bundle.blueprints.map((speciesId, i) => (
                                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 'bold' }}>{GetMingmingData(speciesId).name} Blueprint</span>
                                            <span style={{ color: '#ff00ff', fontWeight: '900', fontSize: '0.7rem' }}>+1</span>
                                        </div>
                                    ))}
                                </motion.div>
                            )}

                        </div>

                    </div>

                    {/* Right: Card Selections (the centerpiece — no nested scroller, the panel body scrolls) */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', minWidth: 0 }}>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1rem', color: '#ffcc00', letterSpacing: '1px' }}>DECONSTRUCTED PROGRAMS</h3>
                            {totalChoices > 0 && (
                                <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#666', letterSpacing: '1px' }}>PICK ONE PER DEFEATED UNIT</p>
                            )}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            {/* Relic Choices */}
                            {needsRelic && (
                                <div
                                    className={selectedRelic === null ? 'choice-group-pending' : undefined}
                                    style={{ padding: '12px 14px', background: 'rgba(255,165,0,0.1)', borderRadius: '8px', border: '1px solid rgba(255,165,0,0.5)' }}
                                >
                                    <div style={{ fontSize: '0.75rem', color: '#ffa500', fontWeight: 'bold', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>CHOOSE ONE SECTOR RELIC</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px' }}>
                                        {bundle.relicChoices!.map((relicId) => {
                                            const relic = GetRelic(relicId);
                                            const isSelected = selectedRelic === relicId;
                                            return (
                                                <div
                                                    key={relicId}
                                                    onClick={() => { playSfx('rewardClaim'); setSelectedRelic(relicId); }}
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
                                <div style={{ padding: '12px 14px', background: 'rgba(0, 255, 170, 0.05)', borderRadius: '8px', border: '1px solid rgba(0, 255, 170, 0.3)' }}>
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
                                <div
                                    key={choiceIdx}
                                    className={isResolved(choiceIdx) ? undefined : 'choice-group-pending'}
                                    style={{ padding: '12px 14px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid rgba(0, 210, 255, 0.15)', opacity: skipped[choiceIdx] ? 0.55 : 1 }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '10px' }}>
                                        <div style={{ fontSize: '0.7rem', color: '#888', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>Source: {choice.sourceEntityName}</div>
                                        {/*
                                          * Ruling 4. Visually quiet — a skip is a legitimate play
                                          * (a lean deck is the whole point of a removal costing 20)
                                          * but it is not the default, so it does not compete with
                                          * the cards for attention.
                                          */}
                                        <button
                                            type="button"
                                            className={`reward-skip-btn${skipped[choiceIdx] ? ' skipped' : ''}`}
                                            onClick={() => handleSkip(choiceIdx)}
                                            aria-pressed={skipped[choiceIdx] === true}
                                        >
                                            {skipped[choiceIdx] ? 'SKIPPED — TAKE ONE?' : 'SKIP'}
                                        </button>
                                    </div>
                                    <div className="reward-card-row">
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

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '12px 28px 18px', borderTop: '1px solid rgba(255, 255, 255, 0.06)', flexShrink: 0 }}>
                    {!canContinue && totalChoices > 0 && (
                        <div style={{ color: '#ff4444', fontSize: '0.75rem', fontWeight: 'bold', letterSpacing: '2px' }}>
                            UNRESOLVED CHOICES REMAINING
                        </div>
                    )}
                    <button
                        onClick={handleFinalize}
                        disabled={!canContinue}
                        className={`action-button report-continue-btn${canContinue ? ' armed' : ''}`}
                        style={{
                            padding: '12px 64px',
                            fontSize: '1.25rem',
                            fontWeight: '900',
                            letterSpacing: '1px',
                            background: canContinue ? '#00d2ff' : '#333',
                            color: canContinue ? '#000' : '#666',
                            border: 'none',
                            borderRadius: '6px',
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
