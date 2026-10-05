/**
 * TICKET 195c — how many Traces the player holds, in ONE place.
 *
 * The town's Den tile ("N traces held"), the run's status line in the game and the playtest tool's
 * header all read it from `tracesHeld`, so the three can never disagree. It counts what the Den can
 * show: every species' Trace count, summed.
 */
import { describe, it, expect } from 'vitest';

import { createRun } from './createRun';
import { offerGyms } from './gyms';
import { tracesHeld, workshopSpecies } from './workshop';
import type { IRanchState } from '../runTypes';
import type { IMingmingState } from '../types';

const KRAKEN: IMingmingState = { id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1', blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10 };
const run = createRun({ seed: 's', offer: offerGyms('o')[0], party: [KRAKEN], startedAt: 1 });
const ranch = (blueprints: Record<string, number>): IRanchState => ({ roster: [], blueprints, codex: { seen: [], played: [], species: [], assembled: [], os: [] }, gymsCleared: [], highestTierCleared: 0, tierClears: {}, seenTips: [], codexMilestones: [], runsCompleted: 0 });

describe('195c — tracesHeld', () => {
    it('is zero for a ranch with none', () => {
        expect(tracesHeld(ranch({}), run)).toBe(0);
    });

    it('sums every species’ count', () => {
        expect(tracesHeld(ranch({ fenrir: 2, huldra: 1 }), run)).toBe(3);
    });

    it('goes down by one when a summon spends one', () => {
        expect(tracesHeld(ranch({ fenrir: 2, huldra: 1 }), run) - tracesHeld(ranch({ fenrir: 1, huldra: 1 }), run)).toBe(1);
    });

    it('is the sum of what the Den lists', () => {
        const held = ranch({ fenrir: 2, huldra: 1, skoll: 0 });
        expect(tracesHeld(held, run)).toBe(workshopSpecies(held, run).reduce((sum, entry) => sum + entry.blueprints, 0));
    });
});
