import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import type { RootState } from '../store/store';

const CombatLog: React.FC = () => {
    const logs = useSelector((state: RootState) => state.battle.battle?.logs || []);
    const osLogs = useSelector((state: RootState) => state.battle.battle?.osLogs || []);
    const logEndRef = useRef<HTMLDivElement>(null);
    const [isCollapsed, setIsCollapsed] = useState(false);

    useEffect(() => {
        if (!isCollapsed) {
            logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, osLogs, isCollapsed]);

    // Both streams are append-only, so an entry's index WITHIN its own stream is
    // a stable identity ('log-17' / 'os-3'). Indexes into the combined array are
    // not: every new combat log used to shift all OS keys, re-triggering their
    // enter animation. The engine records no interleaving info between the two
    // streams (true chronological merging needs an engine-side sequence number —
    // out of scope), so OS proc entries are tagged with an [OS] chip and kept
    // appended after the combat stream.
    const entries = [
        ...logs.map((text, i) => ({ key: `log-${i}`, text, isOS: false })),
        ...osLogs.map((text, i) => ({ key: `os-${i}`, text, isOS: true })),
    ];

    return (
        <div className="combat-log-container">
            <div
                className="log-header"
                onClick={() => setIsCollapsed(!isCollapsed)}
                style={{ cursor: 'pointer', userSelect: 'none' }}
            >
                <span>COMBAT LOG</span>
                <span style={{ float: 'right' }}>{isCollapsed ? '▼' : '▲'}</span>
            </div>
            <AnimatePresence>
                {!isCollapsed && (
                    <motion.div
                        className="log-messages"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <AnimatePresence initial={false}>
                            {entries.map(entry => (
                                <motion.div
                                    key={entry.key}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className={`log-entry ${entry.isOS ? 'os-proc' : ''}`}
                                >
                                    <span className="log-timestamp">{'>>'}</span>{' '}
                                    {entry.isOS && <span className="log-os-chip">OS</span>}
                                    {entry.text}
                                </motion.div>
                            ))}
                        </AnimatePresence>
                        <div ref={logEndRef} />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default CombatLog;
