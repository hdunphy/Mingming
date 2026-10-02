/**
 * TICKET 37 — the fullscreen toggle, and why it needs no desktop bridge.
 *
 * The ticket asks for *"fullscreen toggle via the wrapper (ticket 42) with a browser fallback"*, and
 * the measurement is that the fallback IS the implementation: Electron's renderer is Chromium, so
 * `Element.requestFullscreen` works identically in the packaged app and in a browser tab. A bridge
 * member would be a second code path to keep true for no behavioural difference — and
 * `IDesktopBridge` is deliberately small, because every member is one more thing a player running
 * yesterday's desktop app against today's renderer can be missing.
 *
 * So there is one path. What differs between the two hosts is only what the OS does around the
 * window, which is not this hook's business.
 *
 * # WHY THE STATE IS READ FROM THE DOCUMENT, NOT REMEMBERED
 *
 * `isFullscreen` is derived from `document.fullscreenElement` on every `fullscreenchange`, never
 * stored as a boolean this hook sets when it asks. **The user can leave fullscreen without asking
 * this hook** — Escape, F11, the window manager — and a remembered flag would then be wrong, which
 * shows up as a toggle whose label lies. The event is the source of truth; the request is only a
 * request.
 *
 * # FEATURE DETECTION, BECAUSE THIS IS ALSO THE STEAM DECK'S BROWSER
 *
 * `requestFullscreen` can be absent (older WebKit) or present and REFUSED — iOS Safari rejects it
 * outside a user gesture, and an embedded webview can disallow it entirely. Both are handled the
 * same way: `supported` gates whether the control is offered at all, and a rejected promise is
 * swallowed rather than thrown, because a failed fullscreen request is not an error the player can
 * act on and an unhandled rejection in a settings screen is worse than no fullscreen.
 */
import { useCallback, useEffect, useState } from 'react';

/** Is the Fullscreen API usable in this host at all? Evaluated per call, not captured at import. */
export function fullscreenSupported(): boolean {
    return typeof document !== 'undefined'
        && typeof document.documentElement?.requestFullscreen === 'function'
        && document.fullscreenEnabled !== false;
}

export interface FullscreenControl {
    /** Whether the document is fullscreen RIGHT NOW, read from the document on every change. */
    readonly isFullscreen: boolean;
    /** False when the host has no usable Fullscreen API — the caller should offer no control. */
    readonly supported: boolean;
    /** Enter if out, leave if in. Safe to call when unsupported: it does nothing. */
    readonly toggle: () => void;
}

export function useFullscreen(): FullscreenControl {
    const supported = fullscreenSupported();
    const [isFullscreen, setIsFullscreen] = useState(
        () => typeof document !== 'undefined' && document.fullscreenElement !== null,
    );

    useEffect(() => {
        if (typeof document === 'undefined') return;
        const sync = () => setIsFullscreen(document.fullscreenElement !== null);
        document.addEventListener('fullscreenchange', sync);
        // Synced once on mount as well: the document can already BE fullscreen when this mounts,
        // if the player toggled it with F11 on a screen that did not carry this control.
        sync();
        return () => document.removeEventListener('fullscreenchange', sync);
    }, []);

    const toggle = useCallback(() => {
        if (!fullscreenSupported()) return;
        // `void` on both: a refusal is not actionable by the player, and an unhandled rejection
        // from a settings click is a console error in a build that gates on console errors.
        if (document.fullscreenElement === null) void document.documentElement.requestFullscreen().catch(() => {});
        else void document.exitFullscreen().catch(() => {});
    }, []);

    return { isFullscreen, supported, toggle };
}
