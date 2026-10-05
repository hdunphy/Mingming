/**
 * TICKET 170e — the best-card drafter, on hand-made offers and on a real draft.
 *
 * The card ids are real (the score and the element come from the registry), and every test that
 * leans on a score relation checks that relation first, so a rebalance of one card fails loudly at
 * the premise instead of quietly changing what the test proves.
 */
import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { DRAFT_PICKS, draftPool } from '../../engine/run/modifiers/draftStart';
import { START_KIT_SIZE } from '../../engine/run/createRun';
import { DRAFT_TIE_WINDOW, chooseDraftPickBest } from './draftPolicy';
import { chooseDraftPick, draftKitFor, memberFor, scoreOf, walkRun } from './runWalker';
import { startKitIdsFor } from '../../engine/run/createRun';

const score = (id: string): number => scoreOf(id) ?? Number.NaN;
const best = (offer: string[], picked: string[] = []) => chooseDraftPickBest(offer, picked, scoreOf);

describe('chooseDraftPickBest', () => {
    it('takes the second card when it scores highest, where the kit drafter takes the first kit card', () => {
        // unbound_fang is the weakest card there is; fury_strike is far above it.
        expect(score('fury_strike') - score('unbound_fang')).toBeGreaterThan(DRAFT_TIE_WINDOW);
        const offer = ['unbound_fang', 'fury_strike', 'scald'];
        expect(best(offer)).toBe('fury_strike');
        expect(chooseDraftPick(offer, ['unbound_fang', 'x', 'y', 'z', 'w'], [])).toBe('unbound_fang');
    });

    it('takes the first offer on a tie', () => {
        expect(score('fury_strike')).toBe(score('fire_punch_v2'));
        expect(best(['fury_strike', 'fire_punch_v2'])).toBe('fury_strike');
        expect(best(['fire_punch_v2', 'fury_strike'])).toBe('fire_punch_v2');
        expect(best(['scald', 'scald'])).toBe('scald');
    });

    it('prefers a card that adds an element when two offers are within the window', () => {
        // brute_force is Fire Attack 3.1 and venom_fang is Water Attack 3.0: a tenth apart.
        expect(score('brute_force') - score('venom_fang')).toBeLessThan(DRAFT_TIE_WINDOW);
        expect(score('brute_force')).toBeGreaterThan(score('venom_fang'));
        // The kit so far is Fire Attack, so the Water card adds an element and wins despite scoring lower.
        expect(best(['brute_force', 'venom_fang'], ['fury_strike'])).toBe('venom_fang');
    });

    it('prefers a card that adds a role when the element is already held', () => {
        // ember_mend is a Fire Heal; with only Fire Attack held it adds a role, not an element.
        const near = Object.entries({ attack: 'brute_force', heal: 'ember_mend' });
        expect(near).toHaveLength(2);
        // Make the premise explicit: only take the role rule on offer when the scores are within the window.
        const gap = score('brute_force') - score('ember_mend');
        if (gap <= DRAFT_TIE_WINDOW) expect(best(['brute_force', 'ember_mend'], ['fury_strike'])).toBe('ember_mend');
        else expect(best(['brute_force', 'ember_mend'], ['fury_strike'])).toBe('brute_force');
    });

    it('does not trade away a clearly better card for novelty: outside the window the best score wins', () => {
        expect(score('brute_force') - score('scald')).toBeGreaterThan(DRAFT_TIE_WINDOW);
        expect(best(['brute_force', 'scald'], ['fury_strike'])).toBe('brute_force');
    });

    it('takes the best-scoring card when nothing near the top adds anything', () => {
        expect(best(['fury_strike', 'brute_force'], ['flare_burst'])).toBe('brute_force');
    });

    it('handles an empty offer and a card the registry does not know', () => {
        expect(best([])).toBeUndefined();
        expect(best(['no_such_card', 'fury_strike'])).toBe('fury_strike');
        expect(best(['no_such_card'])).toBe('no_such_card');
    });

    it('reads the window as five power points: 0.5 on the score scale', () => {
        expect(DRAFT_TIE_WINDOW).toBe(0.5);
    });
});

