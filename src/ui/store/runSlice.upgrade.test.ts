/**
 * TICKET 163b — THE UPGRADE BENCH'S REDUCER.
 *
 * `plusRegistry.test.ts` proves the `+` cards exist and are shaped right. This proves what pressing
 * the button does to the run, which is the failure with teeth, and it is asserted against the
 * reducer alone with no screen in the way — the marketplace suite's argument, and it applies harder
 * here because this verb has THREE screens (the market stall, the workshop, the gym gate) and a
 * check that lives in one of them is a check the other two do not have.
 *
 * Four things this file is really about:
 *
 * - **In place.** The instance keeps its id and changes which card it points at. A player holding
 *   two copies upgrades ONE, and a mint-and-delete would have made which one a coin flip.
 * - **The price is re-derived, never trusted.** `buyMarketCard` takes a price because a shop
 *   offer's price is rolled with the stock. An upgrade's is a pure function of the card, so a
 *   caller cannot name one — the only thing a venue may say is `free`.
 * - **One per visit, per bench.** Henry ruled the bench appears at both stops (2026-09-24), so the
 *   allowance is per node per visit and `benchKey` is what spends it.
 * - **Silent no-op on anything invalid**, byte-identical. The slice's standing convention, and the
 *   reason every refusal below asserts the whole run and not just the scrap.
 */

import { describe, expect, it } from 'vitest';

import runReducer, { upgradeDeckCard, type RunSliceState } from './runSlice';
import { createRun } from '../../engine/run/createRun';
import { offerGyms } from '../../engine/run/gyms';
import { upgradePrice, UPGRADE_PRICE_BY_ENERGY, GYM_GATE_UPGRADE_PRICE } from '../../engine/run/marketplace';
import { upgradeIdFor, hasUpgrade, isUpgraded } from '../../engine/data/plusRegistry';
import type { IMingmingState } from '../../engine/types';
import type { IRunState, IRunCard } from '../../engine/runTypes';

