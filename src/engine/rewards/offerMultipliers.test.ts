/**
 * TICKET 185e — **WHO IS PLAYING BENDS THE OFFER: SYNERGY ×2, MISSING PAYOFF ×3, NEVER STACKED.**
 *
 * Synergy ×2: a card whose `cur` matches a currency of ANY party firmware.
 * Missing-payoff ×3: replaces the synergy multiplier, for a payoff (shape `scalar` or `consume`) of a
 * party currency when the run's cards (deck plus collection) hold no payoff of it.
 */
import { describe, it, expect } from 'vitest';
import { ProgramRegistry } from '../data/programRegistry';
import {
    MISSING_PAYOFF_MULTIPLIER, RARITY_WEIGHTS, SYNERGY_MULTIPLIER, offerTasteForRun, rarityOfCard, rewardCardPool, rollDropTable,
} from '../RewardSystem';
import { createSparseEntity } from '../../debug/scenarios/scenarioTestSupport';
import { partyCurrencies } from './partyCurrencies';
import { missingPayoffCurrencies } from './missingPayoffs';
import { weighCandidates } from './weightedCardPick';
import type { IBattleEntity } from '../types';

const FENRIR_V1 = [{ definitionId: 'fenrir', activeOS: 'fenrir_v1' }];

describe('ticket 185e — the two numbers', () => {
    it('are named beside RARITY_WEIGHTS and are the ruled ×2 and ×3', () => {
        expect(SYNERGY_MULTIPLIER).toBe(2);
        expect(MISSING_PAYOFF_MULTIPLIER).toBe(3);
    });
});

describe('ticket 185e — a party\'s currencies', () => {
    it('are the union of its firmware\'s', () => {
        expect([...partyCurrencies(FENRIR_V1)].sort()).toEqual(['HP', 'Strength']);
        expect([...partyCurrencies([{ activeOS: 'skoll_v1' }])]).toEqual(['Strength']);
        expect([...partyCurrencies([{ activeOS: 'fenrir_v1' }, { activeOS: 'skoll_v1' }, { activeOS: 'kraken_v1' }])].sort())
            .toEqual(['Dazed', 'HP', 'Strength', 'cards']);
    });

    it('are empty for a member with no firmware or one the grammar does not cover', () => {
        expect(partyCurrencies([{}, { activeOS: 'no_such_firmware' }]).size).toBe(0);
    });
});

describe('ticket 185e — which currencies still have no payoff in the run', () => {
    const currencies = new Set(['Strength', 'HP']);

    it('is all of them for a run holding nothing', () => {
        expect([...missingPayoffCurrencies(currencies, [])].sort()).toEqual(['HP', 'Strength']);
    });

    it('stops being missing the moment a payoff of that currency is held', () => {
        expect([...missingPayoffCurrencies(currencies, ['sun_devourer'])]).toEqual(['HP']);
        expect([...missingPayoffCurrencies(currencies, ['sun_devourer', 'ragnarok_edge'])]).toEqual([]);
    });

    it('counts an upgraded payoff as the payoff it is a mark on', () => {
        expect([...missingPayoffCurrencies(currencies, ['sun_devourer+'])]).toEqual(['HP']);
    });

    it('does not count an enabler: it feeds the currency, it does not pay it', () => {
        expect(ProgramRegistry.fury_strike.shape).toBe('enabler');
        expect([...missingPayoffCurrencies(currencies, ['fury_strike', 'howl'])].sort()).toEqual(['HP', 'Strength']);
    });

    it('does not count a payoff of a currency the party does not run on', () => {
        expect([...missingPayoffCurrencies(currencies, ['thermal_overload'])].sort()).toEqual(['HP', 'Strength']);
    });
});

