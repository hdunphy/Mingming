/**
 * TICKET 185e — **AT MULTIPLIER 1 THE ODDS ARE EXACTLY TODAY'S.**
 *
 * Today's draw: roll a rarity by weight (Common 50 / Uncommon 30 / Rare 15 / Epic 5), then pick a
 * card of that rarity evenly. A rarity the pool has none of falls to the Common cohort and, with no
 * Common either, to the whole pool evenly. An event only ever rolls a rarity that still has a card.
 *
 * `oldFightOdds` and `oldEventOdds` below are that behaviour written out as arithmetic, separately
 * from the code under test, so the new single weighted draw is checked against the old two-step one
 * and not against itself. The new weights, normalised, must equal them for every pool tried.
 */
import { describe, it, expect } from 'vitest';
import { ProgramRegistry } from '../data/programRegistry';
import { RARITY_WEIGHTS, rewardCardPool } from '../RewardSystem';
import { PRNG } from '../core/PRNG';
import { weighCandidates } from './weightedCardPick';
import { drawOffer } from './offerDraw';
import type { Rarity } from '../types';

/** Written as literals on purpose: the old odds do not move when `RARITY_WEIGHTS` is retuned. */
const OLD_ORDER: ReadonlyArray<[Rarity, number]> = [['Common', 50], ['Uncommon', 30], ['Rare', 15], ['Epic', 5]];
const rarityOf = (id: string): Rarity => ProgramRegistry[id].rarity as Rarity;

/** The old fight roll, as a probability per card. */
function oldFightOdds(pool: string[]): Map<string, number> {
    const odds = new Map<string, number>(pool.map((id) => [id, 0]));
    const spread = (cohort: string[], p: number) => cohort.forEach((id) => odds.set(id, odds.get(id)! + p / cohort.length));
    for (const [rarity, weight] of OLD_ORDER) {
        let cohort = pool.filter((id) => rarityOf(id) === rarity);
        if (cohort.length === 0) cohort = pool.filter((id) => rarityOf(id) === 'Common');
        if (cohort.length === 0) cohort = pool;
        spread(cohort, weight / 100);
    }
    return odds;
}

/** The old event roll for ONE slot: only rarities that still have a card are rolled. */
function oldEventOdds(candidates: string[], rarities: Rarity[]): Map<string, number> {
    const live = rarities.filter((rarity) => candidates.some((id) => rarityOf(id) === rarity));
    const weightOf = (rarity: Rarity) => OLD_ORDER.find(([r]) => r === rarity)![1];
    const total = live.reduce((sum, rarity) => sum + weightOf(rarity), 0);
    const odds = new Map<string, number>(candidates.map((id) => [id, 0]));
    for (const rarity of live) {
        const cohort = candidates.filter((id) => rarityOf(id) === rarity);
        for (const id of cohort) odds.set(id, weightOf(rarity) / total / cohort.length);
    }
    return odds;
}

const normalise = (weights: { cardId: string; weight: number }[]): Map<string, number> => {
    const total = weights.reduce((sum, w) => sum + w.weight, 0);
    return new Map(weights.map((w) => [w.cardId, w.weight / total]));
};

function expectSameOdds(actual: Map<string, number>, expected: Map<string, number>): void {
    expect([...actual.keys()].sort()).toEqual([...expected.keys()].sort());
    for (const [id, p] of expected) expect(actual.get(id)!, id).toBeCloseTo(p, 12);
}

const FENRIR = [{ definitionId: 'fenrir', activeOS: 'fenrir_v1' }];
const FENRIR_KRAKEN = [...FENRIR, { definitionId: 'kraken', activeOS: 'kraken_v1' }];
const byRarity = (pool: string[], ...rarities: Rarity[]) => pool.filter((id) => rarities.includes(rarityOf(id)));

