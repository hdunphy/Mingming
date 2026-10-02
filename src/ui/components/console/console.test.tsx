// @vitest-environment jsdom
/**
 * TICKET 183d — the console's pieces: the pile backs, the End Turn button, the Show tips switch.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { Provider } from 'react-redux';
import { renderToStaticMarkup } from 'react-dom/server';
import { act } from 'react';

import { EndTurnButton } from './EndTurnButton';
import { PileBacks } from './PileBacks';
import Callout from '../Callout';
import GameSwitches from '../../screens/GameSwitches';
import { RANCH_BLUEPRINT_TIP } from '../../../engine/tips';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '../../settings/settings';
import { makeStore, mount, click, flush } from '../../../testing/interaction';
import { readFileSync } from 'node:fs';

afterEach(() => localStorage.clear());

describe('183d — the piles', () => {
    it('draws three navy backs and a count for the draw pile', () => {
        const html = renderToStaticMarkup(<PileBacks kind="draw" count={12} />);
        expect(html.match(/pile-card /g)).toHaveLength(3);
        expect(html).toContain('>12<');
        expect(html).not.toContain('pile-slot');
    });

    it('draws one dashed slot and a count for the discard', () => {
        const html = renderToStaticMarkup(<PileBacks kind="discard" count={3} />);
        expect(html).toContain('pile-slot');
        expect(html).not.toContain('pile-card');
        expect(html).toContain('>3<');
    });

    it('has no gradient, glow or hex literal in its stylesheet', () => {
        const css = readFileSync('src/ui/components/console/console.css', 'utf8');
        expect(css).not.toMatch(/gradient\(/);
        expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
        expect(css).not.toMatch(/blur|0 0 [0-9]+px/);
    });
});

describe('183d — End Turn', () => {
    it('is a slanted display button that says End turn', () => {
        const html = renderToStaticMarkup(<EndTurnButton disabled={false} onPress={() => undefined} nudgeCount={null} />);
        expect(html).toContain('k-slant');
        expect(html).toContain('k-display');
        expect(html).toContain('End turn');
        expect(html).not.toContain('nudge');
    });

    it('flashes and says how many cards could still be played when the nudge is live', () => {
        const html = renderToStaticMarkup(<EndTurnButton disabled={false} onPress={() => undefined} nudgeCount={2} />);
        expect(html).toContain('nudge');
        expect(html).toContain('2 cards can still be played');
    });

    it('is dead outside the player\'s turn', () => {
        const html = renderToStaticMarkup(<EndTurnButton disabled onPress={() => undefined} nudgeCount={null} />);
        expect(html).toContain('disabled');
    });
});

describe('183d — Show tips', () => {
    it('is on by default', () => {
        expect(DEFAULT_SETTINGS.showTips).toBe(true);
        expect(loadSettings().showTips).toBe(true);
    });

    it('draws the toast while on, and nothing while off', () => {
        const withTips = (): string => renderToStaticMarkup(
            <Provider store={makeStore()}><Callout tip={RANCH_BLUEPRINT_TIP} /></Provider>,
        );
        expect(withTips()).toContain(RANCH_BLUEPRINT_TIP.body);
        saveSettings({ ...loadSettings(), showTips: false });
        expect(withTips()).toBe('');
    });

    it('marks no tip seen while off, so turning it back on resumes the lessons', async () => {
        saveSettings({ ...loadSettings(), showTips: false });
        const store = makeStore();
        await mount(store, <Callout tip={RANCH_BLUEPRINT_TIP} />, { keepStorage: true });
        await flush();
        expect(store.getState().game.seenTips).not.toContain(RANCH_BLUEPRINT_TIP.id);
    });

    it('is a switch in Settings that writes the setting', async () => {
        const host = await mount(makeStore(), <GameSwitches />);
        const row = Array.from(host.querySelectorAll('.settings-row')).find((r) => r.textContent?.includes('Show tips'))!;
        expect(row, 'the Show tips row').toBeDefined();
        const off = Array.from(row.querySelectorAll('button')).find((b) => b.textContent === 'Off')!;
        await act(async () => { await click(off); });
        expect(loadSettings().showTips).toBe(false);
    });
});
