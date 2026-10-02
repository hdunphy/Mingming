import { useState } from 'react';
import type { ReactNode } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { playSfx } from '../audio/AudioEngine';
import { endRunAction } from '../store/runSlice';
import type { RootState } from '../store/store';
import { closeSettings } from '../store/uiSlice';

/**
 * TICKET 182a (R5) — "Abandon run", in Settings, only while a run is in progress.
 *
 * It was a button at the top right of the map. There is no pause menu, so Settings is where quitting
 * a run lives now, and it keeps the two steps ticket 19 gave it: `window.confirm` is a native modal
 * in a game that draws its own UI, and a stray click is what stands between the player and forty
 * minutes. Abandoning ends the run as `'abandoned'` (the run summary reads it) and closes Settings.
 */
export default function AbandonRunSetting(): ReactNode {
    const dispatch = useDispatch();
    const inProgress = useSelector((s: RootState) => s.run.run !== null && s.run.run.phase !== 'ended');
    const run = useSelector((s: RootState) => s.run.run);
    const [confirming, setConfirming] = useState(false);

    if (!inProgress) return null;

    const abandon = (): void => {
        setConfirming(false);
        dispatch(endRunAction(run, 'abandoned'));
        dispatch(closeSettings());
        playSfx('uiError');
    };

    return (
        <section className="settings-group">
            <h3>Run</h3>
            <div className="settings-row">
                <span className="settings-label">Leave this run</span>
                <div className="settings-control">
                    {confirming ? (
                        <>
                            <button type="button" className="settings-button" onClick={abandon}>
                                Abandon — the run is lost
                            </button>
                            <button
                                type="button"
                                className="settings-choice"
                                onClick={() => { playSfx('uiClick'); setConfirming(false); }}
                            >
                                Keep going
                            </button>
                        </>
                    ) : (
                        <button
                            type="button"
                            className="settings-button"
                            onClick={() => { playSfx('uiClick'); setConfirming(true); }}
                        >
                            Abandon run
                        </button>
                    )}
                </div>
            </div>
        </section>
    );
}
