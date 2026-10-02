// @vitest-environment jsdom
/**
 * TICKET 182a (R5) — "Abandon run" lives in Settings, and only while a run is in progress.
 *
 * It used to sit at the top right of the map. The map now carries a small Settings button instead,
 * and Settings carries the existing two-step abandon: a stray click on a screen opened to change the
 * volume must not end forty minutes of play.
 */

import { describe, expect, it } from 'vitest';

import RunScreen from './RunScreen';
import SettingsScreen from './SettingsScreen';
import { createRun } from '../../engine/run/createRun';
import { offerGyms } from '../../engine/run/gyms';
import type { IRunState } from '../../engine/runTypes';
import type { IMingmingState } from '../../engine/types';
import { addToRoster } from '../store/gameSlice';
import { openSettings } from '../store/uiSlice';
import { createRanchMember } from '../../engine/gameTypes';
import { startRun } from '../store/runSlice';
import { click, clickText, findText, makeStore, mount } from '../../testing/interaction';

const MEMBER: IMingmingState = {
    id: 'mm1',
    definitionId: 'kraken',
    activeOS: 'kraken_v1',
    blueprintsCollected: 0,
    attackIV: 10,
    defenseIV: 10,
    hpIV: 10,
};

function aRun(over: Partial<IRunState> = {}): IRunState {
    return {
        ...createRun({ seed: 'abandon-seed', offer: offerGyms('offer-seed')[0], party: [MEMBER], startedAt: 1 }),
        ...over,
    };
}

function storeWith(run: IRunState | null) {
    const store = makeStore();
    store.dispatch(addToRoster({ ...createRanchMember('kraken', 'kraken_v1'), id: 'mm1' }));
    if (run) store.dispatch(startRun(run));
    return store;
}

describe('Settings → Abandon run (182a)', () => {
    it('is not there when no run is in progress', async () => {
        const host = await mount(storeWith(null), <SettingsScreen />);
        expect(host.textContent).not.toContain('Abandon run');
    });

    it('is not there once the run has ended', async () => {
        const host = await mount(storeWith(aRun({ phase: 'ended', outcome: 'defeat' })), <SettingsScreen />);
        expect(host.textContent).not.toContain('Abandon run');
    });

    it('is a two-step: first the button, then the confirm, and "Keep going" backs out', async () => {
        const store = storeWith(aRun());
        const host = await mount(store, <SettingsScreen />);
        expect(host.textContent).toContain('Abandon run');
        expect(host.textContent).not.toContain('the run is lost');

        await clickText(host, 'Abandon run');
        expect(host.textContent).toContain('the run is lost');
        expect(store.getState().run.run?.phase).not.toBe('ended');

        await clickText(host, 'Keep going');
        expect(host.textContent).not.toContain('the run is lost');
        expect(store.getState().run.run?.phase).not.toBe('ended');
    });

    it('confirming ends the run as abandoned and closes Settings', async () => {
        const store = storeWith(aRun());
        store.dispatch(openSettings());
        const host = await mount(store, <SettingsScreen />);
        await clickText(host, 'Abandon run');
        await click(findText(host, 'the run is lost'));
        expect(store.getState().run.run?.phase).toBe('ended');
        expect(store.getState().run.run?.outcome).toBe('abandoned');
        expect(store.getState().ui.settingsOpen).toBe(false);
    });
});

describe('the map (182a)', () => {
    it('no longer carries "Abandon run"; it carries a Settings button that opens Settings', async () => {
        const store = storeWith(aRun());
        const host = await mount(store, <RunScreen />);
        expect(host.textContent).not.toContain('Abandon run');
        const gear = host.querySelector<HTMLElement>('button[aria-label="Settings"]');
        expect(gear).not.toBeNull();
        await click(gear!);
        expect(store.getState().ui.settingsOpen).toBe(true);
    });

    it('nor does the gauntlet header', async () => {
        const base = aRun();
        const gym = base.nodes.find((n) => n.kind === 'gym')!;
        const store = storeWith({
            ...base,
            currentNodeId: gym.id,
            phase: 'gauntlet',
            gauntlet: { fightIndex: 0, totalFights: 3, persistedHp: {}, downedMemberIds: [] },
        });
        const host = await mount(store, <RunScreen />);
        expect(host.textContent).not.toContain('Abandon run');
        expect(host.querySelector('button[aria-label="Settings"]')).not.toBeNull();
    });
});
