/**
 * TICKET 179b — the card-pick summary the measurement is read from.
 *
 * Synthetic walks, so each number is hand-checkable: what counts as "taken to the deck", where the
 * floor comes from (party at the start plus recruits), and what the sell estimate is made of.
 */
import { describe, expect, it } from 'vitest';

import { minimumActiveDeck } from '../../engine/run/createRun';
import { sellPrice } from '../../engine/run/marketplace';
import { summariseCardPicks } from './cardPicksWalk';
import type { WalkResult } from './runWalker';

const CARD_A = 'tackle';
const CARD_B = 'water_slap';

function walk(opts: {
    picks: ReadonlyArray<{ taken: string | null; toCollection: boolean }>;
    finalDeckSize: number;
    start: number;
    recruits: number;
    gym: boolean;
}): WalkResult {
    return {
        picks: opts.picks.map((p) => ({ offered: [CARD_A, CARD_B, 'nettle_sting'], taken: p.taken, score: 1, toCollection: p.toCollection })),
        finalDeck: Array.from({ length: opts.finalDeckSize }, () => CARD_B),
        fights: opts.gym ? [{ kind: 'gym' }] : [{ kind: 'wild' }],
        log: {
            events: [
                { kind: 'RUN_STARTED', party: Array.from({ length: opts.start }, (_, i) => `m${i}`) },
                ...Array.from({ length: opts.recruits }, () => ({ kind: 'RECRUITED' })),
            ],
        },
    } as unknown as WalkResult;
}

describe('summariseCardPicks', () => {
    const summary = summariseCardPicks([
        walk({ picks: [{ taken: CARD_B, toCollection: false }, { taken: null, toCollection: false }], finalDeckSize: 8, start: 1, recruits: 0, gym: false }),
        walk({ picks: [{ taken: CARD_A, toCollection: true }, { taken: CARD_B, toCollection: false }, { taken: CARD_B, toCollection: false }], finalDeckSize: 25, start: 1, recruits: 2, gym: true }),
    ]);

    it('averages the card flow per run', () => {
        expect(summary.runs).toBe(2);
        expect(summary.perRun.pickScreens).toBe(2.5);
        expect(summary.perRun.cardsOffered).toBe(7.5);
        expect(summary.perRun.takenToDeck).toBe(1.5);
        expect(summary.perRun.takenToCollection).toBe(0.5);
        expect(summary.perRun.skipped).toBe(0.5);
    });

    it('never reports a sale: the walker has no sell policy, only an upper bound', () => {
        expect(summary.perRun.sold).toBe(0);
        expect(summary.perRun.sellScrap).toBe(0);
        expect(summary.perRun.soldIfAllShelved).toBe(sellPrice(CARD_A) / 2);
    });

    it('takes the floor from the party at the start plus every recruit', () => {
        expect(summary.allWalks.meanFloor).toBe((minimumActiveDeck(1) + minimumActiveDeck(3)) / 2);
        // 8 cards at a one-member floor of 8 is AT the floor; 25 cards at a three-member floor of 18 is not.
        expect(summary.allWalks.atFloor).toBe(1);
        expect(summary.allWalks.atHealthy).toBe(1);
    });

    it('reports the gym-reaching decks on their own', () => {
        expect(summary.reachedGym.runs).toBe(1);
        expect(summary.reachedGym.meanCounted).toBe(25);
        expect(summary.reachedGym.atFloor).toBe(0);
    });
});
