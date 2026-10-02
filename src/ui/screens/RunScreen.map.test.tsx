// @vitest-environment jsdom
/**
 * TICKET 182a — the map screen, cut to a header, the map, and a row of party faces.
 *
 * Header: the biome's name, and scrap with an icon, nothing else (the tier shows only when the run
 * is on a tier above 0 or has modifiers: it is then a choice the player made). No tab strip, no
 * legend, no "You are here" sentence, no bullet lines. The Travel list is for screen readers. The
 * party is a row of faces in the corner, always visible, without HP, and the screen has no section
 * below the fold.
 */

import { configureStore } from '@reduxjs/toolkit';
import { describe, expect, it } from 'vitest';
import { Provider } from 'react-redux';
import { renderToStaticMarkup } from 'react-dom/server';

import RunScreen from './RunScreen';
import battleReducer from '../store/battleSlice';
import gameReducer, { createEmptyRanch } from '../store/gameSlice';
import runReducer from '../store/runSlice';
import { createRun } from '../../engine/run/createRun';
import { offerGyms } from '../../engine/run/gyms';
import { ALL_TIP_IDS } from '../../engine/tips';
import type { IRanchMember, IRunState } from '../../engine/runTypes';
import type { IMingmingState } from '../../engine/types';
import { budgetProblem, readCopy } from '../copyBudget/copyBudget';

const MEMBER: IMingmingState = {
    id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1', blueprintsCollected: 0,
    attackIV: 10, defenseIV: 10, hpIV: 10,
};
const ROSTER: IRanchMember[] = [{
    id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1', attackIV: 10, defenseIV: 10, hpIV: 10,
}];
const RUN = createRun({
    seed: 'map-cut-seed', offer: offerGyms('offer-seed')[0], party: [MEMBER], startedAt: 1_700_000_000_000,
});

function dom(run: IRunState = RUN): HTMLElement {
    const store = configureStore({
        reducer: { battle: battleReducer, game: gameReducer, run: runReducer },
        preloadedState: {
            game: { ...createEmptyRanch(), roster: ROSTER, seenTips: [...ALL_TIP_IDS] },
            run: { run },
        },
        middleware: (getDefault) => getDefault({ serializableCheck: false }),
    });
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(<Provider store={store}><RunScreen /></Provider>);
    return host;
}

describe('the map screen (182a)', () => {
    it('opens with a header of the biome name and scrap with an icon, nothing else', () => {
        const meta = dom().querySelector('.ranch-run-meta')!;
        expect(meta.textContent).toContain(RUN.biomes[0].name);
        expect(meta.querySelector('.run-scrap svg')).not.toBeNull();
        expect(meta.querySelector('.run-scrap')?.textContent?.trim()).toBe(String(RUN.scrap));
        expect(meta.textContent).not.toMatch(/Biome \d\/3|layer|fights|Tier|scrap/i);
    });

    it('shows the tier only when the player chose one above 0, or modifiers', () => {
        expect(dom({ ...RUN, tier: 2 }).querySelector('.ranch-run-meta')?.textContent).toContain('Tier 2');
        expect(dom({ ...RUN, tier: 0, modifiers: ['mod:elite_hunt'] }).querySelector('.ranch-run-meta')?.textContent)
            .toContain('1 modifier');
    });

    it('has no tab strip, no legend, no "You are here" and no bullet lines', () => {
        const host = dom();
        expect(host.querySelector('.rm-biome-strip')).toBeNull();
        expect(host.querySelector('.rm-legend-key')).toBeNull();
        expect(host.querySelector('.rm-legend-rival')).toBeNull();
        expect(host.querySelector('.rm-legend-fog')).toBeNull();
        expect(host.textContent).not.toContain('You are here');
        expect(host.textContent).not.toContain('fogged nodes show their shape');
        expect(host.textContent).not.toContain('a rival fields the two elements');
    });

    it('labels each biome band with its name only', () => {
        const labels = [...dom().querySelectorAll('.rm-band-label')].map((n) => n.textContent);
        expect(labels).toEqual(RUN.biomes.map((b) => b.name));
    });

    it('keeps the Travel list for screen readers: in the DOM, visually hidden, reachable', () => {
        const nav = dom().querySelector('nav.rm-travel')!;
        expect(nav.classList.contains('sr-only')).toBe(true);
        expect(nav.querySelectorAll('button').length).toBeGreaterThan(0);
    });

    it('shows the party as a row of faces, without HP, and no Party section below the map', () => {
        const host = dom();
        const faces = host.querySelectorAll('.run-party-faces .run-party-face');
        expect(faces).toHaveLength(RUN.partyIds.length);
        expect(faces[0].getAttribute('title')).toContain('Kraken');
        expect(host.querySelector('.run-party-faces')?.textContent).not.toMatch(/HP|\d+\/\d+/);
        expect(host.textContent).not.toContain('Run deck');
        expect(host.textContent).not.toMatch(/Seed\s/);
        expect([...host.querySelectorAll('h2')].map((h) => h.textContent)).not.toContain('Party');
    });

    it('is inside the copy budget', () => {
        expect(budgetProblem(readCopy(dom().innerHTML))).toBeNull();
    });
});
