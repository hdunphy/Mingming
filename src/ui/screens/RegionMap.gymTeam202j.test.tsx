// @vitest-environment jsdom
/**
 * TICKET 202j - the gym shows its team's elements under it on the map.
 *
 * Henry, 2026-10-07: "Maybe the gym has the element icons visible below it on the map so you can see
 * its going to be WWN for example." One element badge per body of the leader's team, in plan order,
 * each with its symbol (so it reads without colour); hovering reads "The leader fields three: two
 * Nature, one Water." Types only, never species.
 *
 * Two layers: the map drawing whatever team it is handed (and the hover), and the run screen handing
 * it the team of the run's own gym, for each of the three gyms.
 */
import { configureStore } from '@reduxjs/toolkit';
import { renderToStaticMarkup } from 'react-dom/server';
import { Provider } from 'react-redux';
import { describe, expect, it } from 'vitest';

import RegionMap from './RegionMap';
import RunScreen from './RunScreen';
import { createRun } from '../../engine/run/createRun';
import { offerGyms } from '../../engine/run/gyms';
import { generateRegionGraph } from '../../engine/run/regionGraph';
import { ALL_TIP_IDS } from '../../engine/tips';
import type { IRanchMember } from '../../engine/runTypes';
import type { IMingmingState } from '../../engine/types';
import { fire, makeStore, mount } from '../../testing/interaction';
import battleReducer from '../store/battleSlice';
import gameReducer, { createEmptyRanch } from '../store/gameSlice';
import runReducer from '../store/runSlice';

const graph = generateRegionGraph('map-render-seed-0');
const gymNode = graph.nodes.find((n) => n.kind === 'gym')!;
const start = graph.nodes.find((n) => n.id === graph.entryNodeId)!;

const GYMS: ReadonlyArray<readonly [string, ReadonlyArray<string>, string]> = [
    ['gym_rootfall', ['Nature', 'Nature', 'Water'], 'The leader fields three: two Nature, one Water.'],
    ['gym_emberfall', ['Fire', 'Fire', 'Nature'], 'The leader fields three: two Fire, one Nature.'],
    ['gym_tidewrack', ['Water', 'Water', 'Fire'], 'The leader fields three: two Water, one Fire.'],
];

/** The element each badge under a node names, left to right. */
const badgesUnder = (root: ParentNode, nodeId: string): string[] =>
    [...root.querySelectorAll(`[data-node-id="${nodeId}"] .rm-gym-team [role="img"]`)].map((b) => b.getAttribute('aria-label') ?? '');

const MEMBER: IMingmingState = {
    id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1', blueprintsCollected: 0,
    attackIV: 10, defenseIV: 10, hpIV: 10,
};
const ROSTER: IRanchMember[] = [{
    id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1', attackIV: 10, defenseIV: 10, hpIV: 10,
}];

function runScreenFor(gymId: string): HTMLElement {
    const offer = offerGyms('offer-seed').find((o) => o.gym.id === gymId)!;
    const run = createRun({ seed: 'map-cut-seed', offer, party: [MEMBER], startedAt: 1_700_000_000_000 });
    const store = configureStore({
        reducer: { battle: battleReducer, game: gameReducer, run: runReducer },
        preloadedState: { game: { ...createEmptyRanch(), roster: ROSTER, seenTips: [...ALL_TIP_IDS] }, run: { run } },
        middleware: (getDefault) => getDefault({ serializableCheck: false }),
    });
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(<Provider store={store}><RunScreen /></Provider>);
    return host;
}

const element = (gymTeamElements?: ReadonlyArray<string>, currentNodeId = start.id) => (
    <RegionMap
        nodes={graph.nodes}
        currentNodeId={currentNodeId}
        biomeNames={['Emberglass Flats', 'Brinehollow', 'Rootmire']}
        biomeElements={['Fire', 'Water', 'Nature']}
        gymTeamElements={gymTeamElements}
        onTravel={() => {}}
    />
);

describe('202j - the map under the gym node', () => {
    it('draws one badge per body, in the order it is given, on the gym and nowhere else', async () => {
        const host = await mount(makeStore(), element(['Nature', 'Nature', 'Water']));
        expect(badgesUnder(host, gymNode.id)).toEqual(['Nature', 'Nature', 'Water']);
        expect(host.querySelectorAll('.rm-gym-team')).toHaveLength(1);
    });

    it('is there from the first step: the party is nowhere near the last biome', async () => {
        const host = await mount(makeStore(), element(['Water', 'Water', 'Fire']));
        expect(start.biomeIndex).toBe(0);
        expect(badgesUnder(host, gymNode.id)).toEqual(['Water', 'Water', 'Fire']);
    });

    it('carries the symbol in each badge, so it reads without colour', async () => {
        const host = await mount(makeStore(), element(['Nature', 'Nature', 'Water']));
        const badges = [...host.querySelectorAll('.rm-gym-team [role="img"]')];
        expect(badges).toHaveLength(3);
        for (const badge of badges) expect(badge.querySelector('svg')).not.toBeNull();
        // Different elements draw different symbols.
        const shapes = badges.map((b) => b.querySelector('svg')!.innerHTML);
        expect(shapes[0]).toBe(shapes[1]);
        expect(shapes[0]).not.toBe(shapes[2]);
    });

    it('draws nothing when the map is given no team', async () => {
        const host = await mount(makeStore(), element());
        expect(host.querySelectorAll('.rm-gym-team')).toHaveLength(0);
    });

    it('reads the leader sentence when the gym is hovered', async () => {
        const host = await mount(makeStore(), element(['Nature', 'Nature', 'Water']));
        const tip = (): Element | null => document.body.querySelector('.map-tip');
        expect(tip()).toBeNull();
        await fire(host.querySelector(`[data-node-id="${gymNode.id}"]`)!, 'mouseover');
        expect(tip()!.textContent).toContain('The leader fields three: two Nature, one Water.');
        await fire(host.querySelector(`[data-node-id="${gymNode.id}"]`)!, 'mouseout');
        expect(tip()).toBeNull();
    });

    it.each(GYMS)('%s: hovering the gym reads the sentence built from its team', async (_gymId, elements, sentence) => {
        const host = await mount(makeStore(), element(elements));
        await fire(host.querySelector(`[data-node-id="${gymNode.id}"]`)!, 'mouseover');
        expect(document.body.querySelector('.map-tip')!.textContent).toContain(sentence);
    });

    it('does not put the sentence on any other node', async () => {
        const host = await mount(makeStore(), element(['Nature', 'Nature', 'Water']));
        const other = graph.nodes.find((n) => n.kind === 'wild' && n.id !== start.id)!;
        await fire(host.querySelector(`[data-node-id="${other.id}"]`)!, 'mouseover');
        expect(document.body.querySelector('.map-tip')!.textContent).not.toContain('The leader fields');
    });

    it('never adds the team to the Travel list, which must keep its own words', async () => {
        const host = await mount(makeStore(), element(['Nature', 'Nature', 'Water'], gymNode.id));
        expect(host.querySelector('.rm-travel')!.textContent).not.toContain('The leader fields');
    });
});

describe('202j - the run screen hands the map its own gym\'s team', () => {
    it.each(GYMS)('%s: three badges in plan order', (gymId, elements) => {
        const host = runScreenFor(gymId);
        expect(host.querySelector('[aria-label^="Gym"]')).not.toBeNull();
        const named = [...host.querySelectorAll('[aria-label^="Gym"] .rm-gym-team [role="img"]')].map((b) => b.getAttribute('aria-label'));
        expect(named).toEqual(elements);
    });
});
