/**
 * TICKET 168c — junk cards (Forge Slag): what one is, and every place that must ignore it.
 *
 * A junk card that is offered, scored, counted or given to an enemy is a bug that hides: the
 * reward screen looks normal, the codex reads 0 of 1 short, the floor quietly moves. So each
 * exclusion is its own case.
 */

import { describe, expect, it } from 'vitest';

import { ProgramRegistry } from '../data/programRegistry';
import { hasUpgrade } from '../data/plusRegistry';
import { codexCardIds } from '../codex';
import { isRewardable, rewardCardPool } from '../RewardSystem';
import { createRun } from './createRun';
import { offerGyms } from './gyms';
import { rollMarketStock } from './marketplace';
import { JUNK_CARD_ID, countedDeckSize, isJunkCard } from './junk';
import type { IMingmingState } from '../types';
import { plainShop } from '../../testing/plainShop';

const KRAKEN: IMingmingState = {
    id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1',
    blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10,
};

describe('Forge Slag', () => {
    const card = ProgramRegistry[JUNK_CARD_ID];

    it('is the card the ticket describes: a 1-cost exhausting Skill that does nothing', () => {
        expect(card).toBeDefined();
        expect(card.name).toBe('Forge Slag');
        expect(card.description).toBe('Does nothing. Exhaust.');
        expect(card.element).toBe('None');
        expect(card.category).toBe('Skill');
        expect(card.baseCost).toBe(1);
        expect(card.exhaust).toBe(true);
        expect(card.junk).toBe(true);
        expect(card.actions).toEqual([]);
    });

    it('is recognised as junk, and a real card is not', () => {
        expect(isJunkCard(JUNK_CARD_ID)).toBe(true);
        expect(isJunkCard('tackle')).toBe(false);
        expect(isJunkCard('no_such_card')).toBe(false);
    });
});

describe('junk is never offered or counted', () => {
    it('is not rewardable, and not in any party’s reward pool', () => {
        expect(isRewardable(JUNK_CARD_ID)).toBe(false);
        expect(rewardCardPool([{ definitionId: 'kraken' }])).not.toContain(JUNK_CARD_ID);
        expect(rewardCardPool([{ definitionId: 'kraken' }, { definitionId: 'fenrir' }])).not.toContain(JUNK_CARD_ID);
    });

    it('is never in a market’s stock', () => {
        for (let i = 0; i < 60; i += 1) {
            const run = createRun({ seed: `junk-market-${i}`, offer: offerGyms('offer-seed')[0], party: [KRAKEN], startedAt: 1 });
            const node = { ...plainShop(run, 'marketplace'), visited: 1 };
            const stock = rollMarketStock({ run, node, party: [{ definitionId: 'kraken', activeOS: 'kraken_v1' }] });
            expect(stock.offers.map((offer) => offer.card.dataId)).not.toContain(JUNK_CARD_ID);
        }
    });

    it('is not in the codex, and has no `+`', () => {
        expect(codexCardIds()).not.toContain(JUNK_CARD_ID);
        expect(hasUpgrade(JUNK_CARD_ID)).toBe(false);
    });
});

describe('the deck floor counts everything but junk', () => {
    it('counts non-junk cards only', () => {
        const deck = [
            { dataId: 'tackle' }, { dataId: JUNK_CARD_ID }, { dataId: 'tackle' }, { dataId: JUNK_CARD_ID },
        ];
        expect(countedDeckSize(deck)).toBe(2);
        expect(countedDeckSize([])).toBe(0);
    });
});
