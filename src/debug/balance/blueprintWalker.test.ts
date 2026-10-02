/**
 * Ticket 164g — In the walker, blueprints and recruits are free.
 * Tests for BlueprintLedger, market blueprint purchasing, and workshop recruits.
 */
import { describe, expect, it } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import runReducer, { startRun, addRunScrap, spendRunScrap } from '../../ui/store/runSlice';
import { createRun } from '../../engine/run/createRun';
import { GYM_REGISTRY } from '../../engine/run/gyms';
import { BlueprintLedger } from './BlueprintLedger';
import { buyMarketBlueprintIfOffered, executeWorkshopRecruit } from './runWalker';
import { rollBlueprintOffer, isBlueprintSlotSold, MARKET_BLUEPRINT_PRICE } from '../../engine/run/marketplace';
import { WORKSHOP_ASSEMBLY_SCRAP } from '../../engine/run/workshop';
import type { IMingmingState } from '../../engine/types';

const SOLO: IMingmingState[] = [{
    id: 'mm1', definitionId: 'fenrir', activeOS: 'fenrir_v1',
    blueprintsCollected: 0, attackIV: 15, defenseIV: 15, hpIV: 15,
}];

function setupRun(seed = 'blueprint-test') {
    const gym = GYM_REGISTRY.gym_rootfall;
    const store = configureStore({ reducer: { run: runReducer } });
    store.dispatch(startRun(createRun({
        seed,
        offer: { gym, biomes: [{ id: 'b1', name: 'Biome', elements: ['Water'] }] },
        party: SOLO,
        startedAt: 1_700_000_000_000,
    })));
    return { store, gym };
}

describe('Ticket 164g — In the walker, blueprints and recruits are free', () => {
    describe('BlueprintLedger', () => {
        it('tracks counts per species, spends correctly, and identifies recruitable candidates', () => {
            const ledger = new BlueprintLedger();
            expect(ledger.has('fenrir')).toBe(false);
            expect(ledger.total).toBe(0);

            ledger.add('fenrir');
            ledger.add('fenrir');
            ledger.add('kraken');
            expect(ledger.has('fenrir')).toBe(true);
            expect(ledger.has('kraken')).toBe(true);
            expect(ledger.has('huldra')).toBe(false);
            expect(ledger.total).toBe(3);

            // recruitable excluding held party members
            expect(ledger.recruitable(new Set(['fenrir']))).toEqual(['kraken']);
            expect(ledger.recruitable(new Set([]))).toEqual(['fenrir', 'kraken']);

            // spend
            expect(ledger.spend('kraken')).toBe(true);
            expect(ledger.has('kraken')).toBe(false);
            expect(ledger.total).toBe(2);

            expect(ledger.spend('kraken')).toBe(false); // none left
            expect(ledger.spend('fenrir')).toBe(true);
            expect(ledger.has('fenrir')).toBe(true); // 1 left
            expect(ledger.spend('fenrir')).toBe(true);
            expect(ledger.has('fenrir')).toBe(false); // 0 left
            expect(ledger.total).toBe(0);
        });
    });

    describe('Walker marketplace blueprint purchases', () => {
        it('1. A walker run that buys a market blueprint loses exactly its price, and a revisit to the same shelf does not buy it again', () => {
            const { store } = setupRun('market-bp-test');
            const run = store.getState().run.run!;
            const marketNode = run.nodes.find((n) => n.kind === 'marketplace')!;
            expect(marketNode).toBeDefined();

            // Give the run enough scrap to buy the blueprint
            store.dispatch(addRunScrap(MARKET_BLUEPRINT_PRICE));
            const initialScrap = store.getState().run.run!.scrap;
            expect(initialScrap).toBeGreaterThanOrEqual(MARKET_BLUEPRINT_PRICE);

            const offer = rollBlueprintOffer(run, marketNode);
            expect(offer).not.toBeNull();

            const ledger = new BlueprintLedger();
            const boughtFirst = buyMarketBlueprintIfOffered(store, marketNode, ledger);
            expect(boughtFirst).toBe(true);

            // Scrap must decrease by exactly the blueprint price
            const scrapAfterFirst = store.getState().run.run!.scrap;
            expect(scrapAfterFirst).toBe(initialScrap - offer!.price);

            // Ledger must now hold the blueprint
            expect(ledger.has(offer!.speciesId)).toBe(true);

            // Slot is marked sold
            expect(isBlueprintSlotSold(store.getState().run.run!, marketNode)).toBe(true);

            // Revisit to the same shelf: does not buy it again, scrap does not change, ledger does not grow
            const boughtSecond = buyMarketBlueprintIfOffered(store, marketNode, ledger);
            expect(boughtSecond).toBe(false);
            expect(store.getState().run.run!.scrap).toBe(scrapAfterFirst);
            expect(ledger.total).toBe(1);
        });
    });

    describe('Walker workshop recruits', () => {
        it('2. A recruit costs 25 scrap and consumes the recruited species blueprint', () => {
            const { store, gym } = setupRun('recruit-cost-test');
            // Give 50 scrap
            store.dispatch(addRunScrap(50));
            const initialScrap = store.getState().run.run!.scrap;

            const run = store.getState().run.run!;
            const workshopNode = run.nodes.find((n) => n.kind === 'workshop')!;
            expect(workshopNode).toBeDefined();

            const party = [...SOLO];
            const roster = [...party];
            const ledger = new BlueprintLedger();
            ledger.add('kraken');

            const choice = executeWorkshopRecruit(store, workshopNode, party, roster, ledger, gym);
            expect(choice).not.toBeNull();
            expect(choice!.speciesId).toBe('kraken');

            // Scrap must be reduced by WORKSHOP_ASSEMBLY_SCRAP (25)
            const scrapAfter = store.getState().run.run!.scrap;
            expect(scrapAfter).toBe(initialScrap - WORKSHOP_ASSEMBLY_SCRAP);

            // Ledger blueprint must be consumed
            expect(ledger.has('kraken')).toBe(false);
            expect(ledger.total).toBe(0);

            // Party now has 2 members
            expect(store.getState().run.run!.partyIds).toHaveLength(2);
        });

        it('3. A blueprint for species X cannot recruit species Y', () => {
            const { store, gym } = setupRun('species-constraint-test');
            store.dispatch(addRunScrap(100));

            const run = store.getState().run.run!;
            const workshopNode = run.nodes.find((n) => n.kind === 'workshop')!;

            const party = [...SOLO]; // fenrir
            const roster = [...party];
            const ledger = new BlueprintLedger();

            // We hold a blueprint for skoll only
            ledger.add('skoll');

            // Recruitment should only consider skoll, never kraken or huldra
            const choice = executeWorkshopRecruit(store, workshopNode, party, roster, ledger, gym);
            expect(choice).not.toBeNull();
            expect(choice!.speciesId).toBe('skoll');

            // If ledger holds ONLY a species already in the party (fenrir), recruit cannot proceed
            ledger.add('fenrir'); // already held in party
            const partyNow = store.getState().run.run!.partyIds.map((id) => roster.find((m) => m.id === id)!);
            const noChoice = executeWorkshopRecruit(store, workshopNode, partyNow, roster, ledger, gym);
            expect(noChoice).toBeNull();
        });
    });
});

