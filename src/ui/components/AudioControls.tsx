import React, { useState } from 'react';
import { getVolume, isMuted, playSfx, setMuted, setVolume } from '../audio/AudioEngine';
import { Icon } from '../theme/Icon';

/**
 * AudioControls — unobtrusive speaker toggle + volume slider, a navy slanted chip (183f). Lives in the App nav corner; `floating` renders a fixed top-right
 * variant for the battle screen (which replaces the nav entirely).
 *
 * The engine owns persistence (the 'mingming_audio' key, through the save-storage
 * adapter); this component
 * just mirrors it into local state. Clicking the toggle is itself the user
 * gesture that unlocks the AudioContext.
 */
/**
 * Ticket 145c added `inline`. The battle screen's `floating` variant is gone with the corner it
 * floated in: the top bar owns that strip now and positions its own children, so the control has
 * to be able to sit in a flex row rather than pin itself to the viewport. `floating` stays for any
 * caller that still wants the old corner behaviour.
 */
const AudioControls: React.FC<{ floating?: boolean; inline?: boolean }> = ({ floating, inline }) => {
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
                padding: '4px 14px',
                background: 'var(--panel-2)',
                clipPath: 'polygon(5px 0, 100% 0, calc(100% - 5px) 100%, 0 100%)',
                // Ticket 145c: `inline` sits in a flex row and positions nothing — the battle top
                // bar owns its own layout, and a child that pins itself to the viewport cannot live
                // in it.
                ...(inline
                    ? { position: 'static' as const }
                    : floating
                        ? {
                              position: 'fixed' as const,
                              top: '10px',
                              right: '10px',
                              zIndex: 1500,
                          }
                        : {
                              // Nav corner: absolute so the centered tab row stays centered.
                              position: 'absolute' as const,
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
                    color: muted ? 'var(--text-faint)' : 'var(--text)',
                }}
            >
                <Icon name={muted ? 'sound-off' : 'sound-on'} size={15} title={muted ? 'Unmute' : 'Mute'} />
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
                    accentColor: muted ? 'var(--panel-3)' : 'var(--select)',
                    cursor: muted ? 'default' : 'pointer',
                    opacity: muted ? 0.4 : 1,
                }}
            />
        </div>
    );
};

export default AudioControls;
