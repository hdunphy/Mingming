/**
 * TICKET 169g — Tight Budget: every price paid at a marketplace or workshop goes up by 25%, rounded
 * up to the next multiple of 5.
 *
 * Two halves. The table is the rule itself, row for row from the ticket. The site tests then check
 * that each place the game quotes a price actually asks `shopPrice`, because a rule that only
 * exists in a helper nobody calls would pass the table and change nothing.
 */

import { describe, expect, it } from 'vitest';

import type { IMingmingState } from '../../types';
import type { IRanchMember, IRanchState, IRunState } from '../../runTypes';
import { createRun } from '../createRun';
import { offerGyms } from '../gyms';
import {
    JUNK_REMOVAL_PRICE,
    MARKET_BLUEPRINT_PRICE,
    MARKET_REFRESH_PRICE,
    cardPrice,
    isMarketNode,
    macroPrice,
    rollBlueprintOffer,
    rollMacroStock,
    rollMarketStock,
    upgradedCardPrice,
} from '../marketplace';
import { WORKSHOP_ASSEMBLY_SCRAP, WORKSHOP_REFLASH_SCRAP, planRecruit, planReflash, isWorkshopNode } from '../workshop';
import { shopPrice } from './shopPrice';

const KRAKEN: IMingmingState = {
    id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1',
    blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10,
};

const rosterMember = (id: string, definitionId: string, activeOS: string): IRanchMember => ({
    id, definitionId, activeOS, attackIV: 10, defenseIV: 10, hpIV: 10,
});

const makeRun = (modifiers: string[] = []): IRunState =>
    createRun({ seed: 'tight-budget', offer: offerGyms('offer-seed')[0], party: [KRAKEN], startedAt: 0, modifiers });

const PLAIN = makeRun();
const TIGHT = makeRun(['tight_budget']);

const makeRanch = (blueprints: Record<string, number>, roster: IRanchMember[]): IRanchState => ({
    roster, blueprints, codex: { seen: [], played: [], species: [], assembled: [], os: [] },
    gymsCleared: [], highestTierCleared: 0, tierClears: {}, seenTips: [], codexMilestones: [],
});

describe('shopPrice — the table', () => {
    const ROWS: Array<[string, number[], number[]]> = [
        ['cards', [15, 25, 35, 45], [20, 35, 45, 60]],
        ['upgrades', [25, 30, 35, 40], [35, 40, 45, 50]],
        ['macros', [32, 48], [40, 60]],
        ['blueprint and refresh', [50], [65]],
        ['junk removal', [25], [35]],
        ['shop patch', [45], [60]],
    ];

    for (const [name, bases, raised] of ROWS) {
        it(`raises ${name} ${bases.join(' / ')} to ${raised.join(' / ')}`, () => {
            expect(bases.map((base) => shopPrice(TIGHT, base))).toEqual(raised);
        });
    }

    it('leaves a price of 0 at 0 (the gym gate upgrade and free event upgrades)', () => {
        expect(shopPrice(TIGHT, 0)).toBe(0);
    });

    it('changes nothing without the modifier', () => {
        for (const base of [0, 15, 25, 32, 35, 45, 48, 50]) expect(shopPrice(PLAIN, base)).toBe(base);
    });

    it('ignores other modifiers', () => {
        expect(shopPrice(makeRun(['junk_start']), 25)).toBe(25);
    });

    it('always lands on a multiple of 5, never below the plain price, from any base', () => {
        for (let base = 1; base <= 200; base++) {
            const out = shopPrice(TIGHT, base);
            expect(out % 5).toBe(0);
            expect(out).toBeGreaterThanOrEqual(base);
        }
    });
});

describe('shopPrice — the sites that quote a price', () => {
    const market = (run: IRunState) => run.nodes.filter((node) => isMarketNode(node.kind))[0];
    const party = [KRAKEN];

    it('market card offers, plain and upgraded, carry the raised price', () => {
        const plain = rollMarketStock({ run: PLAIN, node: market(PLAIN), party });
        const tight = rollMarketStock({ run: TIGHT, node: market(TIGHT), party });

        expect(tight.offers.map((o) => o.card.dataId)).toEqual(plain.offers.map((o) => o.card.dataId));
        for (const offer of tight.offers) {
            const base = offer.slot === 'upgraded' ? upgradedCardPrice(offer.card.dataId) : cardPrice(offer.card.dataId);
            expect(offer.price).toBe(shopPrice(TIGHT, base));
        }
        for (const offer of plain.offers) {
            const base = offer.slot === 'upgraded' ? upgradedCardPrice(offer.card.dataId) : cardPrice(offer.card.dataId);
            expect(offer.price).toBe(base);
        }
    });

    it('the macro shelf carries the raised price', () => {
        const plain = rollMacroStock({ run: PLAIN, node: market(PLAIN), party });
        const tight = rollMacroStock({ run: TIGHT, node: market(TIGHT), party });

        expect(tight.map((o) => o.macroId)).toEqual(plain.map((o) => o.macroId));
        for (const offer of tight) expect(offer.price).toBe(shopPrice(TIGHT, macroPrice(offer.macroId)));
        for (const offer of plain) expect(offer.price).toBe(macroPrice(offer.macroId));
    });

    it('the market blueprint carries the raised price', () => {
        expect(rollBlueprintOffer(PLAIN, market(PLAIN))!.price).toBe(MARKET_BLUEPRINT_PRICE);
        expect(rollBlueprintOffer(TIGHT, market(TIGHT))!.price).toBe(65);
    });

    it('the workshop recruit is 35 instead of 25', () => {
        const ranch = makeRanch({ fenrir: 1 }, [rosterMember('mm1', 'kraken', 'kraken_v1')]);
        const node = { ...TIGHT.nodes.find((n) => isWorkshopNode(n.kind))!, visited: 1 };

        const plain = planRecruit({ ranch, run: PLAIN, node, speciesId: 'fenrir' })!;
        const tight = planRecruit({ ranch, run: TIGHT, node, speciesId: 'fenrir' })!;
        expect(plain.scrap).toBe(WORKSHOP_ASSEMBLY_SCRAP);
        expect(tight.scrap).toBe(35);
        // Only the price moves: the same body and the same five cards.
        expect(tight.cards).toEqual(plain.cards);
    });

    it('the workshop reflash is 20 instead of 15', () => {
        const member = rosterMember('mm1', 'kraken', 'kraken_v1');
        const ranch = makeRanch({ kraken: 1 }, [member]);
        const node = { ...TIGHT.nodes.find((n) => isWorkshopNode(n.kind))!, visited: 1 };

        const plain = planReflash({ ranch, run: PLAIN, node, member, targetOS: 'kraken_v2' })!;
        const tight = planReflash({ ranch, run: TIGHT, node, member, targetOS: 'kraken_v2' })!;
        expect(plain.scrap).toBe(WORKSHOP_REFLASH_SCRAP);
        expect(tight.scrap).toBe(20);
    });

    it('the constants the UI sites start from are the ruled bases', () => {
        // The stall refresh, junk removal, upgrade and patch sites price from these; if one moves,
        // the ticket's table moves with it and this fails first.
        expect([MARKET_REFRESH_PRICE, JUNK_REMOVAL_PRICE]).toEqual([50, 25]);
        expect(shopPrice(TIGHT, MARKET_REFRESH_PRICE)).toBe(65);
        expect(shopPrice(TIGHT, JUNK_REMOVAL_PRICE)).toBe(35);
    });
});
