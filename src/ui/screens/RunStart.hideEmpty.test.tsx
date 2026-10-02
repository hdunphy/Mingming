// @vitest-environment jsdom
/**
 * TICKET 182b — run start hides what a new player has nothing to do with.
 *
 * The tier row and the modifier chips stay out of sight until a gym has been cleared (nothing above
 * tier 0 is unlocked, and the modifiers unlock together with it). The party picker stays out of
 * sight while the roster is one Mingming: that Mingming is the party. "Show advanced content" draws
 * all of them anyway.
 */
import { afterEach, describe, expect, it } from 'vitest';

import RanchScreen from './RanchScreen';
import { createRanchMember } from '../../engine/gameTypes';
import { addToRoster, markGymCleared } from '../store/gameSlice';
import { loadSettings, saveSettings } from '../settings/settings';
import { click, findText, makeStore, mount } from '../../testing/interaction';

afterEach(() => localStorage.clear());

async function expedition(opts: { members?: Array<[string, string]>; cleared?: boolean; advanced?: boolean } = {}) {
    const store = makeStore();
    for (const [species, os] of opts.members ?? [['kraken', 'kraken_v1']]) store.dispatch(addToRoster(createRanchMember(species, os)));
    if (opts.cleared) store.dispatch(markGymCleared('gym_rootfall'));
    if (opts.advanced) saveSettings({ ...loadSettings(), showAdvancedContent: true });
    const host = await mount(store, <RanchScreen initialSection="expedition" />, { keepStorage: true });
    return { store, host };
}

describe('182b - the tier row', () => {
    it('is not drawn while no tier above 0 is unlocked', async () => {
        const { host } = await expedition();
        expect(host.querySelector('.ranch-tier-picker')).toBeNull();
        expect(host.textContent).not.toMatch(/Tier \d|to unlock/);
    });
    it('is drawn once a gym has been cleared (tier 1 opens)', async () => {
        const { host } = await expedition({ cleared: true });
        expect(host.querySelector('.ranch-tier-picker')).not.toBeNull();
        expect(host.textContent).toContain('Tier 1');
    });
    it('is drawn with Show advanced content on, locked tiers and all', async () => {
        const { host } = await expedition({ advanced: true });
        expect(host.querySelector('.ranch-tier-picker')).not.toBeNull();
        expect(host.textContent).toContain('Beat any gym on Tier 0 to unlock.');
    });
});

describe('182b - the modifier chips', () => {
    it('are not drawn before the first gym clear', async () => {
        const { host } = await expedition({ members: [['kraken', 'kraken_v1'], ['fenrir', 'fenrir_v1']] });
        await click(host.querySelector('.ranch-offer')!);
        expect(host.querySelector('.ranch-modifier-row')).toBeNull();
        expect(host.textContent).not.toContain('Modifiers');
    });
    it('are drawn after a gym has been cleared', async () => {
        const { host } = await expedition({ cleared: true });
        await click(host.querySelector('.ranch-offer')!);
        expect(host.querySelector('.ranch-modifier-row')).not.toBeNull();
    });
    it('are drawn (locked) with Show advanced content on', async () => {
        const { host } = await expedition({ advanced: true });
        await click(host.querySelector('.ranch-offer')!);
        expect(host.querySelector('.ranch-modifier-row')).not.toBeNull();
        expect(host.textContent).toContain('Beat a gym to unlock modifiers.');
    });
});

describe('182b - the party picker', () => {
    it('is not drawn while the roster is one Mingming, and that Mingming is the party', async () => {
        const { store, host } = await expedition();
        await click(host.querySelector('.ranch-offer')!);
        expect(host.querySelector('.ranch-roster-grid')).toBeNull();
        const start = findText(host, 'Start run');
        expect((start as HTMLButtonElement).disabled).toBe(false);
        await click(start);
        expect(store.getState().run.run?.partyIds).toHaveLength(1);
    });
    it('is drawn when the roster holds two', async () => {
        const { host } = await expedition({ members: [['kraken', 'kraken_v1'], ['fenrir', 'fenrir_v1']] });
        await click(host.querySelector('.ranch-offer')!);
        expect(host.querySelectorAll('.ranch-roster-grid button')).toHaveLength(2);
    });
    it('is drawn for one Mingming with Show advanced content on', async () => {
        const { host } = await expedition({ advanced: true });
        await click(host.querySelector('.ranch-offer')!);
        expect(host.querySelectorAll('.ranch-roster-grid button')).toHaveLength(1);
    });
});
