// @vitest-environment jsdom
/**
 * TICKET 182d — the two switches on the starter screen of a new save, and what a starter pick does
 * with each of them (and with both, and with neither).
 *
 * "Skip intro" is about THIS save (it is the ranch's `introDone`); "Show advanced content" is about
 * the person (it is in `mingming_settings`). Neither implies the other.
 */
import { describe, expect, it } from 'vitest';

import MainMenuView from './MainMenuView';
import { makeStore, mount, click, findText, flush, type TestStore } from '../../testing/interaction';
import { loadSettings } from '../settings/settings';
import {
    SHOW_ADVANCED_HOVER, SHOW_ADVANCED_LABEL, SKIP_INTRO_HOVER, SKIP_INTRO_LABEL,
} from '../settings/switches';

const switchFor = (host: HTMLElement, label: string): HTMLInputElement => {
    const row = findText(host, label, 'label');
    return row.querySelector('input[type="checkbox"]') as HTMLInputElement;
};
const card = (host: HTMLElement, id: string): HTMLElement => host.querySelector<HTMLElement>(`[data-testid="starter-${id}"]`)!;

async function screen(): Promise<{ store: TestStore; host: HTMLElement }> {
    const store = makeStore();
    const host = await mount(store, <MainMenuView />);
    return { store, host };
}

describe('182d the switches on the starter screen', () => {
    it('are two one-line switches with Henry\'s labels and hovers, under the starters', async () => {
        const { host } = await screen();
        const skip = findText(host, SKIP_INTRO_LABEL, 'label');
        const advanced = findText(host, SHOW_ADVANCED_LABEL, 'label');
        expect(skip.getAttribute('title')).toBe(SKIP_INTRO_HOVER);
        expect(advanced.getAttribute('title')).toBe(SHOW_ADVANCED_HOVER);
        expect(SKIP_INTRO_LABEL).toBe('Skip intro');
        expect(SHOW_ADVANCED_LABEL).toBe('Show advanced content');
        expect(SKIP_INTRO_HOVER).toBe('Go straight to the full game.');
        expect(SHOW_ADVANCED_HOVER).toBe('Show every panel, even when it is empty.');
        // Under the three starters in the page, not above them.
        const cards = host.querySelector('[data-testid="starter-ratatoskr"]')!;
        expect(cards.compareDocumentPosition(skip) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        // They are not paragraphs: the screen's one sentence is still the one line under the title.
        expect(skip.tagName).toBe('LABEL');
        expect(host.querySelectorAll('p')).toHaveLength(1);
    });

    it('start off on a new save', async () => {
        const { host, store } = await screen();
        expect(switchFor(host, SKIP_INTRO_LABEL).checked).toBe(false);
        expect(switchFor(host, SHOW_ADVANCED_LABEL).checked).toBe(false);
        expect(store.getState().game.introDone).toBe(false);
        expect(loadSettings().showAdvancedContent).toBe(false);
    });
});

describe('182d a starter pick', () => {
    it('with NEITHER switch starts the intro at once: the starter on v1, no ranch visit, the vault untouched', async () => {
        const { store, host } = await screen();
        await click(card(host, 'kraken'));
        await flush();
        const { game, run } = store.getState();
        expect(run.run?.mode).toBe('intro');
        expect(run.run?.phase).toBe('map');
        expect(run.run?.partyIds).toHaveLength(1);
        expect(game.roster).toHaveLength(1);
        expect(game.roster[0]).toMatchObject({ definitionId: 'kraken', activeOS: 'kraken_v1' });
        expect(game.blueprints).toEqual({});
        expect(game.introDone).toBe(false);
        expect(game.runsCompleted).toBe(0);
    });

    it.each([['fenrir', 'fenrir_v1', 'Nature'], ['ratatoskr', 'ratatoskr_v1', 'Water'], ['kraken', 'kraken_v1', 'Fire']])(
        'a %s pick starts on %s in the %s biome', async (species, os, biome) => {
            const { store, host } = await screen();
            await click(card(host, species));
            expect(store.getState().game.roster[0].activeOS).toBe(os);
            expect(store.getState().run.run?.biomes[0].elements).toEqual([biome]);
        });

    it('with SKIP INTRO on goes the old way: a blueprint, no run, and the intro is done', async () => {
        const { store, host } = await screen();
        await click(switchFor(host, SKIP_INTRO_LABEL));
        expect(store.getState().game.introDone).toBe(true);
        await click(card(host, 'kraken'));
        const { game, run } = store.getState();
        expect(run.run).toBeNull();
        expect(game.blueprints).toEqual({ kraken: 1 });
        expect(game.roster).toHaveLength(0);
        expect(game.introDone).toBe(true);
    });

    it('with SHOW ADVANCED CONTENT on alone still plays the intro', async () => {
        const { store, host } = await screen();
        await click(switchFor(host, SHOW_ADVANCED_LABEL));
        expect(loadSettings().showAdvancedContent).toBe(true);
        expect(store.getState().game.introDone).toBe(false);
        await click(card(host, 'fenrir'));
        expect(store.getState().run.run?.mode).toBe('intro');
    });

    it('with BOTH on skips the intro and shows everything', async () => {
        const { store, host } = await screen();
        await click(switchFor(host, SKIP_INTRO_LABEL));
        await click(switchFor(host, SHOW_ADVANCED_LABEL));
        await click(card(host, 'ratatoskr'));
        expect(store.getState().run.run).toBeNull();
        expect(store.getState().game.blueprints).toEqual({ ratatoskr: 1 });
        expect(loadSettings().showAdvancedContent).toBe(true);
    });

    it('turning SKIP INTRO on and off again plays the intro', async () => {
        const { store, host } = await screen();
        const skip = switchFor(host, SKIP_INTRO_LABEL);
        await click(skip);
        await click(skip);
        expect(store.getState().game.introDone).toBe(false);
        await click(card(host, 'kraken'));
        expect(store.getState().run.run?.mode).toBe('intro');
    });

    it('the switches follow the stores they live in', async () => {
        const store = makeStore();
        const host = await mount(store, <MainMenuView />);
        await click(switchFor(host, SHOW_ADVANCED_LABEL));
        expect(switchFor(host, SHOW_ADVANCED_LABEL).checked).toBe(true);
        await click(switchFor(host, SKIP_INTRO_LABEL));
        expect(switchFor(host, SKIP_INTRO_LABEL).checked).toBe(true);
    });
});
