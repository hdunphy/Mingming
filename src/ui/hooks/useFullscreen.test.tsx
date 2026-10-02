// @vitest-environment jsdom
/**
 * TICKET 37 — the fullscreen toggle's three claims, each of which can be false silently.
 *
 * jsdom implements none of the Fullscreen API, which is why every case here installs its own
 * `document.fullscreenElement` / `requestFullscreen` / `exitFullscreen`. That is not a weakness of
 * the test: the hook's whole job is to cope with hosts that have a partial API, so a fake is the
 * only way to exercise "absent", "present" and "present but refusing" at all.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

import { fullscreenSupported, useFullscreen, type FullscreenControl } from './useFullscreen';

// The repo's convention for a test that drives React with `act` — see `ErrorBoundary.test.tsx`.
declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/** Install a fake Fullscreen API on the jsdom document; returns a restore function. */
function fakeApi(opts: { enabled?: boolean; request?: () => Promise<void> } = {}) {
    const doc = document as unknown as Record<string, unknown>;
    const de = document.documentElement as unknown as Record<string, unknown>;
    const original = { el: doc.fullscreenElement, enabled: doc.fullscreenEnabled, req: de.requestFullscreen, exit: doc.exitFullscreen };

    doc.fullscreenElement = null;
    doc.fullscreenEnabled = opts.enabled ?? true;
    de.requestFullscreen = opts.request ?? (() => {
        doc.fullscreenElement = document.documentElement;
        document.dispatchEvent(new Event('fullscreenchange'));
        return Promise.resolve();
    });
    doc.exitFullscreen = () => {
        doc.fullscreenElement = null;
        document.dispatchEvent(new Event('fullscreenchange'));
        return Promise.resolve();
    };
    return () => {
        doc.fullscreenElement = original.el;
        doc.fullscreenEnabled = original.enabled;
        de.requestFullscreen = original.req;
        doc.exitFullscreen = original.exit;
    };
}

/**
 * Mount the hook and hand back a live view of its return value.
 *
 * The value is published from an EFFECT rather than assigned during render. Assigning an outer
 * variable while rendering is a side effect in render — `react-hooks/globals` rejects it, and
 * rightly: it is the same class of bug this hook avoids by deriving its state from the document.
 * Effects flush inside `act`, so every case below still reads the post-update value.
 */
function mount(): { current: () => FullscreenControl; unmount: () => void } {
    const holder: { value: FullscreenControl | null } = { value: null };
    const Probe = () => {
        const control = useFullscreen();
        useEffect(() => { holder.value = control; });
        return null;
    };
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => { root.render(<Probe />); });
    return {
        current: () => holder.value!,
        unmount: () => { act(() => { root.unmount(); }); host.remove(); },
    };
}

const restores: Array<() => void> = [];
afterEach(() => { while (restores.length) restores.pop()!(); });

describe('37 — useFullscreen', () => {
    it('reports UNSUPPORTED where the host has no usable API, so no dead control is offered', () => {
        // Two independent ways a host says no, and both must read as unsupported: the method is
        // missing (older WebKit), or it is present and the document disallows it (an embedded
        // webview). A control rendered disabled would read as a bug in the game; an absent one
        // reads as a feature the host does not offer, which is the true statement.
        const doc = document as unknown as Record<string, unknown>;
        const de = document.documentElement as unknown as Record<string, unknown>;
        const req = de.requestFullscreen;
        de.requestFullscreen = undefined;
        expect(fullscreenSupported()).toBe(false);
        de.requestFullscreen = req;

        restores.push(fakeApi({ enabled: false }));
        expect(doc.fullscreenEnabled).toBe(false);
        expect(fullscreenSupported()).toBe(false);
    });

    it('enters and leaves, and reads its state back off the DOCUMENT', () => {
        restores.push(fakeApi());
        const probe = mount();
        restores.push(probe.unmount);

        expect(probe.current().supported).toBe(true);
        expect(probe.current().isFullscreen).toBe(false);

        act(() => { probe.current().toggle(); });
        expect(probe.current().isFullscreen).toBe(true);

        act(() => { probe.current().toggle(); });
        expect(probe.current().isFullscreen).toBe(false);
    });

    it('follows a fullscreen exit the hook never asked for — Escape, F11, the window manager', () => {
        /*
         * THE CASE A REMEMBERED BOOLEAN GETS WRONG, and the reason the hook derives its state.
         *
         * A player can leave fullscreen without touching this control. A hook that set a flag when
         * it asked would still say "fullscreen" afterwards, and the toggle's label would lie —
         * offering "Leave fullscreen" on a windowed game. Simulated here as the document changing
         * underneath and firing the event, which is exactly what the browser does.
         */
        restores.push(fakeApi());
        const probe = mount();
        restores.push(probe.unmount);

        act(() => { probe.current().toggle(); });
        expect(probe.current().isFullscreen).toBe(true);

        act(() => {
            (document as unknown as Record<string, unknown>).fullscreenElement = null;
            document.dispatchEvent(new Event('fullscreenchange'));
        });
        expect(probe.current().isFullscreen).toBe(false);
    });

    it('swallows a REFUSED request rather than throwing — iOS rejects outside a gesture', () => {
        // The rejection must not surface: an unhandled rejection from a settings click is a console
        // error, and `testing/interaction` fails the whole smoke walk on one of those (ticket 40).
        const rejected = vi.fn(() => Promise.reject(new Error('gesture required')));
        restores.push(fakeApi({ request: rejected }));
        const probe = mount();
        restores.push(probe.unmount);

        expect(() => act(() => { probe.current().toggle(); })).not.toThrow();
        expect(rejected).toHaveBeenCalled();
        expect(probe.current().isFullscreen).toBe(false);
    });
});
