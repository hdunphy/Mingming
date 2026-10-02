/**
 * What the walker did with its card picks, pooled — ticket 179b.
 *
 * `scrapCurveWalk.ts` answers "how much scrap, where"; this file answers the other half of 179:
 * how many cards were offered, where they went, and how big the deck ended up. Pure: no Node APIs,
 * no walking. `runCardPicksWalk.ts` does the walking.
 *
 * # THE WALKER NEVER SELLS
 *
 * Selling a card is a human move (the shop's Sell tab); the walker has no sell policy, so "cards
 * sold" is 0 in both arms by construction (174's report says the same). What the walker does give
 * is the cards it sent to the run COLLECTION (the shelf a human sells from). `soldIfAllShelved` is
 * the scrap those cards would have fetched at `sellPrice` if every one had been sold. It is an
 * upper bound on selling income from picks, labelled as such, not a measurement of a sale.
 *
 * # "THE FLOOR"
 *
 * `minimumActiveDeck(partySize)` is 8 / 13 / 18 at one, two and three members: the smallest deck a
 * party may edit down to. The walker never benches, so the party at the end is the party it started
 * with plus every recruit. A deck "at the floor" has exactly that many counted cards (junk does not
 * count, 168c rule 4) or fewer.
 */

import { minimumActiveDeck } from '../../engine/run/createRun';
import { countedDeckSize } from '../../engine/run/junk';
import { sellPrice } from '../../engine/run/marketplace';
import type { WalkResult } from './runWalker';

/** The healthy-deck bar from `economy-session.md`: a run should reach 20-25 cards by the gauntlet. */
export const HEALTHY_DECK_CARDS = 20;

export interface DeckSizeSummary {
    /** Walks in this group. */
    readonly runs: number;
    readonly meanCounted: number;
    readonly meanFloor: number;
    /** Walks whose counted deck was at or under its floor. */
    readonly atFloor: number;
    /** Walks whose counted deck reached `HEALTHY_DECK_CARDS`. */
    readonly atHealthy: number;
}

export interface CardPicksSummary {
    readonly runs: number;
    /** Per-run means. */
    readonly perRun: {
        /** Pick screens shown: one per fight since 179, one per defeated enemy before it. */
        readonly pickScreens: number;
        /** Cards shown across those screens (three a screen). */
        readonly cardsOffered: number;
        readonly takenToDeck: number;
        readonly takenToCollection: number;
        readonly skipped: number;
        /** Always 0: the walker has no sell policy. */
        readonly sold: number;
        /** Scrap the walker earned from selling: always 0, for the same reason. */
        readonly sellScrap: number;
        /** What the collection-bound cards would fetch at `sellPrice` if every one were sold. */
        readonly soldIfAllShelved: number;
    };
    readonly allWalks: DeckSizeSummary;
    /** Walks that played at least one gauntlet fight, the decks that matter for a healthy gym. */
    readonly reachedGym: DeckSizeSummary;
}

function meanOf(values: ReadonlyArray<number>): number {
    return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
}

/** The party size at the end of a walk: who it started with, plus every recruit (it never benches). */
function endPartySize(result: WalkResult): number {
    let size = 0;
    for (const event of result.log.events) {
        if (event.kind === 'RUN_STARTED') size = event.party.length;
        else if (event.kind === 'RECRUITED') size += 1;
    }
    return size;
}

function deckSummary(results: ReadonlyArray<WalkResult>): DeckSizeSummary {
    const counted = results.map((r) => countedDeckSize(r.finalDeck.map((dataId) => ({ dataId }))));
    const floors = results.map((r) => minimumActiveDeck(endPartySize(r)));
    return {
        runs: results.length,
        meanCounted: meanOf(counted),
        meanFloor: meanOf(floors),
        atFloor: counted.filter((n, i) => n <= floors[i]).length,
        atHealthy: counted.filter((n) => n >= HEALTHY_DECK_CARDS).length,
    };
}

export function summariseCardPicks(results: ReadonlyArray<WalkResult>): CardPicksSummary {
    const stat = (pick: (r: WalkResult) => number): number => meanOf(results.map(pick));
    return {
        runs: results.length,
        perRun: {
            pickScreens: stat((r) => r.picks.length),
            cardsOffered: stat((r) => r.picks.reduce((n, p) => n + p.offered.length, 0)),
            takenToDeck: stat((r) => r.picks.filter((p) => p.taken !== null && !p.toCollection).length),
            takenToCollection: stat((r) => r.picks.filter((p) => p.taken !== null && p.toCollection).length),
            skipped: stat((r) => r.picks.filter((p) => p.taken === null).length),
            sold: 0,
            sellScrap: 0,
            soldIfAllShelved: stat((r) => r.picks.reduce((n, p) => (p.taken !== null && p.toCollection ? n + sellPrice(p.taken) : n), 0)),
        },
        allWalks: deckSummary(results),
        reachedGym: deckSummary(results.filter((r) => r.fights.some((f) => f.kind === 'gym'))),
    };
}

const one = (n: number): string => n.toFixed(1);
const signed = (n: number): string => (n > 0 ? `+${n.toFixed(1)}` : n.toFixed(1));
const pct = (n: number, of: number): string => (of === 0 ? '-' : `${((100 * n) / of).toFixed(1)}% (${n}/${of})`);

/** Per-run card flow, before and after, as a markdown table. */
export function formatPickFlow(before: CardPicksSummary, after: CardPicksSummary): string {
    const rows: ReadonlyArray<readonly [string, keyof CardPicksSummary['perRun']]> = [
        ['pick screens shown', 'pickScreens'],
        ['cards offered', 'cardsOffered'],
        ['cards taken into the deck', 'takenToDeck'],
        ['cards taken to the collection', 'takenToCollection'],
        ['picks skipped', 'skipped'],
        ['cards sold (walker never sells)', 'sold'],
        ['scrap from selling (walker never sells)', 'sellScrap'],
        ['scrap if every collection card were sold (upper bound)', 'soldIfAllShelved'],
    ];
    return [
        '| mean per run | before | after | change |',
        '|---|---|---|---|',
        ...rows.map(([label, key]) => `| ${label} | ${one(before.perRun[key])} | ${one(after.perRun[key])} | ${signed(after.perRun[key] - before.perRun[key])} |`),
    ].join('\n');
}

/** Final deck size and how often it sat at the floor, before and after, as a markdown table. */
export function formatDeckSize(before: CardPicksSummary, after: CardPicksSummary): string {
    const block = (label: string, b: DeckSizeSummary, a: DeckSizeSummary): string[] => [
        `| ${label}: walks | ${b.runs} | ${a.runs} |`,
        `| ${label}: mean final deck (counted cards) | ${one(b.meanCounted)} | ${one(a.meanCounted)} |`,
        `| ${label}: mean floor for the party it ended with | ${one(b.meanFloor)} | ${one(a.meanFloor)} |`,
        `| ${label}: at the floor | ${pct(b.atFloor, b.runs)} | ${pct(a.atFloor, a.runs)} |`,
        `| ${label}: ${HEALTHY_DECK_CARDS}+ cards | ${pct(b.atHealthy, b.runs)} | ${pct(a.atHealthy, a.runs)} |`,
    ];
    return [
        '| | before | after |',
        '|---|---|---|',
        ...block('all walks', before.allWalks, after.allWalks),
        ...block('walks that reached the gym', before.reachedGym, after.reachedGym),
    ].join('\n');
}
