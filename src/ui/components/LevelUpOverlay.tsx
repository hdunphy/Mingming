import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { LevelUpEvent } from '../../engine/types';

interface Props {
    event: LevelUpEvent;
    onDismiss: () => void;
}

const StatBar: React.FC<{ label: string; oldVal: number; newVal: number; color: string }> = ({ label, oldVal, newVal, color }) => {
    const diff = newVal - oldVal;
    return (
        <div style={{ marginBottom: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '0.9rem' }}>
                <span>{label}</span>
                <span>
                    {oldVal} <span style={{ color: '#00ffaa' }}>+{diff}</span> → {newVal}
                </span>
            </div>
            <div style={{ height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                <motion.div
                    initial={{ width: `${(oldVal / newVal) * 100}%` }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    style={{ height: '100%', background: color }}
                />
            </div>
        </div>
    );
};

const LevelUpOverlay: React.FC<Props> = ({ event, onDismiss }) => {
    // Guard against double-dismiss: during the exit animation the outgoing
    // overlay is still mounted and clickable; a second CONTINUE click would
    // silently swallow the next queued level-up.
    const [dismissed, setDismissed] = useState(false);
    const handleDismiss = () => {
        if (dismissed) return;
        setDismissed(true);
        onDismiss();
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 3000,
                background: 'rgba(0,0,0,0.9)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(10px)',
                pointerEvents: dismissed ? 'none' : 'auto'
            }}
        >
            <motion.div
                initial={{ scale: 0.8, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                style={{
                    background: '#1a1a2e',
                    border: '2px solid #7c3aed',
                    borderRadius: '20px',
                    padding: '40px',
                    width: '400px',
                    textAlign: 'center',
                    boxShadow: '0 0 50px rgba(124, 58, 237, 0.3)'
                }}
            >
                <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    style={{ fontSize: '1.2rem', color: '#7c3aed', fontWeight: 'bold', marginBottom: '10px' }}
                >
                    LEVEL UP!
                </motion.div>

                <h1 style={{ margin: '0 0 5px 0', fontSize: '2.5rem' }}>{event.nickname.toUpperCase()}</h1>
                <div style={{ fontSize: '1.2rem', color: '#aaa', marginBottom: '30px' }}>
                    LV {event.oldLevel} → <span style={{ color: '#00ffaa', fontWeight: 'bold' }}>LV {event.newLevel}</span>
                </div>

                <div style={{ textAlign: 'left', marginBottom: '40px' }}>
                    <StatBar label="MAX HP" oldVal={event.oldStats.hp} newVal={event.newStats.hp} color="var(--hp-green)" />
                    <StatBar label="ATTACK" oldVal={event.oldStats.attack} newVal={event.newStats.attack} color="var(--fire)" />
                    <StatBar label="DEFENSE" oldVal={event.oldStats.defense} newVal={event.newStats.defense} color="var(--water)" />
                </div>

                <button
                    onClick={handleDismiss}
                    className="action-button"
                    style={{ width: '100%', padding: '15px' }}
                >
                    CONTINUE
                </button>
            </motion.div>
        </motion.div>
    );
};

export default LevelUpOverlay;
