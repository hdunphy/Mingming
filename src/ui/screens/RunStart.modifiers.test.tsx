// @vitest-environment jsdom
/**
 * TICKET 169f — the modifier row on the party screen, mounted and clicked.
 *
 * Locked until the first gym clear (default D2). Five chips, opt-in, any combination. A chip shows
 * its description on hover, in a portal like the house tooltips. Launching stores each switched-on
 * modifier as `mod:<id>` on the run.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';

import RunStart from './RunStart';
import gameReducer, { createEmptyRanch } from '../store/gameSlice';
import runReducer from '../store/runSlice';
import { MODIFIERS } from '../../engine/run/modifiers/modifierRegistry';
import type { IRanchState } from '../../engine/runTypes';
import { loadSettings, saveSettings } from '../settings/settings';

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const KRAKEN = { id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1', attackIV: 10, defenseIV: 10, hpIV: 10 };

function makeStore(over: Partial<IRanchState> = {}) {
    return configureStore({
        reducer: { game: gameReducer, run: runReducer },
        preloadedState: { game: { ...createEmptyRanch(), roster: [KRAKEN], ...over }, run: { run: null } },
        middleware: (getDefault) => getDefault({ serializableCheck: false }),
    });
}

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => { root.unmount(); });
    host.remove();
    localStorage.clear();
});

// TICKET 182b: the chips (and the party picker, for a one-member roster) are not drawn for a new
// player, so the cases that look at the LOCKED row switch "Show advanced content" on first.
const showAdvanced = (): void => saveSettings({ ...loadSettings(), showAdvancedContent: true });

async function toPartyScreen(store: ReturnType<typeof makeStore>): Promise<void> {
    await act(async () => { root.render(<Provider store={store}><RunStart /></Provider>); });
    await act(async () => { (host.querySelector('.ranch-offer') as HTMLElement).click(); });
}

const chips = (): HTMLButtonElement[] => [...host.querySelectorAll<HTMLButtonElement>('.ranch-modifier-row button')];
const chip = (name: string): HTMLButtonElement => {
    const found = chips().find((c) => c.textContent?.includes(name));
    if (!found) throw new Error(`no chip named ${name}`);
    return found;
};
async function click(el: Element): Promise<void> {
    await act(async () => { (el as HTMLElement).click(); });
}

describe('the modifier row', () => {
    it('is locked on a fresh ranch: every chip disabled, with the unlock line', async () => {
        showAdvanced();
        await toPartyScreen(makeStore());
        expect(chips()).toHaveLength(MODIFIERS.length);
        for (const c of chips()) expect(c.disabled).toBe(true);
        expect(host.textContent).toContain('Beat a gym to unlock modifiers.');
    });

    it('is open after one gym clear: five enabled chips, none switched on, no unlock line', async () => {
        await toPartyScreen(makeStore({ gymsCleared: ['gym_emberfall'] }));
        expect(chips().map((c) => c.textContent?.trim())).toEqual(MODIFIERS.map((m) => m.name));
        for (const c of chips()) {
            expect(c.disabled).toBe(false);
            expect(c.getAttribute('aria-pressed')).toBe('false');
        }
        expect(host.textContent).not.toContain('Beat a gym to unlock modifiers.');
    });

    it('a chip toggles on and off', async () => {
        await toPartyScreen(makeStore({ gymsCleared: ['gym_emberfall'] }));
        await click(chip('Junk Start'));
        expect(chip('Junk Start').getAttribute('aria-pressed')).toBe('true');
        await click(chip('Junk Start'));
        expect(chip('Junk Start').getAttribute('aria-pressed')).toBe('false');
    });

    it('shows the description in a portal on hover, and removes it on leave', async () => {
        await toPartyScreen(makeStore({ gymsCleared: ['gym_emberfall'] }));
        await act(async () => {
            chip('Elite Hunt').dispatchEvent(new MouseEvent('mouseover', { bubbles: true, relatedTarget: document.body }));
        });
        const tip = document.body.querySelector('.os-tooltip-portal');
        expect(tip?.textContent).toContain('Every rival is an elite.');
        // Drawn into <body>, outside the screen's own container.
        expect(host.contains(tip)).toBe(false);
        await act(async () => {
            chip('Elite Hunt').dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }));
        });
        expect(document.body.querySelector('.os-tooltip-portal')).toBeNull();
    });
});

describe('launching with modifiers', () => {
    async function launch(): Promise<void> {
        // TICKET 182b: one Mingming on the roster is the party - there is no picker to click
        // (unless Show advanced content has drawn it).
        const picker = host.querySelector('.ranch-roster-grid button');
        if (picker) await click(picker);
        await click([...host.querySelectorAll('button')].find((b) => b.textContent?.includes('Start run'))!);
    }

    it('stores each switched-on modifier as mod:<id> on the run', async () => {
        const store = makeStore({ gymsCleared: ['gym_emberfall'] });
        await toPartyScreen(store);
        await click(chip('Junk Start'));
        await click(chip('Elite Hunt'));
        await launch();
        expect(store.getState().run.run?.modifiers).toEqual(expect.arrayContaining(['mod:junk_start', 'mod:elite_hunt']));
        expect(store.getState().run.run?.modifiers).toHaveLength(2);
    });

    it('launches with none when none is switched on', async () => {
        const store = makeStore({ gymsCleared: ['gym_emberfall'] });
        await toPartyScreen(store);
        await launch();
        expect(store.getState().run.run?.modifiers).toEqual([]);
    });

    it('a locked ranch launches with none, whatever was clicked', async () => {
        showAdvanced();
        const store = makeStore();
        await toPartyScreen(store);
        await click(chip('Junk Start'));
        await launch();
        expect(store.getState().run.run?.modifiers).toEqual([]);
    });
});