describe('draftKitFor with the best-card drafter', () => {
    it.each(['kraken_v1', 'fenrir_v2', 'skoll_v1'])('%s: five picks, all from the pool, none more often than the pool holds it', (osId) => {
        const member = memberFor('mm1', osId);
        const pool = draftPool(member);
        for (let i = 0; i < 20; i += 1) {
            const picks = draftKitFor(`t170e:${i}`, member, 0, 'best');
            expect(picks).toHaveLength(DRAFT_PICKS);
            for (const id of new Set(picks)) {
                expect(picks.filter((p) => p === id).length).toBeLessThanOrEqual(pool.filter((p) => p === id).length);
            }
        }
    });

    it('leaving the policy out is the kit drafter', () => {
        const member = memberFor('mm1', 'kraken_v1');
        for (let i = 0; i < 10; i += 1) {
            expect(draftKitFor(`t170e:${i}`, member)).toEqual(draftKitFor(`t170e:${i}`, member, 0, 'kit'));
        }
        expect(startKitIdsFor(member, START_KIT_SIZE)).toHaveLength(START_KIT_SIZE);
    });

    it('is a different drafter: somewhere in twenty seeds it drafts a different five than the kit drafter', () => {
        const member = memberFor('mm1', 'kraken_v1');
        const differs = Array.from({ length: 20 }, (_, i) =>
            JSON.stringify(draftKitFor(`t170e:${i}`, member, 0, 'best')) !== JSON.stringify(draftKitFor(`t170e:${i}`, member, 0, 'kit')));
        expect(differs.some(Boolean)).toBe(true);
    });
});

describe('170e — the walker', () => {
    const hashOf = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);
    // Hashes of whole Draft Start walk results, taken on the parent of 170e (no draftPolicy option existed).
    // TICKET 179 (one card pick per fight) moved the first hash once, on purpose: d1a64b1db0e0586a ->
    // 942eb155ecef6c8e, because the walk now takes one card pick per fight instead of one per defeated
    // body. The other draft walk and the 170a default walk below did not move.
    // TICKET 176 (the map redesign) moved all three once, on purpose: the walks now run on towns and
    // one-way routes, so every node, fight and shop a walk meets is different. What each test holds
    // down is unchanged: leaving the option out must reproduce the same walk the modifier alone makes.
    // TICKET 185e moved all three once, on purpose: card offers are one weighted draw now and leave out
    // the last two picks' cards, so every walk is offered different cards from the same seed.
    // TICKET 194 moved the kraken one on purpose (194a, 194b: see ghostWalk.test.ts).
    const GOLDEN: ReadonlyArray<readonly [string, string, number, string]> = [
        ['t170e:draft:fenrir_v2:1', 'fenrir_v2', 1, '9e1cbbc29cfeec7d'],
        ['t170e:draft:kraken_v1:0', 'kraken_v1', 0, '8981a5c39483d37c'],
    ];

    it.each(GOLDEN)('%s: leaving draftPolicy out reproduces the 169j Draft Start walk exactly', (seed, starter, gymIndex, hash) => {
        expect(hashOf(walkRun({ seed, starter, gymIndex, modifiers: ['draft_start'] }))).toBe(hash);
    });

    it('draftPolicy does nothing without the draft_start modifier', () => {
        // 170a's pinned default walk for this seed (no modifier, no option).
        expect(hashOf(walkRun({ seed: 't170a:default:fenrir_v2:1', starter: 'fenrir_v2', gymIndex: 1, draftPolicy: 'best' }))).toBe('cbae1ed75c400704');
    });

    it("'best' reaches the walk: the same seed and modifier, a different run", () => {
        const { 0: seed, 1: starter, 2: gymIndex, 3: kitHash } = GOLDEN[0];
        const bestWalk = walkRun({ seed, starter, gymIndex, modifiers: ['draft_start'], draftPolicy: 'best' });
        expect(hashOf(bestWalk)).not.toBe(kitHash);
        expect(bestWalk.log.events.some((e) => e.kind === 'FIGHT_DECK')).toBe(true);
    });
});
