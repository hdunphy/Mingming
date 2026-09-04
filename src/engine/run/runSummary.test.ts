/**
 * The run summary's arithmetic — ticket 19.
 *
 * `runSummary.ts` is the single source of the numbers the player reads AND the numbers ticket 25's
 * playtest reads, so what is pinned here is that the two cannot disagree and that neither invents a
 * figure `IRunState` cannot support. The two interesting cases are the ones the ticket flagged: the
 * deck split (which is what "cards picked" actually means) and the run clock.
 */

import { describe, expect, it } from 'vitest';

import { createRun } from './createRun';
import { offerGyms } from './gyms';
import {
    BLUEPRINT_BANKED_PREFIX,
    DECK_TARGET_MAX,
    DECK_TARGET_MIN,
    SOLO_START_DECK,
    bankedBlueprintCounts,
    bankedBlueprintsFrom,
    blueprintBankedModifier,
    codexSeenFrom,
    formatRunDuration,
    summarizeRun,
} from './runSummary';
import type { IRunCard, IRunState } from '../runTypes';
import type { IMingmingState } from '../types';

const STARTED_AT = 1_700_000_000_000;

const MEMBER: IMingmingState = {
    id: 'mm1',
    definitionId: 'kraken',
    activeOS: 'kraken_v1',
    blueprintsCollected: 0,
    attackIV: 10,
    defenseIV: 10,
    hpIV: 10,
};

function makeRun(over: Partial<IRunState> = {}): IRunState {
    return {
        ...createRun({
            seed: 'summary-seed',
            offer: offerGyms('offer-seed')[0],
            party: [MEMBER],
            startedAt: STARTED_AT,
        }),
        ...over,
    };
}

const picked = (n: number): IRunCard[] => Array.from({ length: n }, (_, i) => ({
    instanceId: `bought-${i}`,
    dataId: `card_${i}`,
    ownerId: null,
}));

describe('summarizeRun — the deck-building track', () => {
    it('opens a SOLO run at 8 cards, which is the number the ticket quotes', () => {
        // The constant is derived from `createRun`'s two halves rather than written as 8, so this
        // asserts the derivation rather than the literal — a re-ruled start deck moves both. It has
        // now been re-ruled four times (8 = 5 + 3, then ticket 60's 6 = 4 + 2, then the 2026-08-25
        // move of the generics from per-member to per-run, then ticket 61's 8 = 5 + 3 with the
        // generics on the STARTER) and the derivation held through all four; the literal here is
        // what makes the RULING visible in the diff.
        //
        // The value has now returned to where ticket 08 first put it, by a different road, and the
        // constant is still not multipliable — that is what the rename recorded. A two-member run
        // opens at 13 and a three at 18 — 5 per member plus the starter's three generics — so
        // multiplying this by party size, which the old `START_DECK_PER_MEMBER` name invited, now
        // overcounts by 3 per extra member. `makeRun` fields a solo party, so 8 is exactly right
        // here and would not be for any other party.
        expect(SOLO_START_DECK).toBe(8);
        expect(makeRun().deck).toHaveLength(SOLO_START_DECK);
    });

    it('counts "cards picked" as the cards with no owner, and kit as the rest', () => {
        // `runTypes.IRunCard` reserves `ownerId: null` for "bought, drafted, or granted by an
        // event" — which is exactly the set of cards the player chose to add. The two halves must
        // sum to the deck, which is the property a guessed opening size would not have had.
        const run = makeRun();
        const grown = makeRun({ deck: [...run.deck, ...picked(9)] });

        const summary = summarizeRun(grown, STARTED_AT);
        // A solo run's opening eight plus nine bought cards. Every re-ruling so far has moved the
        // opening half (8 -> 6, what the 6 counts, and back to 8) and left the picked half alone,
        // which is exactly the asymmetry these two counters exist to show the player: what you were
        // given, and what you chose.
        expect(summary.deckSize).toBe(17);
        expect(summary.pickedCards).toBe(9);
        expect(summary.kitCards).toBe(8);
        expect(summary.kitCards).toBe(SOLO_START_DECK);
        expect(summary.kitCards + summary.pickedCards).toBe(summary.deckSize);
    });

    it('quotes the same 20–25 target the marketplace does', () => {
        // The two screens teach the same lesson from opposite ends; if they quoted different bands
        // the lesson would contradict itself. One definition, re-exported by the shop.
        expect([DECK_TARGET_MIN, DECK_TARGET_MAX]).toEqual([20, 25]);
    });
});