/*
 * TICKET 169j — the walker's workshop recruit under the two modifiers that touch it.
 *
 * The walker builds its recruit itself rather than through `planRecruit`, so it had to be told:
 * No Recruits refuses it (and must not spend the ledger or grow the roster), and Tight Budget
 * charges the same raised price the workshop screen shows.
 */
describe('Ticket 169j — the walker\'s recruit and the modifiers', () => {
    function setupModifiedRun(modifiers: string[]) {
        const gym = GYM_REGISTRY.gym_rootfall;
        const store = configureStore({ reducer: { run: runReducer } });
        store.dispatch(startRun(createRun({
            seed: 'walker-modifiers',
            offer: { gym, biomes: [{ id: 'b1', name: 'Biome', elements: ['Water'] }] },
            party: SOLO,
            startedAt: 1_700_000_000_000,
            modifiers,
        })));
        store.dispatch(addRunScrap(100));
        return { store, gym };
    }

    it('No Recruits: no recruit, no phantom roster member, no blueprint spent, no scrap taken', () => {
        const { store, gym } = setupModifiedRun(['no_recruits']);
        const workshopNode = store.getState().run.run!.nodes.find((n) => n.kind === 'workshop')!;
        const roster = [...SOLO];
        const ledger = new BlueprintLedger();
        ledger.add('kraken');
        const scrapBefore = store.getState().run.run!.scrap;

        const choice = executeWorkshopRecruit(store, workshopNode, [...SOLO], roster, ledger, gym);

        expect(choice).toBeNull();
        expect(roster).toHaveLength(1);
        expect(ledger.has('kraken')).toBe(true);
        expect(store.getState().run.run!.scrap).toBe(scrapBefore);
        expect(store.getState().run.run!.partyIds).toHaveLength(1);
    });

    it('Tight Budget: the recruit costs 35, the price the workshop shows', () => {
        const { store, gym } = setupModifiedRun(['tight_budget']);
        const workshopNode = store.getState().run.run!.nodes.find((n) => n.kind === 'workshop')!;
        const ledger = new BlueprintLedger();
        ledger.add('kraken');
        const scrapBefore = store.getState().run.run!.scrap;

        expect(executeWorkshopRecruit(store, workshopNode, [...SOLO], [...SOLO], ledger, gym)).not.toBeNull();
        expect(store.getState().run.run!.scrap).toBe(scrapBefore - 35);
    });

    it('Tight Budget: a purse of 30 cannot afford the recruit, though 25 would have', () => {
        const { store, gym } = setupModifiedRun(['tight_budget']);
        const run = store.getState().run.run!;
        const workshopNode = run.nodes.find((n) => n.kind === 'workshop')!;
        store.dispatch(spendRunScrap(run.scrap - 30));
        const ledger = new BlueprintLedger();
        ledger.add('kraken');

        expect(executeWorkshopRecruit(store, workshopNode, [...SOLO], [...SOLO], ledger, gym)).toBeNull();
    });

    it('an event recruit at price 0 stays free under Tight Budget', () => {
        const { store, gym } = setupModifiedRun(['tight_budget']);
        const workshopNode = store.getState().run.run!.nodes.find((n) => n.kind === 'workshop')!;
        const ledger = new BlueprintLedger();
        ledger.add('kraken');
        const scrapBefore = store.getState().run.run!.scrap;

        expect(executeWorkshopRecruit(store, workshopNode, [...SOLO], [...SOLO], ledger, gym, undefined, 0)).not.toBeNull();
        expect(store.getState().run.run!.scrap).toBe(scrapBefore);
    });
});
