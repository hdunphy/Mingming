// @vitest-environment jsdom
/**
 * Ticket 04's "done when": a deliberately thrown render error in battle shows the boundary, and
 * the save loaded afterwards is the last good one.
 *
 * The repo has no `@testing-library/react` (and adding one would mean committing a lockfile
 * change, which this repo does not do), so these mount with `createRoot` + React 19's `act`.
 * `onUncaughtError`/`onCaughtError` are stubbed on the root because React 19 re-reports caught
 * errors to the console by design and the noise buries the real assertions.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, Component } from 'react';
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';

import ErrorBoundary from './ErrorBoundary';

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/** Throws on first render, renders fine once `armed` is flipped off. */
let armed = true;
function Boom(): ReactNode {
    if (armed) throw new Error('battle screen exploded');
    return <p>BATTLE OK</p>;
}

/** Stand-in for a screen that is fine — proves the boundary is transparent when nothing throws. */
class Quiet extends Component {
    render() {
        return <p>QUIET</p>;
    }
}

let host: HTMLDivElement;
let root: Root;
let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
    armed = true;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host, { onUncaughtError() {}, onCaughtError() {} });
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(async () => {
    await act(async () => {
        root.unmount();
    });
    host.remove();
    consoleError.mockRestore();
});

async function render(node: ReactNode): Promise<void> {
    await act(async () => {
        root.render(node);
    });
}

describe('ErrorBoundary', () => {
    it('renders its children untouched when nothing throws', async () => {
        await render(
            <ErrorBoundary>
                <Quiet />
            </ErrorBoundary>,
        );
        expect(host.textContent).toContain('QUIET');
        expect(host.textContent).not.toContain('SOMETHING BROKE');
    });

    it('catches a render throw and says the save is safe', async () => {
        await render(
            <ErrorBoundary>
                <Boom />
            </ErrorBoundary>,
        );

        expect(host.textContent).toContain('SOMETHING BROKE');
        expect(host.textContent).toContain('Your save is safe');
        // The message is shown, not swallowed — a player pasting it into a report is the point.
        expect(host.textContent).toContain('battle screen exploded');
    });

    it('leaves the stored save exactly as it was — the boundary never writes', async () => {
        const lastGood = JSON.stringify({ version: 3, scrapCount: 42 });
        localStorage.setItem('mingming_save__probe', lastGood);

        await render(
            <ErrorBoundary snapshotState={() => ({ game: { scrapCount: 999 } })}>
                <Boom />
            </ErrorBoundary>,
        );

        expect(host.textContent).toContain('SOMETHING BROKE');
        expect(localStorage.getItem('mingming_save__probe')).toBe(lastGood);
        localStorage.removeItem('mingming_save__probe');
    });

    it('RETURN TO RANCH calls the handler and then re-renders the children', async () => {
        const onReturnToRanch = vi.fn(() => {
            // What main.tsx wires this to: clear the live battle. Here, disarm the thrower so the
            // re-render can succeed the way clearing the battle would.
            armed = false;
        });

        await render(
            <ErrorBoundary onReturnToRanch={onReturnToRanch}>
                <Boom />
            </ErrorBoundary>,
        );
        expect(host.textContent).toContain('SOMETHING BROKE');

        const button = [...host.querySelectorAll('button')].find((b) =>
            b.textContent?.includes('RETURN TO RANCH'),
        );
        expect(button).toBeTruthy();

        await act(async () => {
            button!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });

        expect(onReturnToRanch).toHaveBeenCalledTimes(1);
        expect(host.textContent).toContain('BATTLE OK');
        expect(host.textContent).not.toContain('SOMETHING BROKE');
    });

    it('copies a crash report carrying the error and the injected state', async () => {
        const copy = vi.fn<(text: string) => Promise<boolean>>(async () => true);

        await render(
            <ErrorBoundary copy={copy} snapshotState={() => ({ game: { scrapCount: 42 } })}>
                <Boom />
            </ErrorBoundary>,
        );

        const button = [...host.querySelectorAll('button')].find((b) =>
            b.textContent?.includes('COPY CRASH REPORT'),
        );
        await act(async () => {
            button!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });

        expect(copy).toHaveBeenCalledTimes(1);
        const payload = JSON.parse(copy.mock.calls[0][0]);
        expect(payload.version).toBe(1);
        expect(payload.error.message).toBe('battle screen exploded');
        expect(payload.state.game.scrapCount).toBe(42);
        expect(payload.componentStack).toBeTruthy();
        expect(host.textContent).toContain('COPIED');
    });

    it('reports a failed copy instead of pretending it worked', async () => {
        await render(
            <ErrorBoundary copy={async () => false}>
                <Boom />
            </ErrorBoundary>,
        );

        const button = [...host.querySelectorAll('button')].find((b) =>
            b.textContent?.includes('COPY CRASH REPORT'),
        );
        await act(async () => {
            button!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });

        expect(host.textContent).toContain('COPY FAILED');
    });

    it('survives a snapshotState that throws — a crash handler may not crash', async () => {
        const copy = vi.fn<(text: string) => Promise<boolean>>(async () => true);

        await render(
            <ErrorBoundary
                copy={copy}
                snapshotState={() => {
                    throw new Error('store is gone');
                }}
            >
                <Boom />
            </ErrorBoundary>,
        );

        const button = [...host.querySelectorAll('button')].find((b) =>
            b.textContent?.includes('COPY CRASH REPORT'),
        );
        await act(async () => {
            button!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });

        const payload = JSON.parse(copy.mock.calls[0][0]);
        expect(payload.error.message).toBe('battle screen exploded');
        expect(payload.state.unavailable).toContain('store is gone');
    });

    it('RELOAD uses the injected reloader rather than touching window.location', async () => {
        const reload = vi.fn();
        await render(
            <ErrorBoundary reload={reload}>
                <Boom />
            </ErrorBoundary>,
        );

        const button = [...host.querySelectorAll('button')].find((b) => b.textContent === 'RELOAD');
        await act(async () => {
            button!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });

        expect(reload).toHaveBeenCalledTimes(1);
    });
});
