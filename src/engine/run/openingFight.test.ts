/**
 * Henry, 2026-10-03: the run opens on a fight. The start node is a wild underneath and the walker
 * has always fought it as the run's first fight; the game did not (the start was drawn as a flag and
 * the run opened on the map), and Henry had tried to report that as a bug. A new run now opens in
 * the encounter on its first node, and that fight is the scripted easy opening.
 */
import { describe, expect, it } from 'vitest';

import { GetMingmingData } from '../data/mingmingRegistry';
import { offerGyms } from './gyms';
import { createRun } from './createRun';
import { withOpeningFight } from './openingFight';
import { isOpeningFight, rollEncounter } from './encounter';
import type { IMingmingState } from '../types';

const party = (): IMingmingState[] => [{
    id: 'mm1', definitionId: 'kraken', activeOS: GetMingmingData('kraken').availableOS[0],
    blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10,
}];

const fresh = (seed: string) => createRun({ seed, offer: offerGyms('offer-seed')[0], party: party(), startedAt: 1 });

describe('the run opens on its first fight', () => {
    it('puts a new run in the encounter phase, standing on the start node', () => {
        for (let i = 0; i < 25; i += 1) {
            const run = withOpeningFight(fresh(`opening-${i}`));
            expect(run.phase, `opening-${i}`).toBe('encounter');
            expect(run.currentNodeId).toBe('b0l0n0');
            expect(run.fightsResolved).toBe(0);
        }
    });

    it('rolls the scripted opening fight (one body) on that node', () => {
        const run = withOpeningFight(fresh('opening-roll'));
        const node = run.nodes.find((n) => n.id === run.currentNodeId)!;
        expect(isOpeningFight(run)).toBe(true);
        const encounter = rollEncounter({ run, node, party: party() });
        expect(encounter.enemyParty).toHaveLength(1);
    });

    it('changes nothing else about the run', () => {
        const plain = fresh('opening-same');
        const { phase: _a, ...rest } = withOpeningFight(plain);
        const { phase: _b, ...restPlain } = plain;
        expect(rest).toEqual(restPlain);
    });

    it('leaves a run that is not at its start alone', () => {
        const plain = fresh('opening-later');
        const later = { ...plain, fightsResolved: 1 };
        expect(withOpeningFight(later)).toBe(later);
    });
});
