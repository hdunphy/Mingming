/**
 * TICKET 168f — the Well of Urd rules that sit under the screen: which bodies can be flashed and
 * to what, and that everything else in a run reads a flashed body's NEW firmware.
 */

import { describe, expect, it } from 'vitest';

import { elitePatchOffer } from '../../RewardSystem';
import { chooseEventChoice } from '../../../debug/balance/eventPolicy';
import { createRun } from '../createRun';
import { offerGyms } from '../gyms';
import { workshopBlockFor } from '../workshop';
import { EVENTS } from './eventCatalogue';
import type { EventContext } from './eventContext';
import { partyMembersOf } from './eventContext';
import { BUILT_EVENTS } from './eventDraw';
import { isEventEligible } from './eventEligibility';
import { patchOffers } from './eventPatch';
import { canReflashAny, reflashRows, reflashTargetFor } from './eventReflash';
import type { IMingmingState } from '../../types';
import type { IRanchState, IRunState } from '../../runTypes';

const body = (id: string, definitionId: string, activeOS: string): IMingmingState => ({
    id, definitionId, activeOS, blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10,
});

function ctxFor(party: IMingmingState[], over: Partial<IRunState> = {}, blueprints: Record<string, number> = {}): EventContext {
    const run = { ...createRun({ seed: 'reflash-engine', offer: offerGyms('offer')[0], party, startedAt: 1 }), ...over };
    return { run, node: run.nodes[0], ranch: { roster: party, blueprints } };
}

describe('Well of Urd — who can be flashed, and to what', () => {
    it('is in BUILT_EVENTS and is eligible while a body has no patch', () => {
        expect(BUILT_EVENTS.has('firmware_reflash')).toBe(true);
        expect(isEventEligible('firmware_reflash', ctxFor([body('a', 'kraken', 'kraken_v1')]))).toBe(true);
        expect(isEventEligible('firmware_reflash', ctxFor([body('a', 'kraken', 'kraken_v1')], { patches: { a: ['amplifier'] } }))).toBe(false);
    });

    it('offers a body its species’ other OS, in both directions', () => {
        const v1 = reflashRows(ctxFor([body('a', 'kraken', 'kraken_v1')]))[0];
        expect(v1).toMatchObject({ fromOS: 'kraken_v1', toOS: 'kraken_v2', blocked: null });
        const v2 = reflashRows(ctxFor([body('a', 'kraken', 'kraken_v2')]))[0];
        expect(v2).toMatchObject({ fromOS: 'kraken_v2', toOS: 'kraken_v1', blocked: null });
    });

    it('a flashed body goes back the way it came on a second flash (the run’s OS is the starting point)', () => {
        const party = [body('a', 'kraken', 'kraken_v1')];
        const flashed = ctxFor(party, { osOverrides: { a: 'kraken_v2' } });
        expect(reflashRows(flashed)[0]).toMatchObject({ fromOS: 'kraken_v2', toOS: 'kraken_v1' });
    });

    it('refuses a patched body with the reason "patched"', () => {
        const ctx = ctxFor([body('a', 'kraken', 'kraken_v1'), body('b', 'fenrir', 'fenrir_v1')], { patches: { a: ['amplifier'] } });
        const rows = reflashRows(ctx);
        expect(rows.find((row) => row.memberId === 'a')!.blocked).toBe('patched');
        expect(rows.find((row) => row.memberId === 'b')!.blocked).toBeNull();
        expect(reflashTargetFor(ctx, 'a')).toBeNull();
        expect(reflashTargetFor(ctx, 'b')).toBe('fenrir_v2');
        expect(reflashTargetFor(ctx, 'nobody')).toBeNull();
    });

    it('refuses a body whose other OS a teammate of the same species already runs', () => {
        const ctx = ctxFor([body('a', 'kraken', 'kraken_v1'), body('b', 'kraken', 'kraken_v2')]);
        expect(reflashRows(ctx).map((row) => row.blocked)).toEqual(['duplicate-build', 'duplicate-build']);
        expect(canReflashAny(ctx)).toBe(false);
    });
});

describe('a flashed body, everywhere else a run reads its OS', () => {
    const party = [body('a', 'kraken', 'kraken_v1')];

    it('the event context’s party is on the new OS, and the roster it reads from is not touched', () => {
        const ctx = ctxFor(party, { osOverrides: { a: 'kraken_v2' } });
        expect(partyMembersOf(ctx)[0].activeOS).toBe('kraken_v2');
        expect(ctx.ranch.roster[0].activeOS).toBe('kraken_v1');
    });

    it('the The Runecarver fits the best patch for the NEW firmware', () => {
        const flashed = patchOffers(ctxFor(party, { osOverrides: { a: 'kraken_v2' } }));
        expect(flashed).toEqual(elitePatchOffer([{ id: 'a', definitionId: 'kraken', activeOS: 'kraken_v2' }], {}));
    });

    it('the workshop’s duplicate clause judges the new OS: kraken_v2 is now taken, kraken_v1 is free', () => {
        const run: IRunState = { ...ctxFor(party, { osOverrides: { a: 'kraken_v2' } }).run, partyIds: ['a'] };
        const ranch = { roster: party, blueprints: { kraken: 1 } } as unknown as IRanchState;
        expect(workshopBlockFor('kraken', ranch, run, 'kraken_v2')).toBe('duplicate-build');
        expect(workshopBlockFor('kraken', ranch, run, 'kraken_v1')).toBeNull();
    });
});

describe('the balance walker at the station', () => {
    it('takes Leave: it has no way to value an OS switch', () => {
        const event = EVENTS.find((candidate) => candidate.id === 'firmware_reflash')!;
        expect(chooseEventChoice(event).id).toBe('leave');
    });
});
