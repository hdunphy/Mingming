import React, { useState } from 'react';
import { getVolume, isMuted, playSfx, setMuted, setVolume } from '../audio/AudioEngine';

/**
 * AudioControls — unobtrusive speaker toggle + volume slider, neon-terminal
 * styled. Lives in the App nav corner; `floating` renders a fixed top-right
 * variant for the battle screen (which replaces the nav entirely).
 *
 * The engine owns persistence (the 'mingming_audio' key, through the save-storage
 * adapter); this component
 * just mirrors it into local state. Clicking the toggle is itself the user
 * gesture that unlocks the AudioContext.
 */
const AudioControls: React.FC<{ floating?: boolean }> = ({ floating }) => {
    const [muted, setMutedState] = useState(isMuted);
    const [volume, setVolumeState] = useState(getVolume);

    const handleToggle = () => {
        const next = !muted;
        setMuted(next);
        setMutedState(next);
        if (!next) playSfx('uiClick');
    };

    const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = Number(e.target.value);
        setVolume(v);
        setVolumeState(v);
        // Audible feedback while dragging (the 35ms coalescer keeps it sparse).
        playSfx('uiClick');
    };

    return (
        <div
            className="audio-controls"
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 10px',
                borderRadius: '6px',
                border: '1px solid rgba(0, 210, 255, 0.25)',
                background: 'rgba(0, 0, 0, 0.45)',
                ...(floating
                    ? {
                          position: 'fixed',
                          top: '10px',
                          right: '10px',
                          zIndex: 1500,
                      }
                    : {
                          // Nav corner: absolute so the centered tab row stays centered.
                          position: 'absolute',
                          right: '10px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                      }),
            }}
        >
            <button
                onClick={handleToggle}
                title={muted ? 'Unmute audio' : 'Mute audio'}
                aria-label={muted ? 'Unmute audio' : 'Mute audio'}
                style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    lineHeight: 1,
                    padding: '2px',
                    color: muted ? '#556' : '#00d2ff',
                    textShadow: muted ? 'none' : '0 0 8px rgba(0, 210, 255, 0.6)',
                }}
            >
                {muted ? '🔇' : '🔊'}
            </button>
            <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                onChange={handleVolume}
                disabled={muted}
                aria-label="Audio volume"
                style={{
                    width: '72px',
                    accentColor: muted ? '#445' : '#00d2ff',
                    cursor: muted ? 'default' : 'pointer',
                    opacity: muted ? 0.4 : 1,
                }}
            />
        </div>
    );
};

export default AudioControls;
