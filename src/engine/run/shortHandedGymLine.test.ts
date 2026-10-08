/**
 * TICKET 204 — the defeat screen's short-handed line: only a defeat, only at the gym, only short.
 */
import { describe, expect, it } from 'vitest';

import { createRun } from './createRun';
import { offerGyms } from './gyms';
import { shortHandedGymLine } from './shortHandedGymLine';
import type { IRunState, RunOutcome } from '../runTypes';
import type { IMingmingState } from '../types';

const member = (id: string): IMingmingState => ({
    id, definitionId: 'kraken', activeOS: 'kraken_v1', blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10,
});

const BASE = createRun({ seed: 'short-handed-204', offer: offerGyms('offer-204')[0], party: [member('mm1')], startedAt: 1 });
const GYM = BASE.nodes.find((n) => n.kind === 'gym')!;
const WILD = BASE.nodes.find((n) => n.kind === 'wild')!;

const ended = (outcome: RunOutcome, over: Partial<IRunState> = {}): IRunState =>
    ({ ...BASE, phase: 'ended', outcome, currentNodeId: GYM.id, ...over });

describe('204 — the short-handed gym line', () => {
    it('says how many the player brought against the gym’s three', () => {
        expect(shortHandedGymLine(ended('defeat', { partyIds: ['mm1'] }))).toBe("You fought the gym's three with one.");
        expect(shortHandedGymLine(ended('defeat', { partyIds: ['mm1', 'mm2'] }))).toBe("You fought the gym's three with two.");
    });

    it('says nothing with a full team, away from the gym, on a win or an abandon, or in the intro', () => {
        expect(shortHandedGymLine(ended('defeat', { partyIds: ['mm1', 'mm2', 'mm3'] }))).toBeNull();
        expect(shortHandedGymLine(ended('defeat', { currentNodeId: WILD.id }))).toBeNull();
        expect(shortHandedGymLine(ended('victory'))).toBeNull();
        expect(shortHandedGymLine(ended('abandoned'))).toBeNull();
        expect(shortHandedGymLine(ended('defeat', { mode: 'intro' } as Partial<IRunState>))).toBeNull();
    });
});
