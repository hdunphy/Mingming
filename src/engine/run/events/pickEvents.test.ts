/**
 * TICKET 168d — the six pick-a-reward events: who may draw them, and what they offer.
 *
 * The Norns' Loom, Wild Tracks, Dragon's Barrow, Brewer's Cask, The Skald's Price and Stray Mingming. What
 * each one DOES to a run is in `EventNode.pickEvents.test.tsx`; this file holds the checks that need
 * no screen: eligibility (a positive and a negative case per row of the ticket's table), the offers
 * (distinct, seeded, from the right pool), and The Skald's Price's two prices.
 */

import { describe, expect, it } from 'vitest';

import { BATTLE_MACRO_IDS } from '../../data/macroRegistry';
import { MingmingRegistry } from '../../data/mingmingRegistry';
import { ProgramRegistry } from '../../data/programRegistry';
import { createRun } from '../createRun';
import { regionSpeciesPool } from '../gauntlet';
import { offerBlueprints } from './eventBlueprints';
import { offerCards } from './eventCards';
import { playableChoices } from './eventChoices';
import { getEvent } from './eventCatalogue';
import type { EventContext, EventRanchView } from './eventContext';
import { BUILT_EVENTS } from './eventDraw';
import { isEventEligible } from './eventEligibility';
import { offerMacros } from './eventMacros';
import { choiceScrapCost } from './eventSchema';
import { offerGyms } from '../gyms';
import type { IMingmingState } from '../../types';
import type { IRunState } from '../../runTypes';

const KRAKEN: IMingmingState = {
    id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1',
    blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10,
};
const FENRIR_ID = 'fenrir';

function makeRun(seed = 'pick-events'): IRunState {
    return createRun({ seed, offer: offerGyms('pick-offer')[0], party: [KRAKEN], startedAt: 1 });
}

function ctxFor(run: IRunState, ranch: Partial<EventRanchView> = {}): EventContext {
    const node = { ...run.nodes.find((n) => n.id !== run.currentNodeId)!, visited: 1 };
    return { run, node, ranch: { roster: [{ id: 'mm1', definitionId: 'kraken' }], blueprints: {}, ...ranch } };
}

const PICK_EVENTS = ['abandoned_terminal', 'wild_tracks', 'rare_vault', 'macro_crate', 'data_broker', 'stray_mingming'];

describe('the six pick-a-reward events are built', () => {
    it('are all in BUILT_EVENTS, with every one of their choices playable', () => {
        for (const id of PICK_EVENTS) {
            expect(BUILT_EVENTS.has(id), id).toBe(true);
            const event = getEvent(id)!;
            expect(playableChoices(event).map((c) => c.id), id).toEqual(event.choices.map((c) => c.id));
        }
    });
});

describe('eligibility', () => {
    it('The Norns\' Loom needs a card with a + in the deck', () => {
        const run = makeRun();
        expect(isEventEligible('abandoned_terminal', ctxFor(run))).toBe(true);
        expect(isEventEligible('abandoned_terminal', ctxFor({ ...run, deck: [] }))).toBe(false);
    });

    it('Wild Tracks and Brewer\'s Cask are always eligible', () => {
        const ctx = ctxFor(makeRun());
        expect(isEventEligible('wild_tracks', ctx)).toBe(true);
        expect(isEventEligible('macro_crate', ctx)).toBe(true);
    });

    it('Dragon\'s Barrow and The Skald\'s Price are eligible when the party pool holds a Rare card', () => {
        // There is no negative case to build: every party's pool includes the neutral cards, and the
        // neutral cards include Rares, so the pool is never without one. The check is kept because
        // the table asks for it and a future pool change should fail here, not at a player.
        for (const roster of [[{ id: 'mm1', definitionId: 'kraken' }], []]) {
            const ctx = ctxFor(makeRun(), { roster });
            expect(isEventEligible('rare_vault', ctx)).toBe(true);
            expect(isEventEligible('data_broker', ctx)).toBe(true);
        }
    });

    it('Stray Mingming needs a free party slot AND a blueprint', () => {
        const run = makeRun();
        expect(isEventEligible('stray_mingming', ctxFor(run))).toBe(false);
        expect(isEventEligible('stray_mingming', ctxFor(run, { blueprints: { [FENRIR_ID]: 1 } }))).toBe(true);
        const full = { ...run, partyIds: ['mm1', 'mm2', 'mm3'] };
        expect(isEventEligible('stray_mingming', ctxFor(full, { blueprints: { [FENRIR_ID]: 1 } }))).toBe(false);
    });

    it('Stray Mingming needs a recruit the workshop would allow: not a build the party already runs', () => {
        const run = makeRun();
        // The party runs kraken_v1. A kraken blueprint is a recruit only on the firmware it does not run.
        const kraken = { roster: [{ id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1' }], blueprints: { kraken: 1 } };
        expect(isEventEligible('stray_mingming', ctxFor(run, kraken))).toBe(true);
        const oneFirmware = MingmingRegistry.kraken.availableOS.length === 1;
        expect(oneFirmware).toBe(false);
        // Nothing left to build once every firmware the species has is spoken for.
        const party = MingmingRegistry.kraken.availableOS.map((osId, i) => ({ id: `k${i}`, definitionId: 'kraken', activeOS: osId }));
        const spoken = { ...run, partyIds: party.map((m) => m.id) };
        expect(isEventEligible('stray_mingming', ctxFor(spoken, { roster: party, blueprints: { kraken: 1 } }))).toBe(false);
    });
});

describe('what each event offers', () => {
    it('Wild Tracks: three different species this run\'s region fields, the same three every time', () => {
        const ctx = ctxFor(makeRun());
        const offered = offerBlueprints(ctx, 3, 'pick:0');
        expect(offered).toHaveLength(3);
        expect(new Set(offered).size).toBe(3);
        const region = regionSpeciesPool(ctx.run, ctx.node);
        for (const id of offered) expect(region).toContain(id);
        expect(offerBlueprints(ctx, 3, 'pick:0')).toEqual(offered);
    });

    it('Brewer\'s Cask: three different battle macros, the same three every time', () => {
        const ctx = ctxFor(makeRun());
        const offered = offerMacros(ctx, 3, 'pick:0');
        expect(offered).toHaveLength(3);
        expect(new Set(offered).size).toBe(3);
        for (const id of offered) expect(BATTLE_MACRO_IDS).toContain(id);
        expect(offerMacros(ctx, 3, 'pick:0')).toEqual(offered);
    });

    it('Dragon\'s Barrow: three different Rare cards', () => {
        const ctx = ctxFor(makeRun());
        const offered = offerCards(ctx, { count: 3, rarities: ['Rare'] }, 'pick:0');
        expect(offered).toHaveLength(3);
        expect(new Set(offered).size).toBe(3);
        for (const id of offered) expect(ProgramRegistry[id]?.rarity).toBe('Rare');
    });

    it('The Skald\'s Price: its two prices are 40 for Rare and 15 for Uncommon', () => {
        const broker = getEvent('data_broker')!;
        const cost = (id: string): number => choiceScrapCost(broker.choices.find((c) => c.id === id)!);
        expect(cost('rare')).toBe(40);
        expect(cost('uncommon')).toBe(15);
        expect(cost('leave')).toBe(0);
        const uncommon = offerCards(ctxFor(makeRun()), { count: 3, rarities: ['Uncommon'] }, 'uncommon:1');
        for (const id of uncommon) expect(ProgramRegistry[id]?.rarity).toBe('Uncommon');
    });
});
