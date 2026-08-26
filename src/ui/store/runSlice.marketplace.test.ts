/**
 * THE MARKETPLACE'S REDUCERS — ticket 13.
 *
 * `engine/run/marketplace.test.ts` proves what things cost and what is on the shelf. This proves
 * what pressing the button does to the run, which is a different failure and the one with teeth:
 *
 * - **Atomicity.** Ticket 20's argument, applied to a shop: a check that lives only in a component
 *   is a check that races. Every assertion below is made against the reducer alone, with no screen
 *   in the way, because that is the layer that has to refuse an unaffordable purchase — the screen's
 *   disabled button is a courtesy to the player, not the enforcement.
 * - **Silent no-op on invalid**, the slice's standing convention. A refused action must leave the
 *   run *byte-identical*, not merely unpaid: a purchase that charged and delivered nothing, or
 *   delivered and charged nothing, are both reachable if the two halves are two dispatches.
 * - **Removing one specific instance.** A deck holds the run's two identical generics — and a kit
 *   can double a card of its own besides — so "remove a `water_slap`" is not an instruction anyone
 *   can carry out correctly. The sink is keyed on `instanceId`, and the paid-removal case below
 *   proves the deck thins by exactly one.
 * - **Scrap is run-scoped and dies with the run** (ticket 06's anti-mudflation line) — the shop
 *   must not be a way to move value out of a run.
 *
 * **Ticket 57 deleted this file's `describe('selling')` block.** Henry ruled (ticket 56) that cards
 * cannot be sold — removal is a pure sink, so the market takes scrap and never gives it, and there
 * is no longer a marketplace action that *adds* scrap for a card to test. The three cases that went
 * (one specific instance paid for, a ghost instance paying nothing, a double click not minting
 * scrap) all guarded an income line that no longer exists; the instance-keying half of that survives
 * against `removeRunCardForScrap`.
 */

import { describe, expect, it } from 'vitest';

import runReducer, {
    addRunScrap,
    buyMarketCard,
    clearRun,
    endRun,
    removeRunCardForScrap,
    rerollMarketStock,
    startRun,
    type RunSliceState,
} from './runSlice';
import { createRun } from '../../engine/run/createRun';
import { offerGyms } from '../../engine/run/gyms';
import {
    REMOVAL_PRICE,
    REROLL_PRICE,
    rollMarketStock,
} from '../../engine/run/marketplace';
import { GENERIC_HIT } from '../../engine/data/mingmingRegistry';
import type { IMingmingState } from '../../engine/types';
import type { IRunState } from '../../engine/runTypes';

