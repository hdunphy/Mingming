/**
 * TICKET 168e — the trade and cost events, without a screen: what may be given up, what a trade or a
 * recompile turns a card into, which Drivers and patches are offered, who may draw each event, and
 * the power cap end to end.
 */

import { describe, expect, it } from 'vitest';

import { PLAYER_DRIVER_IDS, TEMPORARY_DRIVER_IDS } from '../../data/driverRegistry';
import { ProgramRegistry } from '../../data/programRegistry';
import { isRewardable, rewardCardPool } from '../../RewardSystem';
import { createRun, minimumActiveDeck } from '../createRun';
import { offerGyms } from '../gyms';
import type { IMingmingState } from '../../types';
import type { IRunCard, IRunState } from '../../runTypes';
import { getEvent } from './eventCatalogue';
import type { EventContext, EventRanchView } from './eventContext';
import { BUILT_EVENTS, drawEvent } from './eventDraw';
import { isEventEligible } from './eventEligibility';
import { offerDrivers } from './eventDrivers';
import { canGive, deckSpare, heldCards } from './eventGive';
import { patchOffers } from './eventPatch';
import { recompileTarget, tradeUpRarity, tradeUpTarget } from './eventTrade';
import { playableChoices } from './eventChoices';
import { JUNK_CARD_ID } from '../junk';

