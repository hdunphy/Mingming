// @vitest-environment jsdom
/**
 * TICKET 195c — the run's status line says how many Traces are held.
 *
 * Henry (2026-10-05): "just say how many traces are held". No new line at a biome boundary. The number is
 * `tracesHeld(ranch, run)`, the same function the town's Den tile reads, so the header and the tile agree.
 */
import { configureStore } from '@reduxjs/toolkit';
import { describe, expect, it } from 'vitest';
import { Provider } from 'react-redux';
import { renderToStaticMarkup } from 'react-dom/server';

import RunScreen from './RunScreen';
import { TownSquare } from './town/TownSquare';
import battleReducer from '../store/battleSlice';
import gameReducer, { createEmptyRanch, spendBlueprint } from '../store/gameSlice';
import runReducer from '../store/runSlice';
import { createRun } from '../../engine/run/createRun';
import { offerGyms } from '../../engine/run/gyms';
import { ALL_TIP_IDS } from '../../engine/tips';
import type { IRanchMember } from '../../engine/runTypes';
import type { IMingmingState } from '../../engine/types';

const MEMBER: IMingmingState = { id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1', blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10 };
const ROSTER: IRanchMember[] = [{ id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1', attackIV: 10, defenseIV: 10, hpIV: 10 }];
const RUN = createRun({ seed: 'map-cut-seed', offer: offerGyms('offer-seed')[0], party: [MEMBER], startedAt: 1 });

function store(blueprints: Record<string, number>) {
    return configureStore({
        reducer: { battle: battleReducer, game: gameReducer, run: runReducer },
        preloadedState: { game: { ...createEmptyRanch(), roster: ROSTER, blueprints, seenTips: [...ALL_TIP_IDS] }, run: { run: RUN } },
        middleware: (getDefault) => getDefault({ serializableCheck: false }),
    });
}
const header = (s: ReturnType<typeof store>): HTMLElement => {
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(<Provider store={s}><RunScreen /></Provider>);
    return host.querySelector('.ranch-run-meta') as HTMLElement;
};
const traces = (meta: HTMLElement): string | undefined => meta.querySelector('.run-traces')?.textContent?.trim();

describe('195c — the status line', () => {
    it('says 2 with two Traces held, and 1 after a summon spends one', () => {
        const s = store({ fenrir: 1, huldra: 1 });
        expect(traces(header(s))).toBe('Traces 2');
        s.dispatch(spendBlueprint('fenrir'));
        expect(traces(header(s))).toBe('Traces 1');
    });

    it('says 0 with none, rather than saying nothing', () => {
        expect(traces(header(store({})))).toBe('Traces 0');
    });

    it('agrees with the town’s Den tile, which reads the same function', () => {
        const s = store({ fenrir: 2, huldra: 1 });
        const tile = renderToStaticMarkup(<TownSquare run={RUN} node={RUN.nodes[0]} ranch={s.getState().game} onOpen={() => {}} />);
        expect(tile).toContain('3 traces held');
        expect(traces(header(s))).toBe('Traces 3');
    });

    it('keeps the amber and the biome beside it, and adds no new line', () => {
        const meta = header(store({ fenrir: 1 }));
        expect(meta.textContent).toContain(RUN.biomes[0].name);
        expect(meta.querySelector('.run-scrap')?.textContent?.trim()).toBe(String(RUN.scrap));
        expect(meta.children.length).toBeLessThanOrEqual(4);
    });
});
