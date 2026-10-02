// @vitest-environment jsdom
/**
 * TICKET 182d — THE INTRO, THROUGH THE REAL APP.
 *
 * A fresh save, a starter pick with "Skip intro" off, and the whole way out: the intro run starts
 * (no ranch visit), its summary claims no gym, and leaving it lands on the ranch with the intro
 * done and nothing the ladder counts moved. The other half - "Skip intro" ticked goes the old way -
 * is `App.loop.test.tsx`, which ticks it for every test there.
 */
import { describe, expect, it, vi } from 'vitest';
import { act } from 'react';

import { makeStore, mountApp, click, clickText, findText, flush } from './testing/interaction';
import { endRunAction } from './ui/store/runSlice';

vi.mock('./engine/core/SeedStream', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./engine/core/SeedStream')>()),
    rollSeed: () => 'ticket-182-app-intro',
}));

const card = (host: HTMLElement, id: string): HTMLElement => host.querySelector<HTMLElement>(`[data-testid="starter-${id}"]`)!;

describe('182d the intro through the app', () => {
    it('a new save: starter pick -> intro run on the map, the starter on the roster, no ranch visit', async () => {
        const store = makeStore();
        const host = await mountApp(store);
        expect(store.getState().game.introDone).toBe(false);

        await click(card(host, 'fenrir'));

        const state = store.getState();
        expect(state.run.run?.mode).toBe('intro');
        expect(state.run.run?.phase).not.toBe('ended');
        expect(state.game.roster.map((m) => m.definitionId)).toEqual(['fenrir']);
        expect(state.game.roster[0].activeOS).toBe('fenrir_v1');
        expect(state.game.blueprints.fenrir ?? 0).toBe(0);
        expect(host.textContent).not.toContain('Choose your starter');
        expect(host.textContent).not.toContain('Assembly bay');
    });

    it('winning it: no gym claimed, Back to ranch -> introDone, and the run counters do not move', async () => {
        const store = makeStore();
        const host = await mountApp(store);
        await click(card(host, 'kraken'));
        const run = store.getState().run.run!;

        await act(async () => { store.dispatch(endRunAction(run, 'victory')); });
        await flush();

        expect(host.textContent).toContain('Intro complete');
        expect(host.textContent).not.toContain('Gym cleared');
        expect(host.textContent).not.toMatch(/tier \d+ unlocked/);

        await clickText(host, 'Back to ranch');
        await flush();

        const game = store.getState().game;
        expect(store.getState().run.run).toBeNull();
        expect(game.introDone).toBe(true);
        expect(game.runsCompleted ?? 0).toBe(0);
        expect(game.gymsCleared).toEqual([]);
    });

    it('losing it ends the same way (the intro is not a failure the ranch remembers)', async () => {
        const store = makeStore();
        const host = await mountApp(store);
        await click(card(host, 'ratatoskr'));
        await act(async () => { store.dispatch(endRunAction(store.getState().run.run!, 'defeat')); });
        await flush();

        expect(host.textContent).not.toContain('Gym cleared');
        await clickText(host, 'Back to ranch');
        await flush();

        expect(store.getState().game.introDone).toBe(true);
        expect(store.getState().game.runsCompleted ?? 0).toBe(0);
    });

    it('with Skip intro ticked, the pick is the old path: Trace, then the ranch', async () => {
        const store = makeStore();
        const host = await mountApp(store);
        await click(findText(host, 'Skip intro', 'label').querySelector('input')!);
        await click(card(host, 'kraken'));

        expect(store.getState().run.run).toBeNull();
        expect(store.getState().game.blueprints.kraken).toBe(1);
        expect(host.textContent).toContain('Summon bay');
    });
});