const PARTY: IMingmingState[] = [
    { id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1', blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10 },
];

function makeRun(scrap = 0): IRunState {
    const run = createRun({
        seed: 'market-reducer-seed',
        offer: offerGyms('offer-seed')[0],
        party: PARTY,
        startedAt: 1_700_000_000_000,
    });
    return { ...run, scrap };
}

/** Stand the run on its first marketplace, as `enterNode` would leave it. */
function atMarket(run: IRunState): IRunState {
    const market = run.nodes.find((n) => n.kind === 'marketplace')!;
    return {
        ...run,
        currentNodeId: market.id,
        nodes: run.nodes.map((n) => (n.id === market.id ? { ...n, visited: n.visited + 1 } : n)),
    };
}

function marketNode(run: IRunState) {
    return run.nodes.find((n) => n.id === run.currentNodeId)!;
}

function stockOf(run: IRunState) {
    return rollMarketStock({ run, node: marketNode(run), party: PARTY });
}

const stateOf = (run: IRunState): RunSliceState => ({ run });

describe('buying', () => {
    it('takes the scrap and adds the exact card the offer showed, in one action', () => {
        const run = atMarket(makeRun(200));
        const offer = stockOf(run).offers[0];

        const after = runReducer(stateOf(run), buyMarketCard({ card: offer.card, price: offer.price })).run!;

        expect(after.scrap).toBe(200 - offer.price);
        expect(after.deck.length).toBe(run.deck.length + 1);
        // The exact minted instance, not a copy of its dataId — that identity is what makes the
        // offer show as sold after a resume.
        expect(after.deck[after.deck.length - 1]).toEqual(offer.card);
    });

    it('refuses a purchase the run cannot afford, and changes NOTHING', () => {
        const run = atMarket(makeRun(5));
        const offer = stockOf(run).offers[0];
        expect(offer.price).toBeGreaterThan(5);

        const after = runReducer(stateOf(run), buyMarketCard({ card: offer.card, price: offer.price })).run!;

        // Not "did not charge" — identical. A partially-applied purchase is the bug this reducer
        // exists to make unrepresentable.
        expect(after).toEqual(run);
    });

    it('affords a purchase that costs exactly the scrap held', () => {
        const run = atMarket(makeRun(0));
        const offer = stockOf(run).offers[0];
        const exact = { ...run, scrap: offer.price };

        const after = runReducer(stateOf(exact), buyMarketCard({ card: offer.card, price: offer.price })).run!;
        expect(after.scrap).toBe(0);
        expect(after.deck.length).toBe(run.deck.length + 1);
    });

    it('refuses to buy the same offer twice — the stock is a stock', () => {
        const run = atMarket(makeRun(500));
        const offer = stockOf(run).offers[0];

        const once = runReducer(stateOf(run), buyMarketCard({ card: offer.card, price: offer.price }));
        const twice = runReducer(once, buyMarketCard({ card: offer.card, price: offer.price }));

        expect(twice.run!.deck.length).toBe(once.run!.deck.length);
        expect(twice.run!.scrap).toBe(once.run!.scrap);
        // Two deck cards sharing an instance id would both vanish on the first removal, which is the
        // correctness half of this guard rather than the economy half.
        const ids = twice.run!.deck.map((c) => c.instanceId);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('refuses a negative or fractional price rather than paying the player to shop', () => {
        const run = atMarket(makeRun(100));
        const offer = stockOf(run).offers[0];

        for (const price of [-10, 1.5, Number.NaN]) {
            expect(runReducer(stateOf(run), buyMarketCard({ card: offer.card, price })).run).toEqual(run);
        }
    });

    it('is a no-op with no run in progress', () => {
        const run = atMarket(makeRun(100));
        const offer = stockOf(run).offers[0];
        const empty = runReducer(undefined, { type: '@@init' });
        expect(runReducer(empty, buyMarketCard({ card: offer.card, price: offer.price })).run).toBeNull();
    });
});

// Ticket 57: `describe('selling')` stood here. Henry ruled cards cannot be sold (ticket 56) —
// removal is the only card sink, so the market takes scrap and never gives it, and the reducer these
// three cases exercised is gone from `runSlice.ts`. Nothing replaces them: there is no second sink
// to move them to, only the one below.

describe('paid removal — the only card sink', () => {
    it('charges the removal price and thins the deck by one', () => {
        const run = atMarket(makeRun(100));
        // The start deck holds the run's two identical generics (Henry, 2026-08-25: `RUN_GENERICS`,
        // once, on the first mingming — it was 3 per member under ticket 08 and 2 per member under
        // ticket 60), so "thins by exactly one" is also the instance-keying proof: a dataId-keyed
        // sink would take both. Ticket 57 left that argument here when selling — which used to
        // carry it — went. Two is still enough to make the point; one would not be.
        const target = run.deck.find((c) => c.dataId === GENERIC_HIT)!;

        const after = runReducer(
            stateOf(run),
            removeRunCardForScrap({ instanceId: target.instanceId, price: REMOVAL_PRICE }),
        ).run!;

        expect(after.scrap).toBe(100 - REMOVAL_PRICE);
        expect(after.deck.length).toBe(run.deck.length - 1);
        expect(after.deck.some((c) => c.instanceId === target.instanceId)).toBe(false);
    });

    it('refuses when the run cannot afford it, without removing the card', () => {
        const run = atMarket(makeRun(REMOVAL_PRICE - 1));
        const target = run.deck[0];

        const after = runReducer(
            stateOf(run),
            removeRunCardForScrap({ instanceId: target.instanceId, price: REMOVAL_PRICE }),
        ).run!;

        expect(after).toEqual(run);
    });

    it('charges nothing for a card that is not there', () => {
        // The atomic half of the sink: paying for a removal that did not happen is the failure a
        // component-level check would let through under a double click.
        const run = atMarket(makeRun(100));
        const after = runReducer(stateOf(run), removeRunCardForScrap({ instanceId: 'ghost', price: REMOVAL_PRICE })).run!;
        expect(after).toEqual(run);
    });
});

describe('rerolling', () => {
    it('charges the reroll and counts as another visit, which is what re-rolls the stock', () => {
        const run = atMarket(makeRun(100));
        const before = stockOf(run);

        const after = runReducer(stateOf(run), rerollMarketStock({ nodeId: run.currentNodeId, price: REROLL_PRICE })).run!;

        expect(after.scrap).toBe(100 - REROLL_PRICE);
        expect(marketNode(after).visited).toBe(marketNode(run).visited + 1);

        const restocked = rollMarketStock({ run: after, node: marketNode(after), party: PARTY });
        expect(restocked.seed).not.toBe(before.seed);
        expect(restocked.offers.map((o) => o.card.dataId)).not.toEqual(before.offers.map((o) => o.card.dataId));
    });

    it('refuses when the run cannot afford it', () => {
        const run = atMarket(makeRun(REROLL_PRICE - 1));
        expect(runReducer(stateOf(run), rerollMarketStock({ nodeId: run.currentNodeId, price: REROLL_PRICE })).run)
            .toEqual(run);
    });

    it('refuses to bump the visit count of anything that is not a marketplace', () => {
        // The one place this slice checks a node's kind before mutating it: a stray reroll naming a
        // wild would re-roll a FIGHT (ticket 07's contents-by-visit-count rule) rather than a stall.
        const run = atMarket(makeRun(100));
        const wild = run.nodes.find((n) => n.kind === 'wild')!;

        const after = runReducer(stateOf(run), rerollMarketStock({ nodeId: wild.id, price: REROLL_PRICE })).run!;
        expect(after).toEqual(run);
    });

    it('refuses an id that names no node', () => {
        const run = atMarket(makeRun(100));
        expect(runReducer(stateOf(run), rerollMarketStock({ nodeId: 'nowhere', price: REROLL_PRICE })).run).toEqual(run);
    });
});

describe('scrap stays run-scoped', () => {
    it('dies with the run rather than banking anywhere', () => {
        // Ticket 06's anti-mudflation line, restated as a shop property: nothing the marketplace does
        // can move value into the next run, because the only place the value lives is the run.
        let state = runReducer(undefined, startRun(atMarket(makeRun(0))));
        state = runReducer(state, addRunScrap(300));
        const offer = stockOf(state.run!).offers[0];
        state = runReducer(state, buyMarketCard({ card: offer.card, price: offer.price }));
        expect(state.run!.scrap).toBe(300 - offer.price);

        state = runReducer(state, endRun('victory'));
        expect(state.run!.scrap).toBe(300 - offer.price);

        state = runReducer(state, clearRun());
        expect(state.run).toBeNull();
        // And a fresh run opens at zero — `createRun` carries nothing in.
        expect(runReducer(state, startRun(makeRun())).run!.scrap).toBe(0);
    });
});
