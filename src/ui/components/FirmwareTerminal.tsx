import React, { useState, useEffect, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import type { RootState } from '../store/store';
import { swapOS } from '../store/gameSlice';
import { getOSBehavior } from '../../engine/data/firmwareRegistry';
import { GetMingmingData } from '../../engine/data/mingmingRegistry';

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
                                    <span className="unit-os-tag">{mm.activeOS.split('_').pop()?.toUpperCase() ?? 'NONE'}</span>
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
                                            <span>{getOSBehavior(selectedMm.activeOS)?.name ?? 'GENERIC_CORE'}</span>
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
                                        FLASH COST: <span className={!hasBlueprint ? 'insufficient' : ''}>1 BLUEPRINT</span>
                                        <label>(HELD: {blueprintsHeld})</label>
                                    </div>
                                    <button
                                        className="flash-button"
                                        disabled={!targetOS || !hasBlueprint || isFlashing}
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
            </div>
            <div className="scanline"></div>
        </div>
    );
}
