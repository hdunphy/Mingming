/**
 * The player-facing half of ticket 04's "surface the failure" requirement.
 *
 * `saveGame` never writes an invalid save and never clobbers a good one on a failed write — but
 * before this banner the *only* signal that autosave had stopped working was a `console.error`,
 * which is invisible in a packaged desktop build. A player could keep going for an hour on a save
 * that stopped updating an hour ago and only find out on relaunch.
 *
 * Deliberately non-modal: the run is still playable and interrupting it would be worse than the
 * problem. It sits at the top of the viewport and stays until a write succeeds.
 */

import { useSyncExternalStore } from 'react';

import { getSaveHealth, subscribeSaveHealth } from '../store/saveHealth';

const WORDING: Record<string, { headline: string; detail: string }> = {
    quota: {
        headline: 'NOT SAVING — STORAGE IS FULL',
        detail:
            'Your last good save is intact, but new progress is not being written. Free up browser storage (or delete an unused save slot) and play on — the next autosave will pick it up.',
    },
    storage: {
        headline: 'NOT SAVING — STORAGE UNAVAILABLE',
        detail:
            'This browser is blocking local storage, so progress is not being written. Private/incognito windows do this. Your last good save is intact.',
    },
    validation: {
        headline: 'NOT SAVING — REJECTED BY THE SAVE CHECK',
        detail:
            'The game produced a save that failed validation, so it was refused rather than written. Your last good save is intact. This is a bug — the details below are worth pasting into a report.',
    },
};

const FALLBACK = {
    headline: 'NOT SAVING',
    detail: 'Progress is not being written. Your last good save is intact.',
};

export default function SaveHealthBanner() {
    const health = useSyncExternalStore(subscribeSaveHealth, getSaveHealth, getSaveHealth);

    if (health.healthy) return null;

    const words = (health.kind && WORDING[health.kind]) || FALLBACK;

    return (
        <div
            role="status"
            aria-live="polite"
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                zIndex: 9998,
                padding: '10px 16px',
                background: '#3a1414',
                borderBottom: '1px solid #c06a6a',
                color: '#f0dede',
                fontSize: '0.85rem',
                lineHeight: 1.45,
                textAlign: 'center',
            }}
        >
            <strong style={{ letterSpacing: '2px' }}>⚠ {words.headline}</strong>
            <div style={{ marginTop: '4px', color: '#d6b8b8' }}>{words.detail}</div>
            {health.failureCount > 1 && (
                <div style={{ marginTop: '4px', color: '#a08080', fontSize: '0.75rem' }}>
                    {health.failureCount} consecutive failed writes.
                </div>
            )}
            {health.error && (
                <details style={{ marginTop: '6px', color: '#a08080', fontSize: '0.75rem' }}>
                    <summary style={{ cursor: 'pointer' }}>Details</summary>
                    <pre style={{ whiteSpace: 'pre-wrap', textAlign: 'left', margin: '6px 0 0' }}>
                        {health.error}
                    </pre>
                </details>
            )}
        </div>
    );
}
