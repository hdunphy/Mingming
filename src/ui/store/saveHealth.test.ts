/**
 * Ticket 04 (steam-release map), reporting half: a failed autosave has to become visible.
 *
 * `SaveSystem.crashSafe.test.ts` proves nothing bad is ever written; this proves the failure does
 * not then vanish into a console that a packaged desktop build does not have.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getSaveHealth, reportSaveResult, resetSaveHealth, subscribeSaveHealth } from './saveHealth';

beforeEach(() => {
    resetSaveHealth();
});

describe('saveHealth', () => {
    it('starts healthy', () => {
        expect(getSaveHealth().healthy).toBe(true);
        expect(getSaveHealth().failureCount).toBe(0);
        expect(getSaveHealth().lastGoodAt).toBeNull();
    });

    it('goes unhealthy on failure, carrying the kind and message', () => {
        reportSaveResult({ success: false, kind: 'quota', error: 'storage is full' });

        expect(getSaveHealth().healthy).toBe(false);
        expect(getSaveHealth().kind).toBe('quota');
        expect(getSaveHealth().error).toBe('storage is full');
        expect(getSaveHealth().failureCount).toBe(1);
    });

    it('counts consecutive failures', () => {
        reportSaveResult({ success: false, kind: 'quota' });
        reportSaveResult({ success: false, kind: 'quota' });
        reportSaveResult({ success: false, kind: 'storage' });

        expect(getSaveHealth().failureCount).toBe(3);
        expect(getSaveHealth().kind).toBe('storage');
    });

    it('recovers on the next successful write and clears the failure detail', () => {
        reportSaveResult({ success: false, kind: 'validation', error: '[scrapCount] too small' });
        expect(getSaveHealth().healthy).toBe(false);

        reportSaveResult({ success: true });

        expect(getSaveHealth().healthy).toBe(true);
        expect(getSaveHealth().failureCount).toBe(0);
        expect(getSaveHealth().kind).toBeUndefined();
        expect(getSaveHealth().error).toBeUndefined();
        expect(getSaveHealth().lastGoodAt).not.toBeNull();
    });

    it('keeps a stable snapshot reference across repeated successes', () => {
        // `useSyncExternalStore` re-renders whenever the snapshot's identity changes, and autosave
        // fires on every game-state change — a fresh object per save would spin the banner.
        reportSaveResult({ success: true });
        const first = getSaveHealth();
        reportSaveResult({ success: true });
        reportSaveResult({ success: true });
        expect(getSaveHealth()).toBe(first);
    });

    it('notifies subscribers on change and stops after unsubscribe', () => {
        const listener = vi.fn();
        const unsubscribe = subscribeSaveHealth(listener);

        reportSaveResult({ success: false, kind: 'quota' });
        expect(listener).toHaveBeenCalledTimes(1);

        reportSaveResult({ success: true });
        expect(listener).toHaveBeenCalledTimes(2);

        unsubscribe();
        reportSaveResult({ success: false, kind: 'storage' });
        expect(listener).toHaveBeenCalledTimes(2);
    });

    it('a throwing listener cannot break the autosave path that called it', () => {
        const healthy = vi.fn();
        subscribeSaveHealth(() => {
            throw new Error('listener exploded');
        });
        subscribeSaveHealth(healthy);

        expect(() => reportSaveResult({ success: false, kind: 'quota' })).not.toThrow();
        expect(healthy).toHaveBeenCalledTimes(1);
        expect(getSaveHealth().healthy).toBe(false);
    });

    it('a listener that unsubscribes itself does not make its neighbour miss the event', () => {
        const second = vi.fn();
        const stopFirst = subscribeSaveHealth(() => stopFirst());
        subscribeSaveHealth(second);

        reportSaveResult({ success: false, kind: 'quota' });

        expect(second).toHaveBeenCalledTimes(1);
    });
});