const KRAKEN: IMingmingState = {
    id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1',
    blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10,
};
const RANCH: EventRanchView = { roster: [{ id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1' }], blueprints: {} };

function makeRun(over: Partial<IRunState> = {}): IRunState {
    const run = createRun({ seed: 'trade-events', offer: offerGyms('trade-offer')[0], party: [KRAKEN], startedAt: 1 });
    return { ...run, ...over };
}

function ctxFor(run: IRunState, ranch: Partial<EventRanchView> = {}): EventContext {
    const node = { ...run.nodes.find((n) => n.id !== run.currentNodeId)!, visited: 1, biomeIndex: 1 };
    return { run, node, ranch: { ...RANCH, ...ranch } };
}

/** A card of the party's pool with the wanted rarity. */
function cardOf(rarity: string, skip = 0): string {
    return rewardCardPool([{ definitionId: 'kraken' }]).filter((id) => ProgramRegistry[id]?.rarity === rarity)[skip];
}
const held = (instanceId: string, dataId: string): IRunCard => ({ instanceId, dataId, ownerId: null });

/** A fresh run's deck sits AT its floor, so a run with cards to spare has to be given some. */
function runWithSpare(spare: number, over: Partial<IRunState> = {}): IRunState {
    const run = makeRun();
    const extra = Array.from({ length: spare }, (_, i) => held(`spare${i}`, cardOf('Common', i)));
    return { ...run, deck: [...run.deck, ...extra], ...over };
}

describe('what can be given up (rule 7)', () => {
    it('lets a deck above its floor give up cards, only as far as the floor allows', () => {
        const floor = minimumActiveDeck(1);
        const atFloor = makeRun({ deck: makeRun().deck.slice(0, floor), collection: [] });
        expect(deckSpare(atFloor)).toBe(0);
        expect(canGive(atFloor, 1)).toBe(false);
        const two = runWithSpare(2, { collection: [] });
        expect(deckSpare(two)).toBe(two.deck.length - floor);
        expect(canGive(two, 2)).toBe(true);
        expect(canGive(two, 3)).toBe(false);
    });

    it('lets a collection card go whatever the deck is', () => {
        const floor = minimumActiveDeck(1);
        const atFloor = makeRun({ deck: makeRun().deck.slice(0, floor), collection: [held('c1', cardOf('Common'))] });
        expect(canGive(atFloor, 1)).toBe(true);
        expect(canGive(atFloor, 2)).toBe(false);
    });

    it('never counts junk: a deck at its floor plus one junk card still cannot give a deck card', () => {
        const floor = minimumActiveDeck(1);
        const deck = [...makeRun().deck.slice(0, floor), held('j1', JUNK_CARD_ID)];
        const run = makeRun({ deck, collection: [] });
        expect(deckSpare(run)).toBe(0);
        expect(canGive(run, 1)).toBe(false);
        expect(heldCards(run).some((row) => row.card.dataId === JUNK_CARD_ID)).toBe(false);
    });

    it('filters by rarity for the Runecarver give-up', () => {
        const rare = held('r1', cardOf('Rare'));
        const run = makeRun({ collection: [rare] });
        expect(canGive(run, 1, 'Rare')).toBe(true);
        expect(canGive(makeRun({ collection: [held('c1', cardOf('Common'))] }), 1, 'Rare')).toBe(false);
    });
});

describe('the Trader and the Seiðr Cauldron', () => {
    it('deals one rarity higher, and a Rare gets a different Rare', () => {
        expect(tradeUpRarity('Common')).toBe('Uncommon');
        expect(tradeUpRarity('Uncommon')).toBe('Rare');
        expect(tradeUpRarity('Rare')).toBe('Rare');
        const ctx = ctxFor(makeRun());
        for (const [from, to] of [['Common', 'Uncommon'], ['Uncommon', 'Rare'], ['Rare', 'Rare']]) {
            const given = held('g1', cardOf(from));
            const target = tradeUpTarget(ctx, given)!;
            expect(ProgramRegistry[target].rarity).toBe(to);
            expect(target).not.toBe(given.dataId);
            expect(tradeUpTarget(ctx, given)).toBe(target);
        }
    });

    it('recompiles into a rewardable card of the same element and rarity, never the same card', () => {
        const ctx = ctxFor(makeRun());
        let checked = 0;
        for (const rarity of ['Common', 'Uncommon', 'Rare']) {
            for (let skip = 0; skip < 6; skip += 1) {
                const id = cardOf(rarity, skip);
                if (!id) continue;
                const target = recompileTarget(ctx, held('g1', id));
                if (target === null) continue;
                checked += 1;
                expect(target).not.toBe(id);
                expect(isRewardable(target)).toBe(true);
                expect(ProgramRegistry[target].element).toBe(ProgramRegistry[id].element);
                expect(ProgramRegistry[target].rarity).toBe(ProgramRegistry[id].rarity);
            }
        }
        expect(checked).toBeGreaterThan(5);
    });

    it('trades an upgraded card as the base card it upgrades', () => {
        const ctx = ctxFor(makeRun());
        const plus = Object.keys(ProgramRegistry).find((id) => ProgramRegistry[id].upgradeOf && ProgramRegistry[ProgramRegistry[id].upgradeOf!]?.rarity === 'Common')!;
        const target = tradeUpTarget(ctx, { ...held('g1', plus), upgraded: true })!;
        expect(target).not.toBe(ProgramRegistry[plus].upgradeOf);
        expect(ProgramRegistry[target].rarity).toBe('Uncommon');
    });
});

describe('the Driver Shrine and the The Runecarver offers', () => {
    it('never offers a Driver the run holds, or a temporary one', () => {
        const ctx = ctxFor(makeRun({ drivers: [PLAYER_DRIVER_IDS[0]] }));
        for (let i = 0; i < 20; i += 1) {
            const offered = offerDrivers({ ...ctx, run: { ...ctx.run, seed: `s${i}` } }, 2, 'pick:1');
            expect(offered).toHaveLength(2);
            expect(offered).not.toContain(PLAYER_DRIVER_IDS[0]);
            for (const id of offered) {
                expect(PLAYER_DRIVER_IDS).toContain(id);
                expect(TEMPORARY_DRIVER_IDS).not.toContain(id);
            }
        }
    });

    it('offers what is left when the run holds all but one', () => {
        const ctx = ctxFor(makeRun({ drivers: PLAYER_DRIVER_IDS.slice(1) }));
        expect(offerDrivers(ctx, 2, 'pick:1')).toEqual([PLAYER_DRIVER_IDS[0]]);
    });

    it('offers each unpatched body its best patch, and leaves a patched body out', () => {
        const ctx = ctxFor(makeRun());
        const offers = patchOffers(ctx);
        expect(offers.map((o) => o.memberId)).toEqual(['mm1']);
        expect(patchOffers(ctxFor(makeRun({ patches: { mm1: ['amplifier'] } })))).toEqual([]);
    });
});

describe('who may draw each event', () => {
    it('Trader and Seiðr Cauldron need a card that can be given up', () => {
        const floor = minimumActiveDeck(1);
        const stuck = ctxFor(makeRun({ deck: makeRun().deck.slice(0, floor), collection: [] }));
        const spare = ctxFor(runWithSpare(1));
        for (const id of ['trader', 'recompiler']) {
            expect(isEventEligible(id, spare), id).toBe(true);
            expect(isEventEligible(id, stuck), id).toBe(false);
        }
    });

    it('Loki\'s Mirror needs a non-junk card', () => {
        expect(isEventEligible('mirror_protocol', ctxFor(makeRun()))).toBe(true);
        expect(isEventEligible('mirror_protocol', ctxFor(makeRun({ deck: [held('j1', JUNK_CARD_ID)], collection: [] })))).toBe(false);
    });

    it('The Toll needs 30 scrap or a card to give, and is ineligible with neither', () => {
        const floor = minimumActiveDeck(1);
        const stuck = makeRun({ deck: makeRun().deck.slice(0, floor), collection: [] });
        expect(isEventEligible('the_toll', ctxFor({ ...stuck, scrap: 30 }))).toBe(true);
        expect(isEventEligible('the_toll', ctxFor({ ...stuck, scrap: 25 }))).toBe(false);
        expect(isEventEligible('the_toll', ctxFor(runWithSpare(1, { scrap: 0 })))).toBe(true);
    });

    it('Driver Shrine needs a Driver left to offer and an offering the player can make', () => {
        const floor = minimumActiveDeck(1);
        const stuck = makeRun({ deck: makeRun().deck.slice(0, floor), collection: [] });
        expect(isEventEligible('driver_shrine', ctxFor(runWithSpare(2)))).toBe(true);
        expect(isEventEligible('driver_shrine', ctxFor(stuck))).toBe(false);
        expect(isEventEligible('driver_shrine', ctxFor(stuck, { blueprints: { fenrir: 1 } }))).toBe(true);
        expect(isEventEligible('driver_shrine', ctxFor(makeRun({ drivers: [...PLAYER_DRIVER_IDS] })))).toBe(false);
    });

    it('The Runecarver needs an unpatched body', () => {
        expect(isEventEligible('black_market_patch', ctxFor(makeRun()))).toBe(true);
        expect(isEventEligible('black_market_patch', ctxFor(makeRun({ patches: { mm1: ['amplifier'] } })))).toBe(false);
    });
});

describe('the power cap, end to end', () => {
    /** A run whose history already holds one resolved event that granted `grant`. */
    function granted(eventId: string, grant: 'driver' | 'patch'): IRunState {
        return makeRun({ eventHistory: [{ nodeId: 'elsewhere', eventId, choiceId: 'x', grants: [grant] }] });
    }

    it('after the Driver Shrine grants a Driver, it is never drawn again', () => {
        const ctx = ctxFor(granted('driver_shrine', 'driver'));
        const only = new Set(['driver_shrine']);
        expect(drawEvent(ctx.run, ctx.node, ctx.ranch, { built: only })).toBeNull();
        // While nothing has been granted, the same draw finds it.
        const fresh = ctxFor(runWithSpare(2));
        expect(drawEvent(fresh.run, fresh.node, fresh.ranch, { built: only })?.id).toBe('driver_shrine');
    });

    it('after the The Runecarver fits a patch, it is never drawn again', () => {
        const ctx = ctxFor(granted('black_market_patch', 'patch'));
        const only = new Set(['black_market_patch']);
        expect(drawEvent(ctx.run, ctx.node, ctx.ranch, { built: only })).toBeNull();
        const fresh = ctxFor(makeRun());
        expect(drawEvent(fresh.run, fresh.node, fresh.ranch, { built: only })?.id).toBe('black_market_patch');
    });
});

describe('the six events are built, with every choice playable', () => {
    it('are in BUILT_EVENTS', () => {
        for (const id of ['trader', 'mirror_protocol', 'recompiler', 'the_toll', 'driver_shrine', 'black_market_patch']) {
            expect(BUILT_EVENTS.has(id), id).toBe(true);
            const event = getEvent(id)!;
            expect(playableChoices(event).map((c) => c.id), id).toEqual(event.choices.map((c) => c.id));
        }
    });
});
