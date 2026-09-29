/**
 * TICKET 168c — the gamble is seeded, roughly fair at its printed odds, and fixed for the node.
 */

import { describe, expect, it } from 'vitest';

import { createRun } from '../createRun';
import { offerGyms } from '../gyms';
import type { IMingmingState } from '../../types';
import type { IRegionNode, IRunState } from '../../runTypes';
import { getEvent } from './eventCatalogue';
import { isChoiceBuilt, playableChoices } from './eventChoices';
import { gambleWins, resolveGambles } from './eventGamble';
import type { EventChoice } from './eventSchema';

const KRAKEN: IMingmingState = {
    id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1',
    blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10,
};

function ctxFor(seed: string): { run: IRunState; node: IRegionNode } {
    const run = createRun({ seed, offer: offerGyms('offer-seed')[0], party: [KRAKEN], startedAt: 1 });
    return { run, node: { ...run.nodes.find((n) => n.id !== run.currentNodeId)!, visited: 1 } };
}

const CACHE = getEvent('corrupted_cache')!;
const OPEN: EventChoice = CACHE.choices.find((c) => c.id === 'open')!;

describe('gambleWins', () => {
    it('is deterministic for a node', () => {
        const ctx = ctxFor('gamble-a');
        expect(gambleWins(ctx, 0, 50)).toBe(gambleWins(ctx, 0, 50));
    });

    it('wins about half the time at 50%, over many nodes', () => {
        let wins = 0;
        const runs = 600;
        for (let i = 0; i < runs; i += 1) if (gambleWins(ctxFor(`gamble-${i}`), 0, 50)) wins += 1;
        expect(wins / runs).toBeGreaterThan(0.42);
        expect(wins / runs).toBeLessThan(0.58);
    });

    it('never wins at 1% on a loose count, and always wins at 99% on most', () => {
        let low = 0;
        let high = 0;
        for (let i = 0; i < 400; i += 1) {
            if (gambleWins(ctxFor(`odds-${i}`), 0, 1)) low += 1;
            if (gambleWins(ctxFor(`odds-${i}`), 0, 99)) high += 1;
        }
        expect(low).toBeLessThan(20);
        expect(high).toBeGreaterThan(380);
    });
});

describe('resolveGambles', () => {
    it('replaces the gamble with the branch it rolled, and leaves no gamble behind', () => {
        let sawWin = false;
        let sawLose = false;
        for (let i = 0; i < 80; i += 1) {
            const ctx = ctxFor(`branch-${i}`);
            const played = resolveGambles(ctx, OPEN);
            expect(played.outcomes.some((o) => o.type === 'GAMBLE')).toBe(false);
            const types = played.outcomes.map((o) => o.type);
            if (gambleWins(ctx, 0, 50)) { expect(types).toEqual(['CARD_PICK']); sawWin = true; }
            else { expect(types).toEqual(['JUNK', 'SCRAP']); sawLose = true; }
        }
        expect(sawWin && sawLose).toBe(true);
    });

    it('returns a choice with no gamble as it came, and is safe to call twice', () => {
        const leave = CACHE.choices.find((c) => c.id === 'leave')!;
        expect(resolveGambles(ctxFor('x'), leave)).toBe(leave);
        const ctx = ctxFor('twice');
        const once = resolveGambles(ctx, OPEN);
        expect(resolveGambles(ctx, once)).toBe(once);
    });
});

describe('a gamble is built when both of its branches are', () => {
    it('offers Corrupted Cache’s gamble now that junk exists', () => {
        expect(playableChoices(CACHE).map((c) => c.id)).toEqual(['open', 'leave']);
        expect(isChoiceBuilt(OPEN)).toBe(true);
    });

    it('does not offer a gamble with an unbuilt outcome in a branch', () => {
        expect(isChoiceBuilt(OPEN, new Set(['CARD_PICK', 'GAMBLE', 'JUNK']))).toBe(false);
        expect(isChoiceBuilt(OPEN, new Set(['SCRAP', 'JUNK', 'GAMBLE']))).toBe(false);
    });
});

describe('resolveGambles — a losing price is capped at what the run holds', () => {
    /** A run and node whose gamble at index 0 lands on the wanted side. */
    function landing(win: boolean, scrap: number): { run: IRunState; node: IRegionNode } {
        for (let i = 0; i < 200; i += 1) {
            const ctx = ctxFor(`cap-${i}`);
            if (gambleWins(ctx, 0, 50) === win) return { ...ctx, run: { ...ctx.run, scrap } };
        }
        throw new Error('no seed found');
    }
    const priceOf = (choice: EventChoice): number[] =>
        choice.outcomes.flatMap((o) => (o.type === 'SCRAP' ? [o.amount] : []));

    it('takes the full 15 when the run holds it', () => {
        expect(priceOf(resolveGambles(landing(false, 40), OPEN))).toEqual([-15]);
    });

    it('takes only what the run holds when it holds less, and nothing at 0', () => {
        expect(priceOf(resolveGambles(landing(false, 5), OPEN))).toEqual([-5]);
        expect(priceOf(resolveGambles(landing(false, 0), OPEN))).toEqual([-0]);
    });

    it('is unchanged by a second call', () => {
        const once = resolveGambles(landing(false, 5), OPEN);
        expect(resolveGambles(landing(false, 5), once)).toBe(once);
    });
});

