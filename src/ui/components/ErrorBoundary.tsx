/**
 * Top-level error boundary — ticket 04 (steam-release map).
 *
 * Before this, a single render throw anywhere in the tree unmounted the whole app and left a
 * white screen. On the web that reads as "the game is broken"; on Steam it reads as a refund.
 * Worse, the only recovery a player could invent was a page reload, and the two places the app
 * *does* reload (`BattleArena.handleDefeatReset`, `HubScreen.handleRestart`) reload immediately
 * after deliberately wiping the save — so "reload to fix it" is muscle memory pointing at a
 * data-loss button.
 *
 * The screen therefore leads with the fact that matters — **the save is safe** — and offers the
 * two non-destructive exits: back to the ranch (clears the live battle, keeps the save) and a
 * plain reload (the save is on disk; reloading re-reads it).
 *
 * A class component because `getDerivedStateFromError` / `componentDidCatch` have no hook
 * equivalent. Everything it needs from the outside arrives as a prop, so it neither imports the
 * store singleton nor needs a Provider in tests.
 */

import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

import { buildCrashReport, copyCrashReport, serializeCrashReport } from '../utils/crashReport';

export interface ErrorBoundaryProps {
    children: ReactNode;
    /**
     * Put the app back on a screen that can render. Wired in `main.tsx` to
     * `dispatch(setBattleState(null))` — a crash in battle is by far the likeliest, and the
     * battle is the one piece of state that is not persisted, so dropping it is free.
     * Called *before* the boundary clears its own error state.
     */
    onReturnToRanch?: () => void;
    /** Redux state for the crash report. A thunk so nothing is read until a crash happens. */
    snapshotState?: () => unknown;
    /** Test seam: swap the clipboard write. */
    copy?: (text: string) => Promise<boolean>;
    /** Test seam: swap `window.location.reload`. */
    reload?: () => void;
}

interface ErrorBoundaryState {
    error: unknown | null;
    componentStack?: string;
    /** null = not attempted yet; true/false = the last copy's outcome. */
    copied: boolean | null;
}

const panelStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '18px',
    padding: '40px',
    textAlign: 'center',
    background: 'radial-gradient(circle at center, #1a1a2e 0%, #050508 100%)',
    color: '#e6e6f0',
    fontFamily: 'inherit',
    overflowY: 'auto',
};

const buttonStyle: React.CSSProperties = {
    padding: '12px 22px',
    background: 'transparent',
    color: '#7fe3d0',
    border: '1px solid #7fe3d0',
    borderRadius: '2px',
    letterSpacing: '2px',
    cursor: 'pointer',
    font: 'inherit',
};

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    state: ErrorBoundaryState = { error: null, copied: null };

    static getDerivedStateFromError(error: unknown): Partial<ErrorBoundaryState> {
        return { error, copied: null };
    }

    componentDidCatch(error: unknown, info: ErrorInfo): void {
        // React already logs the error itself; this adds the component stack in one place so a
        // player reading DevTools, or a future telemetry hook (ticket 53), has the whole picture.
        console.error('[ErrorBoundary] render threw:', error, info?.componentStack);
        this.setState({ componentStack: info?.componentStack ?? undefined });
    }

    private buildReportText(): string {
        let state: unknown;
        try {
            state = this.props.snapshotState?.();
        } catch (err) {
            state = { unavailable: String(err) };
        }
        return serializeCrashReport(
            buildCrashReport({
                error: this.state.error,
                componentStack: this.state.componentStack,
                state,
            }),
        );
    }

    private handleCopy = async (): Promise<void> => {
        const copy = this.props.copy ?? copyCrashReport;
        let ok = false;
        try {
            ok = await copy(this.buildReportText());
        } catch {
            ok = false;
        }
        this.setState({ copied: ok });
    };

    private handleReturnToRanch = (): void => {
        try {
            this.props.onReturnToRanch?.();
        } catch (err) {
            // If clearing the battle itself throws we are out of safe moves, but the boundary
            // must still drop its error so the player sees *something* rather than this screen
            // wedged forever.
            console.error('[ErrorBoundary] return-to-ranch failed:', err);
        }
        this.setState({ error: null, componentStack: undefined, copied: null });
    };

    private handleReload = (): void => {
        const reload = this.props.reload ?? (() => window.location.reload());
        reload();
    };

    render(): ReactNode {
        if (this.state.error === null) return this.props.children;

        const message =
            this.state.error instanceof Error ? this.state.error.message : String(this.state.error);

        return (
            <div style={panelStyle} role="alert">
                <h1 style={{ fontSize: '2rem', letterSpacing: '4px', margin: 0 }}>SOMETHING BROKE</h1>
                <p style={{ color: '#7fe3d0', margin: 0, fontSize: '1.05rem' }}>
                    Your save is safe. Nothing was written over.
                </p>
                <p style={{ color: '#8a8aa0', margin: 0, maxWidth: '46ch', lineHeight: 1.5 }}>
                    A screen failed to draw. The run in progress may be lost, but your roster,
                    blueprints and scrap are on disk exactly as they were.
                </p>

                <pre
                    style={{
                        maxWidth: 'min(90vw, 70ch)',
                        maxHeight: '22vh',
                        overflow: 'auto',
                        padding: '10px 14px',
                        margin: 0,
                        textAlign: 'left',
                        background: '#0b0b14',
                        border: '1px solid #2a2a3e',
                        color: '#c06a6a',
                        fontSize: '0.8rem',
                        whiteSpace: 'pre-wrap',
                    }}
                >
                    {message}
                </pre>

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <button type="button" style={buttonStyle} onClick={this.handleReturnToRanch}>
                        RETURN TO RANCH
                    </button>
                    <button type="button" style={buttonStyle} onClick={this.handleCopy}>
                        {this.state.copied === null
                            ? 'COPY CRASH REPORT'
                            : this.state.copied
                              ? 'COPIED ✓'
                              : 'COPY FAILED — SELECT ABOVE'}
                    </button>
                    <button
                        type="button"
                        style={{ ...buttonStyle, color: '#8a8aa0', borderColor: '#3a3a4e' }}
                        onClick={this.handleReload}
                    >
                        RELOAD
                    </button>
                </div>

                <p style={{ color: '#55556a', margin: 0, fontSize: '0.8rem', maxWidth: '52ch' }}>
                    The crash report is JSON — paste it into a bug report. It contains your game
                    state and nothing else.
                </p>
            </div>
        );
    }
}