describe('ticket 185e — the weights are the old odds at multiplier 1', () => {
    it('keeps the rarity weights it was ruled against', () => {
        for (const [rarity, weight] of OLD_ORDER) expect(RARITY_WEIGHTS[rarity]).toBe(weight);
    });

    const fenrirPool = rewardCardPool(FENRIR);
    const mixedPool = rewardCardPool(FENRIR_KRAKEN);

    const pools: Array<[string, string[]]> = [
        ['the fenrir_v1 party pool', fenrirPool],
        ['the fenrir_v1 + kraken_v1 party pool', mixedPool],
        ['a pool with no Epic (Early Access has none)', byRarity(mixedPool, 'Common', 'Uncommon', 'Rare')],
        ['a pool with no Common', byRarity(mixedPool, 'Uncommon', 'Rare', 'Epic')],
        ['a pool of one rarity', byRarity(mixedPool, 'Rare')],
        ['a pool with no Common and no Uncommon', byRarity(mixedPool, 'Rare', 'Epic')],
    ];

    it.each(pools)('fight rewards: %s', (_name, pool) => {
        expect(pool.length).toBeGreaterThan(0);
        const weighted = weighCandidates(pool, rarityOf, RARITY_WEIGHTS, () => 1, 'fallToCommon');
        expectSameOdds(normalise(weighted), oldFightOdds(pool));
    });

    it.each(pools)('event picks (every rarity named): %s', (_name, pool) => {
        const weighted = weighCandidates(pool, rarityOf, RARITY_WEIGHTS, () => 1, 'liveOnly');
        expectSameOdds(normalise(weighted), oldEventOdds(pool, ['Common', 'Uncommon', 'Rare', 'Epic']));
    });

    it('event picks restricted to Common/Uncommon, as Scattered Verses is', () => {
        const allowed = byRarity(mixedPool, 'Common', 'Uncommon');
        const weighted = weighCandidates(allowed, rarityOf, RARITY_WEIGHTS, () => 1, 'liveOnly');
        expectSameOdds(normalise(weighted), oldEventOdds(allowed, ['Common', 'Uncommon']));
    });

    it('a multiplier of 1 on one card and nothing else changes nothing; a multiplier moves only that card\'s weight', () => {
        const target = fenrirPool[0];
        const neutral = weighCandidates(fenrirPool, rarityOf, RARITY_WEIGHTS, () => 1, 'fallToCommon');
        const boosted = weighCandidates(fenrirPool, rarityOf, RARITY_WEIGHTS, (id) => (id === target ? 3 : 1), 'fallToCommon');
        neutral.forEach((entry, i) => {
            expect(boosted[i].weight).toBeCloseTo(entry.weight * (entry.cardId === target ? 3 : 1), 12);
        });
    });

    it('a three-card offer is distinct and has the old odds for its first card, over many seeds', () => {
        const pool = rewardCardPool(FENRIR);
        const expected = oldFightOdds(pool);
        const counts = new Map<string, number>();
        const N = 60000;
        let seed: string | number = 'odds-185e';
        for (let i = 0; i < N; i += 1) {
            const offer = drawOffer({
                candidates: pool, count: 3, rarityOf, rarityWeights: RARITY_WEIGHTS, multiplierOf: () => 1,
                rule: 'fallToCommon',
                nextU: () => { const d = new PRNG(seed).next(); seed = d.nextSeed; return d.value; },
            });
            expect(new Set(offer).size).toBe(3);
            counts.set(offer[0], (counts.get(offer[0]) ?? 0) + 1);
        }
        for (const [id, p] of expected) {
            const sigma = Math.sqrt((p * (1 - p)) / N);
            expect(Math.abs((counts.get(id) ?? 0) / N - p), id).toBeLessThan(5 * sigma + 1e-9);
        }
    });

    it('later cards in an offer are drawn from what is left, with the first draw\'s weights renormalised', () => {
        // The old reroll-until-distinct IS this distribution. Three cards, weights 1, 2, 7 (one rarity,
        // multipliers 1, 2, 7 against equal shares), so P(second = b | first = a) is w_b / (1 - w_a).
        const pool = byRarity(rewardCardPool(FENRIR), 'Rare').slice(0, 3);
        expect(pool).toHaveLength(3);
        const mult = new Map(pool.map((id, i) => [id, [1, 2, 7][i]]));
        const N = 60000;
        let seed: string | number = 'renormalise-185e';
        const pairs = new Map<string, number>();
        for (let i = 0; i < N; i += 1) {
            const offer = drawOffer({
                candidates: pool, count: 2, rarityOf, rarityWeights: RARITY_WEIGHTS, multiplierOf: (id) => mult.get(id)!,
                rule: 'fallToCommon',
                nextU: () => { const d = new PRNG(seed).next(); seed = d.nextSeed; return d.value; },
            });
            pairs.set(offer.join('>'), (pairs.get(offer.join('>')) ?? 0) + 1);
        }
        const w = (id: string) => mult.get(id)! / 10;
        for (const a of pool) for (const b of pool) {
            if (a === b) continue;
            const p = w(a) * (w(b) / (1 - w(a)));
            const sigma = Math.sqrt((p * (1 - p)) / N);
            expect(Math.abs((pairs.get(`${a}>${b}`) ?? 0) / N - p), `${a}>${b}`).toBeLessThan(5 * sigma + 1e-9);
        }
    });
});