describe('summarizeRun — the numbers that come straight off the run', () => {
    it('reports fights, scrap in hand, party size and the biome it ended in', () => {
        const base = makeRun();
        const inBiomeTwo = base.nodes.find((n) => n.biomeIndex === 1)!;
        const run = makeRun({ fightsResolved: 7, scrap: 42, currentNodeId: inBiomeTwo.id });

        const summary = summarizeRun(run, STARTED_AT);
        expect(summary.fightsResolved).toBe(7);
        // Scrap REMAINING, never scrap spent: `IRunState` keeps a balance and no ledger, so a spend
        // total is not derivable and this ticket may not add the field.
        expect(summary.scrapRemaining).toBe(42);
        expect(summary.partySize).toBe(1);
        expect(summary.biomeReached).toBe(2);
        expect(summary.biomeName).toBe(run.biomes[1].name);
    });

    it('carries the outcome through untouched, including "not ended yet"', () => {
        expect(summarizeRun(makeRun(), STARTED_AT).outcome).toBeNull();
        expect(summarizeRun(makeRun({ phase: 'ended', outcome: 'defeat' }), STARTED_AT).outcome).toBe('defeat');
    });
});

describe('summarizeRun — the run clock', () => {
    it('is endedAt minus startedAt, with the clock injected', () => {
        const run = makeRun();
        expect(summarizeRun(run, STARTED_AT + 42 * 60_000).durationMs).toBe(42 * 60_000);
    });

    it('floors a backwards clock at zero rather than reporting a negative run', () => {
        // A system clock moved backwards mid-run is the only way this happens, and a negative run
        // length in a playtest table looks like a real measurement.
        expect(summarizeRun(makeRun(), STARTED_AT - 10_000).durationMs).toBe(0);
        expect(summarizeRun(makeRun(), Number.NaN).durationMs).toBe(0);
    });

    it('formats against the 35–45 minute target the player is being compared to', () => {
        expect(formatRunDuration(0)).toBe('0m 00s');
        expect(formatRunDuration(42 * 60_000 + 13_000)).toBe('42m 13s');
        // Past the hour the seconds have stopped being the interesting part.
        expect(formatRunDuration(3 * 3_600_000 + 120_000)).toBe('3h 02m');
    });
});

describe('the blueprint ledger in `modifiers`', () => {
    it('round-trips a species through the namespaced prefix', () => {
        expect(blueprintBankedModifier('kraken')).toBe(`${BLUEPRINT_BANKED_PREFIX}kraken`);
        expect(bankedBlueprintsFrom([blueprintBankedModifier('kraken')])).toEqual(['kraken']);
    });

    it('keeps duplicates — blueprints are currency, not a permission', () => {
        // The opposite of the map-reveal, which dedupes: `addBlueprint` stacks the count (ticket
        // 20), so two kraken blueprints is two lines and collapsing them would under-report the run.
        const modifiers = ['kraken', 'kraken', 'fenrir'].map(blueprintBankedModifier);
        expect(bankedBlueprintsFrom(modifiers)).toEqual(['kraken', 'kraken', 'fenrir']);
        expect(bankedBlueprintCounts(modifiers)).toEqual({ kraken: 2, fenrir: 1 });
    });

    it('ignores every other modifier, including ones from a future version', () => {
        // Total and forgiving for `revealedBiomesFrom`'s reason: this is read from a render, and the
        // summary is the one screen whose whole job is to reassure the player nothing was lost.
        expect(bankedBlueprintsFrom(['reveal:biome:1', 'ascension:hard', BLUEPRINT_BANKED_PREFIX])).toEqual([]);
    });

    it('reaches the summary as the blueprints this run banked', () => {
        const run = makeRun({ modifiers: ['reveal:biome:0', blueprintBankedModifier('kraken')] });
        expect(summarizeRun(run, STARTED_AT).blueprintsBanked).toEqual(['kraken']);
    });
});

describe('the codex merge candidate', () => {
    it('dedupes dataIds and keeps first-seen order', () => {
        const deck: IRunCard[] = [
            { instanceId: 'a', dataId: 'water_slap', ownerId: 'mm1' },
            { instanceId: 'b', dataId: 'water_slap', ownerId: 'mm1' },
            { instanceId: 'c', dataId: 'generic_hit', ownerId: null },
        ];
        expect(codexSeenFrom(deck)).toEqual(['water_slap', 'generic_hit']);
    });

    it('records what the run HELD — a start deck is already a codex entry', () => {
        const summary = summarizeRun(makeRun(), STARTED_AT);
        expect(summary.codexSeen.length).toBeGreaterThan(0);
        expect(new Set(summary.codexSeen).size).toBe(summary.codexSeen.length);
    });
});