describe('ticket 185e — the multiplier a card gets', () => {
    const none = offerTasteForRun(FENRIR_V1, [], []);
    const holdsStrengthPayoff = offerTasteForRun(FENRIR_V1, ['sun_devourer'], []);

    it('is ×3 for a payoff of a currency the run has no payoff for', () => {
        for (const id of ['core_overclock', 'flare_burst', 'pack_tactics', 'brute_force', 'unbound_fang', 'sun_devourer']) {
            expect(none.multiplierOf(id), id).toBe(3);
        }
        expect(none.multiplierOf('ragnarok_edge'), 'the HP payoff').toBe(3);
    });

    it('is ×2 for any other card of a party currency (an enabler, glue)', () => {
        expect(none.multiplierOf('fury_strike')).toBe(2);
        expect(none.multiplierOf('howl')).toBe(2);
        expect(none.multiplierOf('crimson_draw')).toBe(2);
    });

    it('is 1 for a card of another currency and for a card with none', () => {
        expect(none.multiplierOf('thermal_overload')).toBe(1);
        expect(none.multiplierOf('ignite')).toBe(1);
        expect(ProgramRegistry.tackle.cur).toBe('—');
        expect(none.multiplierOf('tackle')).toBe(1);
        expect(none.multiplierOf('no_such_card')).toBe(1);
    });

    it('replaces the synergy multiplier, never stacks with it', () => {
        const seen = new Set<number>();
        for (const id of Object.keys(ProgramRegistry)) seen.add(none.multiplierOf(id));
        expect([...seen].sort()).toEqual([1, 2, 3]);
    });

    it('drops a Strength payoff to the synergy rate once the run holds one', () => {
        expect(holdsStrengthPayoff.multiplierOf('core_overclock')).toBe(2);
        expect(holdsStrengthPayoff.multiplierOf('pack_tactics')).toBe(2);
        // The HP payoff is still missing.
        expect(holdsStrengthPayoff.multiplierOf('ragnarok_edge')).toBe(3);
        // A payoff sitting in the collection counts as held: the run's cards are deck plus collection.
        expect(offerTasteForRun(FENRIR_V1, ['sun_devourer+'], []).multiplierOf('core_overclock')).toBe(2);
    });

    it('is 1 for everything when the party has no firmware that names a currency', () => {
        const nobody = offerTasteForRun([{ definitionId: 'fenrir', activeOS: 'no_such_firmware' }], [], []);
        for (const id of ['core_overclock', 'fury_strike', 'ignite']) expect(nobody.multiplierOf(id)).toBe(1);
    });

    it('uses ANY party firmware: a fenrir_v1 + kraken_v1 party boosts both Strength and cards', () => {
        const mixed = offerTasteForRun([...FENRIR_V1, { definitionId: 'kraken', activeOS: 'kraken_v1' }], [], []);
        expect(mixed.multiplierOf('fury_strike')).toBe(2);
        const cardsCard = Object.keys(ProgramRegistry).find((id) => ProgramRegistry[id].cur === 'cards' && ProgramRegistry[id].shape === 'enabler')!;
        expect(mixed.multiplierOf(cardsCard)).toBe(2);
        expect(none.multiplierOf(cardsCard)).toBe(1);
    });
});

describe('ticket 185e — in the weights', () => {
    const pool = rewardCardPool(FENRIR_V1);
    const weightsFor = (owned: string[]): Map<string, number> => {
        const taste = offerTasteForRun(FENRIR_V1, owned, []);
        return new Map(weighCandidates(pool, rarityOfCard, RARITY_WEIGHTS, taste.multiplierOf, 'fallToCommon').map((w) => [w.cardId, w.weight]));
    };
    const neutral = new Map(weighCandidates(pool, rarityOfCard, RARITY_WEIGHTS, () => 1, 'fallToCommon').map((w) => [w.cardId, w.weight]));

    it('puts a Strength payoff at exactly 3× its plain weight when none is held', () => {
        const id = pool.find((card) => ProgramRegistry[card].cur === 'Strength' && ProgramRegistry[card].shape === 'scalar')!;
        expect(id, 'the fenrir_v1 pool should hold a Strength scalar').toBeDefined();
        expect(weightsFor([]).get(id)).toBeCloseTo(neutral.get(id)! * 3, 12);
    });

    it('puts it at exactly 2× once the run holds a Strength payoff', () => {
        const id = pool.find((card) => ProgramRegistry[card].cur === 'Strength' && ProgramRegistry[card].shape === 'scalar')!;
        expect(weightsFor(['sun_devourer']).get(id)).toBeCloseTo(neutral.get(id)! * 2, 12);
    });

    it('leaves a card of another currency at its plain weight', () => {
        const id = pool.find((card) => ProgramRegistry[card].cur !== undefined && !['Strength', 'HP'].includes(ProgramRegistry[card].cur!))!;
        expect(weightsFor([]).get(id)).toBeCloseTo(neutral.get(id)!, 12);
    });
});

describe('ticket 185e — in a fight\'s reward, over seeded rolls', () => {
    const corpse = (id: string): IBattleEntity => createSparseEntity({ id, definitionId: 'fyrbot', name: 'Foe', currentHp: 0 });
    const strengthPayoffs = new Set(Object.keys(ProgramRegistry).filter((id) => ProgramRegistry[id].cur === 'Strength'
        && (ProgramRegistry[id].shape === 'scalar' || ProgramRegistry[id].shape === 'consume')));

    /** How many offered cards, over 1,000 fights, were a Strength payoff. */
    function strengthPayoffsShown(party: Array<{ definitionId: string; activeOS?: string }>, ownedCardIds: string[]): number {
        let shown = 0;
        for (let i = 0; i < 1000; i += 1) {
            const bundle = rollDropTable({
                defeated: [corpse('e0')], nodeKind: 'wild', party, seed: `strength-${i}`, ownedCardIds,
            });
            shown += bundle.cardChoices[0].options.filter((option) => strengthPayoffs.has(option.dataId)).length;
        }
        return shown;
    }

    it('shows a fenrir_v1 party Strength payoffs more often while it holds none, then less once it does', () => {
        const plain = strengthPayoffsShown([{ definitionId: 'fenrir' }], []);
        const holding = strengthPayoffsShown(FENRIR_V1, ['sun_devourer']);
        const missing = strengthPayoffsShown(FENRIR_V1, []);
        expect(missing, 'missing-payoff boost').toBeGreaterThan(holding);
        expect(holding, 'synergy boost').toBeGreaterThan(plain);
    });

    it('is deterministic: the same fight and the same run offer the same cards', () => {
        const roll = () => rollDropTable({
            defeated: [corpse('e0')], nodeKind: 'wild', party: FENRIR_V1, seed: 'same-fight', ownedCardIds: [], recentOffers: [],
        });
        expect(roll()).toEqual(roll());
    });
});
