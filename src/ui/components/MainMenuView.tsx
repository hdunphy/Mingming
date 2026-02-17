import React from 'react';
import { motion } from 'framer-motion';
import { useDispatch } from 'react-redux';
import { startNewGauntlet } from '../store/gameSlice';

const StarterCard: React.FC<{
    id: 'kraken' | 'fenrir';
    name: string;
    element: string;
    description: string;
    onSelect: () => void;
}> = ({ id, name, element, description, onSelect }) => {
    const isWater = id === 'kraken';
    return (
        <motion.div
            whileHover={{ scale: 1.05, y: -10 }}
            whileTap={{ scale: 0.95 }}
            style={{
                width: '280px',
                background: '#1a1a1a',
                borderRadius: '15px',
                padding: '30px',
                border: `2px solid ${isWater ? '#0088ff' : '#ff4400'}`,
                cursor: 'pointer',
                textAlign: 'center',
                boxShadow: `0 10px 30px rgba(0,0,0,0.5), 0 0 20px ${isWater ? 'rgba(0,136,255,0.2)' : 'rgba(255,68,0,0.2)'}`
            }}
            onClick={onSelect}
        >
            <div style={{ fontSize: '1.2rem', color: isWater ? '#00ccff' : '#ff8800', fontWeight: 'bold', marginBottom: '10px' }}>
                {element.toUpperCase()} UNIT
            </div>
            <h2 style={{ fontSize: '2.5rem', margin: '10px 0', letterSpacing: '2px' }}>{name}</h2>
            <p style={{ color: '#888', minHeight: '60px', margin: '20px 0' }}>{description}</p>
            <div style={{ marginTop: '20px', padding: '10px', background: '#222', borderRadius: '8px', fontSize: '0.9rem' }}>
                STARTER CARD: {isWater ? 'SQUIRT' : 'SPICY BREATH'}
            </div>
        </motion.div>
    );
};

const MainMenuView: React.FC = () => {
    const dispatch = useDispatch();

    return (
        <div className="main-menu" style={{
            height: '100vh',
            width: '100vw',
            background: 'radial-gradient(circle at center, #111 0%, #000 100%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            overflow: 'hidden'
        }}>
            <motion.div
                initial={{ opacity: 0, y: -50 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ textAlign: 'center', marginBottom: '60px' }}
            >
                <h1 style={{ fontSize: '4rem', fontWeight: '900', letterSpacing: '10px', margin: 0, background: 'linear-gradient(to bottom, #fff, #333)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    TERMINAL
                </h1>
                <h1 style={{ fontSize: '4rem', fontWeight: '900', letterSpacing: '10px', margin: 0, marginTop: '-15px', color: '#00ffaa' }}>
                    GAUNTLET
                </h1>
                <p style={{ color: '#555', marginTop: '10px', fontSize: '1.1rem' }}>CHOOSE YOUR STARTER PROGRAM</p>
            </motion.div>

            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                style={{ display: 'flex', gap: '40px' }}
            >
                <StarterCard
                    id="kraken"
                    name="KRAKEN"
                    element="Water"
                    description="Versatile and sustainable. Focuses on card draw and status manipulation."
                    onSelect={() => dispatch(startNewGauntlet('kraken'))}
                />
                <StarterCard
                    id="fenrir"
                    name="FENRIR"
                    element="Fire"
                    description="Aggressive and high-impact. Focuses on status upgrades and overwhelming power."
                    onSelect={() => dispatch(startNewGauntlet('fenrir'))}
                />
            </motion.div>

            <div style={{ position: 'fixed', bottom: '40px', color: '#333', fontSize: '0.8rem' }}>
                ALPHA v0.3.5 | ROGUELIKE LOOP SYSTEM
            </div>
        </div>
    );
};

export default MainMenuView;