const PARTY: IMingmingState[] = [
    { id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1', blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10 },
];

function makeRun(scrap = 500): IRunState {
    const run = createRun({
        seed: 'upgrade-reducer-seed',
        offer: offerGyms('offer-seed')[0],
        party: PARTY,
        startedAt: 1_700_000_000_000,
    });
    return { ...run, scrap };
}

const stateOf = (run: IRunState): RunSliceState => ({ run });

/** The first card in the starting deck that has a `+` authored for it. */
function upgradable(run: IRunState): IRunCard {
    const card = run.deck.find((c) => hasUpgrade(c.dataId));
    expect(card, 'the starting deck holds nothing upgradable — the fixture is wrong').toBeDefined();
    return card!;
}

const BENCH = 'node-7:1';

describe('163b — upgrading a card in the active deck', () => {
    it('swaps the instance to its `+` and charges, in one action', () => {
        const run = makeRun(500);
        const card = upgradable(run);
        const price = upgradePrice(card.dataId);

        const after = runReducer(stateOf(run), upgradeDeckCard({ instanceId: card.instanceId, benchKey: BENCH })).run!;

        const now = after.deck.find((c) => c.instanceId === card.instanceId)!;
        expect(now.dataId).toBe(upgradeIdFor(card.dataId));
        expect(now.upgraded).toBe(true);
        expect(after.scrap).toBe(run.scrap - price);
        expect(after.upgradesTaken).toContain(BENCH);
    });

    it('keeps the deck the same size and touches no other copy', () => {
        /*
         * The starting deck holds duplicates by design. "Upgrade a Venom Fang" is not an
         * instruction anyone can carry out correctly, which is why the verb is keyed on
         * `instanceId` — and this is the assertion that says the key is being honoured.
         */
        const run = makeRun(500);
        const card = upgradable(run);
        const siblings = run.deck.filter((c) => c.dataId === card.dataId && c.instanceId !== card.instanceId);

        const after = runReducer(stateOf(run), upgradeDeckCard({ instanceId: card.instanceId })).run!;

        expect(after.deck).toHaveLength(run.deck.length);
        for (const sibling of siblings) {
            expect(after.deck.find((c) => c.instanceId === sibling.instanceId)!.dataId).toBe(sibling.dataId);
        }
        // And the instance kept everything about itself except which card it is.
        const now = after.deck.find((c) => c.instanceId === card.instanceId)!;
        expect(now.ownerId).toBe(card.ownerId);
        expect(now.instanceId).toBe(card.instanceId);
    });

    it('agrees with itself: `upgraded` is set exactly when the id is an upgrade', () => {
        // The flag is redundant with `dataId` on purpose (163 §5's persistence door). Redundant
        // state that nothing checks is how two fields start disagreeing.
        const run = makeRun(500);
        const card = upgradable(run);
        const after = runReducer(stateOf(run), upgradeDeckCard({ instanceId: card.instanceId })).run!;
        for (const held of after.deck) {
            expect(held.upgraded === true, held.dataId).toBe(isUpgraded(held.dataId));
        }
    });

    it('is free at the gym gate, and the price is the only thing a venue may name', () => {
        const run = makeRun(500);
        const card = upgradable(run);

        const free = runReducer(stateOf(run), upgradeDeckCard({ instanceId: card.instanceId, free: true })).run!;
        expect(free.scrap).toBe(run.scrap);
        expect(free.deck.find((c) => c.instanceId === card.instanceId)!.upgraded).toBe(true);
        expect(GYM_GATE_UPGRADE_PRICE).toBe(0);

        // `free` and the allowance are independent: the gate spends its bench key exactly as a
        // paid bench does, it just charges nothing for it.
        const gated = runReducer(stateOf(run), upgradeDeckCard({ instanceId: card.instanceId, benchKey: BENCH, free: true })).run!;
        expect(gated.scrap).toBe(run.scrap);
        expect(gated.upgradesTaken).toContain(BENCH);
    });
});

describe('163b — what the bench refuses, byte for byte', () => {
    const refuses = (run: IRunState, payload: Parameters<typeof upgradeDeckCard>[0]): void => {
        const after = runReducer(stateOf(run), upgradeDeckCard(payload)).run!;
        expect(after).toEqual(run);
    };

    it('refuses when the scrap is short', () => {
        const run = makeRun(500);
        const card = upgradable(run);
        refuses({ ...run, scrap: upgradePrice(card.dataId) - 1 }, { instanceId: card.instanceId });
    });

    it('refuses an instance that is not in the deck', () => {
        const run = makeRun(500);
        refuses(run, { instanceId: 'not-a-card' });
        // Including one in the COLLECTION — 163 §2 says the ACTIVE DECK, and a bench that reached
        // the collection would make upgrading a stockpiling decision instead of a deck one.
        const card = upgradable(run);
        const stored = { ...run, deck: run.deck.filter((c) => c !== card), collection: [card] };
        refuses(stored, { instanceId: card.instanceId });
    });

    it('refuses a second rung — an upgraded card has no upgrade', () => {
        const run = makeRun(500);
        const card = upgradable(run);
        const once = runReducer(stateOf(run), upgradeDeckCard({ instanceId: card.instanceId })).run!;
        refuses(once, { instanceId: card.instanceId });
    });

    it('refuses a second upgrade at the same bench on the same visit', () => {
        const run = makeRun(500);
        const [first, second] = run.deck.filter((c) => hasUpgrade(c.dataId));
        expect(second, 'need two upgradable cards for this case').toBeDefined();

        const once = runReducer(stateOf(run), upgradeDeckCard({ instanceId: first.instanceId, benchKey: BENCH })).run!;
        refuses(once, { instanceId: second.instanceId, benchKey: BENCH });

        // A DIFFERENT bench, or the same one on a later visit, is a fresh allowance — walking back
        // costs the wilds on the way, which is ticket 07's answer to farming.
        const elsewhere = runReducer(stateOf(once), upgradeDeckCard({ instanceId: second.instanceId, benchKey: 'node-7:2' })).run!;
        expect(elsewhere.deck.find((c) => c.instanceId === second.instanceId)!.upgraded).toBe(true);
    });

    it('refuses a card with no `+` authored, rather than minting a broken id', () => {
        const run = makeRun(500);
        const card = upgradable(run);
        const orphan: IRunCard = { ...card, instanceId: 'orphan', dataId: 'not_a_real_card' };
        refuses({ ...run, deck: [...run.deck, orphan] }, { instanceId: 'orphan' });
    });
});

describe('163b — the price band Henry ruled', () => {
    it('is 25–40 across the four rungs, flatter than buying', () => {
        // 163 §2's band. Flatter than `CARD_PRICE_BY_ENERGY` (15–45) because an upgrade is roughly
        // the same size of favour whatever it lands on; see `UPGRADE_PRICE_BY_ENERGY`.
        expect([...UPGRADE_PRICE_BY_ENERGY]).toEqual([25, 30, 35, 40]);
        expect(Math.min(...UPGRADE_PRICE_BY_ENERGY)).toBeGreaterThanOrEqual(25);
        expect(Math.max(...UPGRADE_PRICE_BY_ENERGY)).toBeLessThanOrEqual(40);
    });

    it('prices an unknown id at the cheapest rung rather than throwing', () => {
        // `cardPrice`'s rule, same reason: a price is asked for by a render.
        expect(upgradePrice('not_a_real_card')).toBe(UPGRADE_PRICE_BY_ENERGY[0]);
    });
});
