import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store/store';
import { setActiveParty } from '../store/gameSlice';
import { getOSBehavior } from '../../engine/data/firmwareRegistry';
import FirmwareTerminal from '../components/FirmwareTerminal';
import { TypeChartPanel } from '../components/TypeChart';

export default function RosterTerminal() {
    const dispatch = useDispatch();
    const { roster, activeParty } = useSelector((s: RootState) => s.game);

    const activeSet = new Set(activeParty);

    const toggleParty = (id: string) => {
        if (activeSet.has(id)) {
            // Remove from party
            dispatch(setActiveParty(activeParty.filter(pid => pid !== id) as string[]));
        } else if (activeParty.length < 3) {
            // Add to party
            dispatch(setActiveParty([...activeParty, id] as string[]));
        }
    };

    const [showFirmware, setShowFirmware] = useState(false);

    return (
        <div className="roster-terminal">
            <div className="roster-header">
                <h1>🤖 Roster Terminal</h1>
                <div className="header-actions">
                    <button className="firmware-boot-btn" onClick={() => setShowFirmware(true)}>
                        💾 BOOT FIRMWARE TERMINAL
                    </button>
                    <div className="party-counter">
                        Active Party: {activeParty.length} / 3
                    </div>
                </div>
            </div>

            <div className="roster-body">
                {/* Active Party Slots */}
                <div className="party-slots">
                    <h2>⚔️ Active Party</h2>
                    <div className="party-grid">
                        {[0, 1, 2].map(slot => {
                            const id = activeParty[slot];
                            const mm = id ? roster.find(r => r.id === id) : null;
                            return (
                                <div
                                    key={slot}
                                    className={`party-slot ${mm ? 'filled' : 'empty'}`}
                                    onClick={() => mm && toggleParty(mm.id)}
                                >
                                    {mm ? (
                                        <>
                                            <div className="slot-name">{mm.nickname ?? mm.definitionId}</div>
                                            <div className="slot-ivs">
                                                ATK:{mm.attackIV} DEF:{mm.defenseIV} HP:{mm.hpIV}
                                            </div>
                                            <div className="slot-action">Click to remove</div>
                                        </>
                                    ) : (
                                        <div className="slot-empty-text">Empty Slot</div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Full Roster */}
                <div className="roster-grid-section">
                    <h2>📋 Full Roster ({roster.length})</h2>
                    <div className="roster-grid">
                        {roster.length === 0 && (
                            <div className="empty-state">No MingMings yet. Compile them in the Synthesis Lab!</div>
                        )}
                        {roster.map(mm => {
                            const isActive = activeSet.has(mm.id);
                            return (
                                <div
                                    key={mm.id}
                                    className={`roster-card ${isActive ? 'active' : ''}`}
                                    onClick={() => toggleParty(mm.id)}
                                >
                                    <div className="roster-card-name">{mm.nickname ?? mm.definitionId}</div>
                                    <div className="roster-card-ivs">
                                        <span>⚔ {mm.attackIV}</span>
                                        <span>🛡 {mm.defenseIV}</span>
                                        <span>💚 {mm.hpIV}</span>
                                    </div>
                                    {mm.activeOS && (
                                        <div className="roster-os-info">
                                            <div className="roster-os-name">OS: {getOSBehavior(mm.activeOS)?.name}</div>
                                            <div className="roster-os-desc">{getOSBehavior(mm.activeOS)?.description}</div>
                                        </div>
                                    )}
                                    {isActive && <div className="roster-card-badge">ACTIVE</div>}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Elemental matchup reference — collapsed by default so it never crowds the roster grid */}
                <TypeChartPanel />
            </div>

            {showFirmware && <FirmwareTerminal onClose={() => setShowFirmware(false)} />}
        </div>
    );
}
