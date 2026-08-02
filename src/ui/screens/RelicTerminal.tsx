import React from 'react';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import type { RootState } from '../store/store';
import { RelicRegistry } from '../../engine/data/relicRegistry';

export default function RelicTerminal() {
    const { relics } = useSelector((s: RootState) => s.game);

    return (
        <div className="relic-terminal" style={{ padding: '40px', color: '#fff', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <header style={{ marginBottom: '40px' }}>
                <h1 style={{ fontSize: '2.5rem', fontWeight: '900', margin: 0, letterSpacing: '-1px' }}>
                    RELIC_<span style={{ color: '#fbbf24' }}>VAULT</span>
                </h1>
                <p style={{ opacity: 0.5, fontSize: '0.9rem' }}>SYSTEM WIDE PASSIVE UPGRADES ACTIVE</p>
            </header>

            <div style={{ flex: 1, overflowY: 'auto' }}>
                {relics.length === 0 ? (
                    <div style={{ textAlign: 'center', marginTop: '10vh', opacity: 0.5 }}>
                        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📦</div>
                        <h2>VAULT EMPTY</h2>
                        <p>Breach sector firewalls to recover powerful system Relics.</p>
                    </div>
                ) : (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                        gap: '20px'
                    }}>
                        {relics.map((relicId, i) => {
                            const relicInfo = RelicRegistry[relicId];
                            if (!relicInfo) return null;

                            return (
                                <motion.div
                                    key={relicId}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    style={{
                                        background: 'rgba(251, 191, 36, 0.05)',
                                        border: '1px solid rgba(251, 191, 36, 0.3)',
                                        borderRadius: '12px',
                                        padding: '25px',
                                        boxShadow: '0 4px 20px rgba(251, 191, 36, 0.1)',
                                        position: 'relative',
                                        overflow: 'hidden'
                                    }}
                                >
                                    <div style={{
                                        position: 'absolute',
                                        top: '-20px',
                                        right: '-20px',
                                        width: '100px',
                                        height: '100px',
                                        background: 'radial-gradient(circle, rgba(251,191,36,0.2) 0%, rgba(0,0,0,0) 70%)',
                                        borderRadius: '50%'
                                    }} />

                                    <div style={{ fontSize: '2rem', marginBottom: '15px' }}>💎</div>
                                    <h3 style={{
                                        margin: '0 0 10px 0',
                                        color: '#fbbf24',
                                        fontSize: '1.2rem',
                                        textTransform: 'uppercase',
                                        letterSpacing: '1px'
                                    }}>
                                        {relicInfo.name}
                                    </h3>
                                    <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.8, lineHeight: '1.5' }}>
                                        {relicInfo.description}
                                    </p>

                                    <div style={{
                                        marginTop: '20px',
                                        fontSize: '0.7rem',
                                        fontWeight: 'bold',
                                        color: '#10b981',
                                        background: 'rgba(16, 185, 129, 0.1)',
                                        display: 'inline-block',
                                        padding: '4px 8px',
                                        borderRadius: '4px'
                                    }}>
                                        STATUS: ACTIVE
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
