// @vitest-environment jsdom
/**
 * TICKET 182b — THE ONE HOOK EVERY HIDE-WHEN-EMPTY RULE READS.
 *
 * "Show advanced content" (182d) is a setting about the person, stored in `mingming_settings`. A
 * component never reads it directly: it asks `useAdvancedContent()`, so there is exactly one place
 * that knows where the switch lives.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

import { useAdvancedContent } from './useAdvancedContent';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from './settings';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function Probe() {
    return <span data-testid="probe">{String(useAdvancedContent())}</span>;
}

async function mountProbe() {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => { root.render(<Probe />); });
    return { host, unmount: async () => { await act(async () => { root.unmount(); }); host.remove(); } };
}

afterEach(() => localStorage.clear());

describe('182b - useAdvancedContent', () => {
    it('is off by default, and the stored default says so', async () => {
        expect(DEFAULT_SETTINGS.showAdvancedContent).toBe(false);
        const { host, unmount } = await mountProbe();
        expect(host.textContent).toBe('false');
        await unmount();
    });

    it('is on when the person has switched it on', async () => {
        saveSettings({ ...loadSettings(), showAdvancedContent: true });
        const { host, unmount } = await mountProbe();
        expect(host.textContent).toBe('true');
        await unmount();
    });

    it('follows the switch while mounted (Settings changes it under a live screen)', async () => {
        const { host, unmount } = await mountProbe();
        expect(host.textContent).toBe('false');
        await act(async () => { saveSettings({ ...loadSettings(), showAdvancedContent: true }); });
        expect(host.textContent).toBe('true');
        await act(async () => { saveSettings({ ...loadSettings(), showAdvancedContent: false }); });
        expect(host.textContent).toBe('false');
        await unmount();
    });

    it('an older settings blob without the field parses to off', () => {
        localStorage.setItem('mingming_settings', JSON.stringify({ textScale: 1.15 }));
        expect(loadSettings().showAdvancedContent).toBe(false);
        expect(loadSettings().textScale).toBe(1.15);
    });
});
