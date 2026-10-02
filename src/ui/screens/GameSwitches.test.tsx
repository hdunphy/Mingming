// @vitest-environment jsdom
/**
 * TICKET 182d — the two switches in Settings.
 *
 * "Skip intro" is shown only while this save has not done the intro, and turning it on marks the
 * intro done. "Show advanced content" is always shown and is stored with the person's settings.
 * Each works without the other.
 */
import { describe, expect, it } from 'vitest';

import SettingsScreen from './SettingsScreen';
import { makeStore, mount, click, flush } from '../../testing/interaction';
import { loadSettings } from '../settings/settings';
import { setIntroDone } from '../store/gameSlice';
import {
    SHOW_ADVANCED_HOVER, SHOW_ADVANCED_LABEL, SKIP_INTRO_HOVER, SKIP_INTRO_LABEL,
} from '../settings/switches';

const row = (host: HTMLElement, label: string): HTMLElement | undefined =>
    [...host.querySelectorAll<HTMLElement>('.settings-row')].find((el) => el.querySelector('.settings-label')?.textContent === label);

const button = (rowEl: HTMLElement, text: string): HTMLButtonElement =>
    [...rowEl.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === text)!;

describe('182d Settings → Skip intro', () => {
    it('is shown while the intro has not been done, with its exact label and hover', async () => {
        const store = makeStore();
        const host = await mount(store, <SettingsScreen />);
        const skip = row(host, SKIP_INTRO_LABEL);
        expect(skip).toBeDefined();
        expect(skip!.getAttribute('title')).toBe(SKIP_INTRO_HOVER);
        expect(button(skip!, 'Off').getAttribute('aria-pressed')).toBe('true');
    });

    it('is not shown once the intro is done', async () => {
        const store = makeStore();
        store.dispatch(setIntroDone(true));
        const host = await mount(store, <SettingsScreen />);
        expect(row(host, SKIP_INTRO_LABEL)).toBeUndefined();
    });

    it('turning it on marks the intro done, and the row goes away', async () => {
        const store = makeStore();
        const host = await mount(store, <SettingsScreen />);
        await click(button(row(host, SKIP_INTRO_LABEL)!, 'On'));
        await flush();
        expect(store.getState().game.introDone).toBe(true);
        expect(row(host, SKIP_INTRO_LABEL)).toBeUndefined();
    });

    it('does not touch Show advanced content', async () => {
        const store = makeStore();
        const host = await mount(store, <SettingsScreen />);
        await click(button(row(host, SKIP_INTRO_LABEL)!, 'On'));
        expect(loadSettings().showAdvancedContent).toBe(false);
    });
});

describe('182d Settings → Show advanced content', () => {
    it('is always shown, with its exact label and hover, and starts off', async () => {
        const store = makeStore();
        store.dispatch(setIntroDone(true));
        const host = await mount(store, <SettingsScreen />);
        const advanced = row(host, SHOW_ADVANCED_LABEL);
        expect(advanced).toBeDefined();
        expect(advanced!.getAttribute('title')).toBe(SHOW_ADVANCED_HOVER);
        expect(button(advanced!, 'Off').getAttribute('aria-pressed')).toBe('true');
    });

    it('turning it on is stored with the person\'s settings and does not skip the intro', async () => {
        const store = makeStore();
        const host = await mount(store, <SettingsScreen />);
        await click(button(row(host, SHOW_ADVANCED_LABEL)!, 'On'));
        expect(loadSettings().showAdvancedContent).toBe(true);
        expect(store.getState().game.introDone).toBe(false);
        expect(row(host, SKIP_INTRO_LABEL)).toBeDefined();
        expect(button(row(host, SHOW_ADVANCED_LABEL)!, 'On').getAttribute('aria-pressed')).toBe('true');
    });

    it('turns back off', async () => {
        const store = makeStore();
        const host = await mount(store, <SettingsScreen />);
        await click(button(row(host, SHOW_ADVANCED_LABEL)!, 'On'));
        await click(button(row(host, SHOW_ADVANCED_LABEL)!, 'Off'));
        expect(loadSettings().showAdvancedContent).toBe(false);
    });

    it('both on together, neither on: each is independent', async () => {
        const store = makeStore();
        const host = await mount(store, <SettingsScreen />);
        expect(store.getState().game.introDone).toBe(false);
        expect(loadSettings().showAdvancedContent).toBe(false);
        await click(button(row(host, SKIP_INTRO_LABEL)!, 'On'));
        await click(button(row(host, SHOW_ADVANCED_LABEL)!, 'On'));
        expect(store.getState().game.introDone).toBe(true);
        expect(loadSettings().showAdvancedContent).toBe(true);
    });
});
