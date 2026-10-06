import { useState, useEffect, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store/store';
import { swapOS } from '../store/gameSlice';
import { getOSBehavior } from '../../engine/data/firmwareRegistry';
import { GetMingmingData } from '../../engine/data/mingmingRegistry';
import { instinctName, plain } from '../labels/labels';
import { InstinctGlyph } from './InstinctGlyph';
import './FirmwareTerminal.css';

interface FirmwareTerminalProps {
    onClose: () => void;
}

// Ticket 15, re-priced by ticket 20, trimmed by ticket 11: a reflash costs ONE species blueprint
// (SPENT) and grants NOTHING. The first swap to an OS used to hand over a pick of two cards from
// that OS's starting kit; cards are run-scoped now (`IRunState.deck`) and ticket 08's `startKit`
// tags supply the start deck at run start, so a ranch that dealt cards was dealing a resource the
// player cannot bring home. The kit picker went with `baseDecksGranted`.

export default function FirmwareTerminal({ onClose }: FirmwareTerminalProps) {
    const dispatch = useDispatch();
    const { roster, blueprints } = useSelector((s: RootState) => s.game);
    const [selectedMmId, setSelectedMmId] = useState<string | null>(null);
    const [isFlashing, setIsFlashing] = useState(false);
    const [flashProgress, setFlashProgress] = useState(0);
    const [targetOS, setTargetOS] = useState<string | null>(null);
    const selectedMm = useMemo(() =>
        roster.find(m => m.id === selectedMmId),
        [roster, selectedMmId]);

    // Ticket 20: blueprints are COUNTS, and a reflash costs exactly one of them and no scrap.
    // The ranch has no scrap economy at all now — scrap is run-scoped, so charging it here would be
    // charging a currency the player cannot bring home.
    const blueprintsHeld = selectedMm ? (blueprints[selectedMm.definitionId] ?? 0) : 0;
    const hasBlueprint = blueprintsHeld > 0;

    const handleFlash = () => {
        if (!selectedMm || !targetOS || !hasBlueprint) return;

        setIsFlashing(true);
        setFlashProgress(0);
    };

    useEffect(() => {
        if (isFlashing) {
            const interval = setInterval(() => {
                setFlashProgress(prev => {
                    if (prev >= 100) {
                        clearInterval(interval);
                        return 100;
                    }
                    return prev + 5;
                });
            }, 50);
            return () => clearInterval(interval);
        }
    }, [isFlashing]);

    useEffect(() => {
        if (flashProgress === 100 && isFlashing) {
            const timeout = setTimeout(() => {
                // swapOS validates and spends the blueprint itself (silent no-op on failure,
                // matching the slice's no-op-on-invalid convention).
                if (selectedMmId && targetOS && selectedMm && hasBlueprint) {
                    dispatch(swapOS({ id: selectedMmId, targetOS }));
                }
                setIsFlashing(false);
                setFlashProgress(0);
                setTargetOS(null);
            }, 500);
            return () => clearTimeout(timeout);
        }
    }, [flashProgress, isFlashing, selectedMmId, selectedMm, targetOS, hasBlueprint, dispatch]);

    const availableOSVersions = useMemo(() => {
        if (!selectedMm) return [];
        // Ticket 15: read the registry instead of hardcoding _v1/_v2.
        return GetMingmingData(selectedMm.definitionId).availableOS.map((id, i) => ({
            id,
            version: `v${i + 1}.0`
        }));
    }, [selectedMm]);

    const choose = (id: string, isCurrent: boolean) => {
        if (!isFlashing && !isCurrent) setTargetOS(id);
    };

    // The slice's own words for "cannot": no trace of this species held.
    const canRetrain = targetOS !== null && hasBlueprint && !isFlashing;

    return (
        <div className="it-overlay" role="dialog" aria-label="Retrain an instinct">
            <div className="it-window k-plate">
                <header className="it-head">
                    <h2 className="it-title k-display">Retrain</h2>
                    <span className="it-sub">Pick a Mingming, then the instinct it should have. A retrain spends one of its traces.</span>
                    <button type="button" className="it-close k-button is-quiet" onClick={onClose}>Close</button>
                </header>

                <div className="it-body">
                    <div className="it-units" role="list">
                        <h3 className="it-label k-display">Mingming</h3>
                        {roster.length === 0 && <div className="it-empty">No mingmings yet.</div>}
                        {roster.map((mm) => (
                            <button
                                key={mm.id}
                                type="button"
                                role="listitem"
                                className={`it-unit k-plate ${selectedMmId === mm.id ? 'is-on' : ''}`}
                                onClick={() => !isFlashing && setSelectedMmId(mm.id)}
                            >
                                <span className="it-unit-name k-display">{mm.nickname ?? GetMingmingData(mm.definitionId).name}</span>
                                <span className="it-unit-os"><InstinctGlyph instinct={mm.activeOS} size={14} className="instinct-glyph-lead" />{instinctName(getOSBehavior(mm.activeOS)?.name ?? mm.activeOS)}</span>
                            </button>
                        ))}
                    </div>

                    <div className="it-main">
                        {!selectedMm ? (
                            <div className="it-empty">Pick a Mingming on the left to see its instincts.</div>
                        ) : (
                            <>
                                <h3 className="it-label k-display">
                                    {selectedMm.nickname ?? GetMingmingData(selectedMm.definitionId).name} — now{' '}
                                    <InstinctGlyph instinct={selectedMm.activeOS} size={20} className="instinct-glyph-lead" />{instinctName(getOSBehavior(selectedMm.activeOS)?.name ?? 'Generic Core')}
                                </h3>
                                <div className="it-options">
                                    {availableOSVersions.map((opt) => {
                                        const behavior = getOSBehavior(opt.id);
                                        const isSelected = targetOS === opt.id;
                                        const isCurrent = selectedMm.activeOS === opt.id;
                                        return (
                                            <button
                                                key={opt.id}
                                                type="button"
                                                className={`it-option k-plate ${isSelected ? 'is-on' : ''} ${isCurrent ? 'is-current' : ''}`}
                                                disabled={isCurrent}
                                                aria-pressed={isSelected}
                                                onClick={() => choose(opt.id, isCurrent)}
                                            >
                                                <span className="it-option-head">
                                                    <span className="it-option-name k-display">{behavior && <InstinctGlyph instinct={opt.id} size={20} className="instinct-glyph-lead" />}{behavior ? instinctName(behavior.name) : ''}</span>
                                                    {isCurrent && <span className="it-tag k-display">Current</span>}
                                                </span>
                                                <span className="it-option-desc">{plain(behavior?.description)}</span>
                                            </button>
                                        );
                                    })}
                                </div>

                                <footer className="it-foot">
                                    <span className={`it-cost ${hasBlueprint ? '' : 'is-short'}`}>
                                        Costs 1 {GetMingmingData(selectedMm.definitionId).name} trace · you hold {blueprintsHeld}
                                    </span>
                                    <button type="button" className="k-button" disabled={!canRetrain} onClick={handleFlash}>
                                        {isFlashing ? 'Retraining…' : 'Retrain'}
                                    </button>
                                </footer>
                            </>
                        )}
                    </div>
                </div>

                {isFlashing && (
                    <div className="it-progress" role="status">
                        <span className="it-progress-word k-display">Retraining…</span>
                        <div className="it-bar"><div className="it-bar-fill" style={{ width: `${flashProgress}%` }} /></div>
                    </div>
                )}
            </div>
        </div>
    );
}
