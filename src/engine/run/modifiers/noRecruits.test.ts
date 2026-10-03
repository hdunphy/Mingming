/**
 * TICKET 169h — No Recruits: the party you start with is the party you finish with.
 *
 * The choke point is `planRecruit`, and Stray Mingming is a second door, because its eligibility
 * check asks the party size and the ranch's blueprints itself and never calls `planRecruit`. Both
 * are pinned here; the two recruit reducers and the workshop screen are in their own files.
 */

import { describe, expect, it } from 'vitest';

import { createRun } from '../createRun';
import { offerGyms } from '../gyms';
import { drawEvent } from '../events/eventDraw';
import { isEventEligible, workshopWouldOfferARecruit } from '../events/eventEligibility';
import type { EventContext, EventRanchView } from '../events/eventContext';
import { planRecruit } from '../workshop';
import { recruitingBlocked } from './noRecruits';
import type { IMingmingState } from '../../types';
import type { IRanchMember, IRanchState, IRunState } from '../../runTypes';
import { plainShop } from '../../../testing/plainShop';

const KRAKEN: IMingmingState = {
    id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1',
    blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10,
};

const rosterMember = (id: string, definitionId: string, activeOS: string): IRanchMember => ({
    id, definitionId, activeOS, attackIV: 10, defenseIV: 10, hpIV: 10,
});

const makeRun = (seed: string, modifiers: string[] = []): IRunState =>
    createRun({ seed, offer: offerGyms('offer-seed')[0], party: [KRAKEN], startedAt: 0, modifiers });

const makeRanch = (blueprints: Record<string, number>): IRanchState => ({
    roster: [rosterMember('mm1', 'kraken', 'kraken_v1')],
    blueprints,
    codex: { seen: [], played: [], species: [], assembled: [], os: [] },
    gymsCleared: [], highestTierCleared: 0, tierClears: {}, seenTips: [], codexMilestones: [],
});

const ranchView = (blueprints: Record<string, number>): EventRanchView => ({
    roster: [{ id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1' }],
    blueprints,
});

describe('recruitingBlocked', () => {
    it('is true only with the No Recruits modifier', () => {
        expect(recruitingBlocked(makeRun('nr'))).toBe(false);
        expect(recruitingBlocked(makeRun('nr', ['no_recruits']))).toBe(true);
        expect(recruitingBlocked(makeRun('nr', ['junk_start', 'tight_budget']))).toBe(false);
    });
});

describe('planRecruit', () => {
    it('makes a plan without the modifier and none with it, for the same node and species', () => {
        const plain = makeRun('nr-plan');
        const blocked = makeRun('nr-plan', ['no_recruits']);
        const node = { ...plainShop(plain, 'workshop'), visited: 1 };
        const ranch = makeRanch({ fenrir: 1 });

        expect(planRecruit({ ranch, run: plain, node, speciesId: 'fenrir' })).not.toBeNull();
        expect(planRecruit({ ranch, run: blocked, node, speciesId: 'fenrir' })).toBeNull();
    });
});

describe('Stray Mingming', () => {
    it('is ineligible with the modifier, even with a free slot and a blueprint', () => {
        const run = makeRun('nr-event', ['no_recruits']);
        const ctx: EventContext = { run, node: { ...run.nodes[1], visited: 1 }, ranch: ranchView({ fenrir: 1 }) };

        expect(workshopWouldOfferARecruit(ctx)).toBe(false);
        expect(isEventEligible('stray_mingming', ctx)).toBe(false);
        expect(workshopWouldOfferARecruit({ ...ctx, run: makeRun('nr-event') })).toBe(true);
    });

    it('is never drawn over 200 nodes with the modifier, and is drawn without it (so the test can fail)', () => {
        let withModifier = 0;
        let without = 0;
        for (let i = 0; i < 200; i++) {
            const seed = `nr-draw-${i}`;
            for (const [modifiers, tally] of [[['no_recruits'], 'on'], [[], 'off']] as const) {
                const run = makeRun(seed, [...modifiers]);
                const node = { ...run.nodes.filter((n) => n.biomeIndex === 1)[0], visited: 1 };
                const drawn = drawEvent(run, node, ranchView({ fenrir: 1, ymir: 1 }));
                if (drawn?.id === 'stray_mingming') {
                    if (tally === 'on') withModifier += 1; else without += 1;
                }
            }
        }
        expect(withModifier).toBe(0);
        expect(without).toBeGreaterThan(0);
    });
});
