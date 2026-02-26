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
    }, [logs, isCollapsed]);

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
                        <AnimatePresence>
                            {[...logs, ...osLogs.map(l => `[OS] ${l}`)].map((log, index) => {
                                const isOS = log.startsWith('[OS]');
                                return (
                                    <motion.div
                                        key={`log-${index}-${log.slice(0, 15)}`}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className={`log-entry ${isOS ? 'os-proc' : ''}`}
                                    >
                                        <span className="log-timestamp">[{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span> {isOS ? log.replace('[OS] ', '') : log}
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                        <div ref={logEndRef} />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default CombatLog;
