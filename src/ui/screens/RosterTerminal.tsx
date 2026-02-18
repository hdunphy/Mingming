import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store/store';
import { setActiveParty } from '../store/gameSlice';
import { getExpForLevel } from '../../engine/types';

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

    return (
        <div className="roster-terminal">
            <div className="roster-header">
                <h1>🤖 Roster Terminal</h1>
                <div className="party-counter">
                    Active Party: {activeParty.length} / 3
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
                                            <div className="slot-level">Lv. {mm.level}</div>
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
                                    <div className="roster-card-level">Lv. {mm.level}</div>
                                    <div className="roster-card-ivs">
                                        <span>⚔ {mm.attackIV}</span>
                                        <span>🛡 {mm.defenseIV}</span>
                                        <span>💚 {mm.hpIV}</span>
                                    </div>
                                    <div className="roster-card-xp" style={{ marginTop: '10px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', marginBottom: '4px' }}>
                                            <span>XP</span>
                                            <span>{mm.experience} / {getExpForLevel(mm.level + 1)}</span>
                                        </div>
                                        <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                                            <div style={{
                                                height: '100%',
                                                width: `${(mm.experience / getExpForLevel(mm.level + 1)) * 100}%`,
                                                background: 'linear-gradient(90deg, #00d2ff, #3a7bd5)'
                                            }} />
                                        </div>
                                    </div>
                                    {isActive && <div className="roster-card-badge">ACTIVE</div>}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
