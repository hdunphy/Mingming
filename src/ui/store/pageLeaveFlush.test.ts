// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { flushOnPageLeave } from './pageLeaveFlush';

let unbind: (() => void) | null = null;
afterEach(() => { unbind?.(); unbind = null; });

const setVisibility = (state: 'visible' | 'hidden'): void => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
};

describe('flushOnPageLeave', () => {
    it('flushes when the page is hidden', () => {
        const flush = vi.fn();
        unbind = flushOnPageLeave(flush, window, document);
        setVisibility('hidden');
        document.dispatchEvent(new Event('visibilitychange'));
        expect(flush).toHaveBeenCalledTimes(1);
    });

    it('does not flush when the page becomes visible again', () => {
        const flush = vi.fn();
        unbind = flushOnPageLeave(flush, window, document);
        setVisibility('visible');
        document.dispatchEvent(new Event('visibilitychange'));
        expect(flush).not.toHaveBeenCalled();
    });

    it('flushes on pagehide and beforeunload (the window closing)', () => {
        const flush = vi.fn();
        unbind = flushOnPageLeave(flush, window, document);
        window.dispatchEvent(new Event('pagehide'));
        window.dispatchEvent(new Event('beforeunload'));
        expect(flush).toHaveBeenCalledTimes(2);
    });

    it('stops listening once unbound', () => {
        const flush = vi.fn();
        flushOnPageLeave(flush, window, document)();
        window.dispatchEvent(new Event('pagehide'));
        expect(flush).not.toHaveBeenCalled();
    });
});
