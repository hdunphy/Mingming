import React, { useState, useEffect, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import type { RootState } from '../store/store';
import { swapOS } from '../store/gameSlice';
import { getOSBehavior } from '../../engine/data/firmwareRegistry';
import { GetMingmingData, getDeckForOS } from '../../engine/data/mingmingRegistry';
import { GetProgramData } from '../../engine/data/programRegistry';
import { deckGrantKey, OS_SWAP_SCRAP_COST, OS_SWAP_PICK_COUNT } from '../../engine/gameTypes';
import type { IMingmingState } from '../../engine/types';

interface FirmwareTerminalProps {
    onClose: () => void;
}

// Ticket 15: swap = 1 species blueprint (SPENT) + scrap; first swap to an OS
// grants a pick of its starting kit (once ever), chosen in the picker below.
const OS_SWAP_COST = OS_SWAP_SCRAP_COST;

export default function FirmwareTerminal({ onClose }: FirmwareTerminalProps) {
    const dispatch = useDispatch();
    const { roster, scrapCount, blueprints, baseDecksGranted } = useSelector((s: RootState) => s.game);
    const [selectedMmId, setSelectedMmId] = useState<string | null>(null);
    const [isFlashing, setIsFlashing] = useState(false);
    const [flashProgress, setFlashProgress] = useState(0);
    const [targetOS, setTargetOS] = useState<string | null>(null);
    // Pick-2 session: set when a completed flash needs the first-swap card picks.
    const [pickSession, setPickSession] = useState<{ mmId: string; osId: string; kit: string[] } | null>(null);
    const [pickedIndices, setPickedIndices] = useState<number[]>([]);

    const selectedMm = useMemo(() =>
        roster.find(m => m.id === selectedMmId),
        [roster, selectedMmId]);

    const hasBlueprint = useMemo(() =>
        !!selectedMm && blueprints.some(b => b.architectureId === selectedMm.definitionId),
        [blueprints, selectedMm]);

    const handleFlash = () => {
        if (!selectedMm || !targetOS || scrapCount < OS_SWAP_COST || !hasBlueprint) return;

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
                // swapOS validates and spends blueprint + scrap itself (silent no-op
                // on failure, matching the old spendScrap convention).
                if (selectedMmId && targetOS && selectedMm && scrapCount >= OS_SWAP_COST && hasBlueprint) {
                    const key = deckGrantKey(selectedMm.definitionId, targetOS);
                    if (!baseDecksGranted.includes(key)) {
                        // First swap to this OS: open the kit picker; the swap is
                        // dispatched with the picks on confirm.
                        setPickSession({
                            mmId: selectedMmId,
                            osId: targetOS,
                            kit: getDeckForOS(selectedMm.definitionId, targetOS)
                        });
                        setPickedIndices([]);
                    } else {
                        dispatch(swapOS({ id: selectedMmId, targetOS }));
                    }
                }
                setIsFlashing(false);
                setFlashProgress(0);
                setTargetOS(null);
            }, 500);
            return () => clearTimeout(timeout);
        }
    }, [flashProgress, isFlashing, selectedMmId, selectedMm, targetOS, scrapCount, hasBlueprint, baseDecksGranted, dispatch]);

    const availableOSVersions = useMemo(() => {
        if (!selectedMm) return [];
        // Ticket 15: read the registry instead of hardcoding _v1/_v2.
        return GetMingmingData(selectedMm.definitionId).availableOS.map((id, i) => ({
            id,
            version: `v${i + 1}.0`
        }));
    }, [selectedMm]);

    const confirmPicks = () => {
        if (!pickSession) return;
        dispatch(swapOS({
            id: pickSession.mmId,
            targetOS: pickSession.osId,
            pickedCardIds: pickedIndices.map(i => pickSession.kit[i])
        }));
        setPickSession(null);
        setPickedIndices([]);
    };

    const togglePick = (index: number) => {
        setPickedIndices(prev => prev.includes(index)
            ? prev.filter(i => i !== index)
            : prev.length < OS_SWAP_PICK_COUNT ? [...prev, index] : prev);
    };

    return (
        <div className="firmware-terminal-overlay">
            <div className="terminal-window">
                <div className="terminal-header">
                    <span className="terminal-title">FIRMWARE TERMINAL // KERNEL-FLASH-UX</span>
                    <button className="terminal-close" onClick={onClose}>[X]</button>
                </div>

                <div className="terminal-body">
                    {/* Left: Unit Selection */}
                    <div className="terminal-sidebar">
                        <div className="sidebar-label">SELECT TARGET UNIT</div>
                        <div className="unit-list">
                            {roster.map(mm => (
                                <div
                                    key={mm.id}
                                    className={`unit-item ${selectedMmId === mm.id ? 'selected' : ''}`}
                                    onClick={() => !isFlashing && setSelectedMmId(mm.id)}
                                >
                                    <span className="unit-name">{mm.nickname ?? mm.definitionId}</span>
                                    <span className="unit-os-tag">{mm.activeOS?.split('_').pop()?.toUpperCase() ?? 'NONE'}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right: Flash Interface */}
                    <div className="terminal-main">
                        {!selectedMm ? (
                            <div className="empty-state">
                                <div className="glitch-text" data-text="WAITING FOR CONNECTION...">WAITING FOR CONNECTION...</div>
                                <p>Select a MingMing to begin firmware diagnostics.</p>
                            </div>
                        ) : (
                            <div className="flash-ui">
                                <div className="unit-diagnostics">
                                    <h3>DIAGNOSTICS: {selectedMm.nickname ?? selectedMm.definitionId}</h3>
                                    <div className="diag-grid">
                                        <div className="diag-item">
                                            <label>CURRENT KERNEL:</label>
                                            <span>{getOSBehavior(selectedMm.activeOS || '')?.name ?? 'GENERIC_CORE'}</span>
                                        </div>
                                        <div className="diag-item">
                                            <label>SECTOR STATUS:</label>
                                            <span style={{ color: '#00ff00' }}>ONLINE</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="os-selector">
                                    <h3>SELECT FIRMWARE IMAGE</h3>
                                    <div className="os-options">
                                        {availableOSVersions.map(opt => {
                                            const behavior = getOSBehavior(opt.id);
                                            const isSelected = targetOS === opt.id;
                                            const isCurrent = selectedMm.activeOS === opt.id;

                                            return (
                                                <div
                                                    key={opt.id}
                                                    className={`os-option-card ${isSelected ? 'selected' : ''} ${isCurrent ? 'current' : ''}`}
                                                    onClick={() => !isFlashing && !isCurrent && setTargetOS(opt.id)}
                                                >
                                                    <div className="os-option-header">
                                                        <span className="os-version">{opt.version}</span>
                                                        <span className="os-name">{behavior?.name}</span>
                                                    </div>
                                                    <p className="os-desc">{behavior?.description}</p>
                                                    {isCurrent && <div className="os-status-tag">ACTIVE_KERNEL</div>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="flash-footer">
                                    <div className="flash-cost">
                                        FLASH COST: <span className={scrapCount < OS_SWAP_COST ? 'insufficient' : ''}>{OS_SWAP_COST}⚙️</span>
                                        {' + '}
                                        <span className={!hasBlueprint ? 'insufficient' : ''}>1 BLUEPRINT</span>
                                        <label>(CURRENT: {scrapCount}⚙️{hasBlueprint ? ', BLUEPRINT READY' : ', NO BLUEPRINT'})</label>
                                    </div>
                                    <button
                                        className="flash-button"
                                        disabled={!targetOS || scrapCount < OS_SWAP_COST || !hasBlueprint || isFlashing}
                                        onClick={handleFlash}
                                    >
                                        {isFlashing ? 'TRANSFERRING...' : 'START FLASH SEQUENCE'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Progress Overlay */}
                <AnimatePresence>
                    {isFlashing && (
                        <motion.div
                            className="flash-progress-overlay"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            <div className="progress-content">
                                <div className="system-logs">
                                    <div>[SYS] INITIATING HANDSHAKE...</div>
                                    {flashProgress > 20 && <div>[SYS] MOUNTING KERNEL IMAGE...</div>}
                                    {flashProgress > 40 && <div>[SYS] WIPING SECTOR 0...</div>}
                                    {flashProgress > 60 && <div>[SYS] WRITING ADDRESS 0x{Math.floor(Math.random() * 0xFFFF).toString(16).toUpperCase()}</div>}
                                    {flashProgress > 80 && <div>[SYS] VERIFYING CHECKSUM...</div>}
                                    {flashProgress === 100 && <div style={{ color: '#00ff00' }}>[SYS] FLASH COMPLETE!</div>}
                                </div>
                                <div className="progress-bar-container">
                                    <div className="progress-bar-fill" style={{ width: `${flashProgress}%` }} />
                                    <div className="progress-percentage">{flashProgress}%</div>
                                </div>
                                <div className="flash-warning">!!! DO NOT DISCONNECT POWER !!!</div>
                                <div className="scanline"></div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Ticket 15: first-swap kit picker */}
                {pickSession && (
                    <div className="flash-progress-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div className="progress-content" style={{ maxWidth: 560 }}>
                            <h3>KERNEL KIT UNPACKED</h3>
                            <p>Select up to {OS_SWAP_PICK_COUNT} programs from the {getOSBehavior(pickSession.osId)?.name ?? pickSession.osId} starting kit (one-time offer):</p>
                            <div style={{ display: 'grid', gap: 6, margin: '12px 0', maxHeight: 260, overflowY: 'auto' }}>
                                {pickSession.kit.map((dataId, i) => {
                                    const program = GetProgramData(dataId);
                                    const picked = pickedIndices.includes(i);
                                    return (
                                        <button
                                            key={`${dataId}-${i}`}
                                            onClick={() => togglePick(i)}
                                            style={{
                                                textAlign: 'left', padding: '6px 10px', cursor: 'pointer',
                                                border: picked ? '1px solid #00ff00' : '1px solid #555',
                                                background: picked ? 'rgba(0,255,0,0.12)' : 'transparent', color: 'inherit'
                                            }}
                                        >
                                            <strong>{picked ? '[x] ' : '[ ] '}{program.name}</strong> ({program.baseCost}e) — {program.description}
                                        </button>
                                    );
                                })}
                            </div>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                <button className="flash-button" onClick={confirmPicks}>
                                    CONFIRM ({pickedIndices.length}/{OS_SWAP_PICK_COUNT})
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            <div className="scanline"></div>
        </div>
    );
}
