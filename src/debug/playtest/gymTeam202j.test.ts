/**
 * TICKET 202j - the tool's map screen names the gym's team elements on the gym's line.
 *
 * Words, not icons, in plan order, from the same function the game's map reads. Types only: no
 * species appear. The gym is on the map from the first step, so the line is there before the gym is
 * reachable (under "Ahead"), and the node's own description carries it for when it is the next step.
 */
import { describe, expect, it } from 'vitest';

import { offerGyms } from '../../engine/run/gyms';
import { layoutRegion } from '../../ui/screens/regionLayout';
import { gymOfferSeed } from './gymOfferSeed';
import { describeNode } from './screens/mapScreen';
import { currentScreen } from './screen';
import { freshWorld } from './testKit';
import type { World } from './types';

const GYMS: ReadonlyArray<readonly [string, string]> = [
    ['gym_rootfall', 'Nature, Nature, Water'],
    ['gym_emberfall', 'Fire, Fire, Nature'],
    ['gym_tidewrack', 'Water, Water, Fire'],
];

function worldForGym(gymId: string): World {
    const seed = 'ps1';
    const gymIndex = offerGyms(gymOfferSeed(seed)).findIndex((o) => o.gym.id === gymId);
    expect(gymIndex).toBeGreaterThanOrEqual(0);
    return freshWorld({ seed, gymIndex });
}

const gymLineOf = (world: World): string => {
    const body = currentScreen(world).body.join('\n');
    return body.split('\n').find((l) => /\bGym\b/.test(l)) ?? `(no gym line in: ${body})`;
};

describe('202j - the tool\'s gym line', () => {
    it.each(GYMS)('%s: the map screen names the three elements in plan order', (gymId, words) => {
        const world = worldForGym(gymId);
        expect(world.store.getState().run.run!.gymId).toBe(gymId);
        expect(gymLineOf(world)).toContain(words);
    });

    it.each(GYMS)('%s: the gym node\'s own description says it, for when it is the next step', (gymId, words) => {
        const world = worldForGym(gymId);
        const run = world.store.getState().run.run!;
        const laid = layoutRegion(run.nodes, run.currentNodeId).nodes.find((n) => n.node.kind === 'gym')!;
        expect(describeNode(world, laid)).toContain(words);
    });

    it('names no species', () => {
        const line = gymLineOf(worldForGym('gym_rootfall')).toLowerCase();
        for (const word of ['ratatoskr', 'huldra', 'kraken', 'jormungandr', 'skoll', 'fenrir']) {
            expect(line).not.toContain(word);
        }
    });

    it('puts the team on the gym alone', () => {
        const body = currentScreen(worldForGym('gym_rootfall')).body.filter((l) => !/\bGym\b/.test(l));
        expect(body.join('\n')).not.toContain('Nature, Nature, Water');
    });
});
