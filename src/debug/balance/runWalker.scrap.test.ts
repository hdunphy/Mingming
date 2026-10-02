/**
 * TICKET 174d — the run walker's scrap books, and its upgrade policy at a two-slot bench.
 *
 * Two claims, both about what the walker's run log SAYS, because `scrapCurve` reads that log and
 * the before/after report in `docs/balance/scrap-curve-174.md` is built from it:
 *
 * - **The log balances.** The scrap a run opens with, plus every `SCRAP` row, is the scrap it ends
 *   with. Before 174d this failed on any walk that bought anything: the walker logged what it
 *   gained and left almost every purchase out, so a per-biome "spent" column was nearly empty.
 * - **A two-slot bench is used twice.** The market and the workshop allow `UPGRADES_PER_VISIT`; the
 *   gate allows one. The walker takes up to the allowance, never more.
 */
import { describe, expect, it } from 'vitest';

import { walkRun, type WalkResult } from './runWalker';
import { STARTING_SCRAP } from '../../engine/run/createRun';
import { UPGRADES_PER_VISIT } from '../../engine/run/marketplace';
import type { IRunEvent } from '../../engine/run/runLog';

const netScrap = (result: WalkResult): number =>
    result.log.events.reduce((sum, event) => (event.kind === 'SCRAP' ? sum + event.delta : sum), 0);

/** Upgrades bought on each node visit: `[nodeKind, count]` per `NODE_ENTERED` segment. */
function upgradesPerVisit(events: ReadonlyArray<IRunEvent>): Array<[string, number]> {
    const visits: Array<[string, number]> = [];
    for (const event of events) {
        if (event.kind === 'NODE_ENTERED') visits.push([event.nodeKind, 0]);
        else if (event.kind === 'CARD_UPGRADED' && visits.length > 0) visits[visits.length - 1][1] += 1;
    }
    return visits;
}

/*
 * A SMALL, PINNED SAMPLE. A walk that reaches the gauntlet plays three more full fights, so seeds
 * are chosen for being cheap and for what they do: `fenrir_v2 #0` and `kraken_v1 #0` each use both
 * slots of a bench at least once, and between the four runs the walker buys a card, recruits,
 * fits patches and upgrades. Asserted below, so a retune that empties the sample fails loudly
 * instead of letting the books "balance" over nothing.
 */
const walk = (starter: string, i: number, upgrades: boolean): WalkResult =>
    walkRun({ seed: `t174d:x:${starter}:${i}`, starter, gymIndex: i % 3, upgrades });

const WITH_UPGRADES = [['fenrir_v2', 0], ['kraken_v1', 0], ['skoll_v2', 0], ['kraken_v2', 0]]
    .map(([starter, i]) => walk(starter as string, i as number, true));
const WITHOUT_UPGRADES = [['fenrir_v2', 0], ['kraken_v2', 0]]
    .map(([starter, i]) => walk(starter as string, i as number, false));

describe('174d — the walker logs what it spends', () => {
    it.each([['upgrades on', WITH_UPGRADES], ['upgrades off', WITHOUT_UPGRADES]] as const)(
        'opening scrap plus every SCRAP row is the scrap the run ends with (%s)',
        (_label, results) => {
            for (const result of results) {
                expect(STARTING_SCRAP + netScrap(result), `${result.starter} ${result.seed}`).toBe(result.scrapAtEnd);
            }
        },
    );

    it('the sample actually buys things, so the balance above is not over nothing', () => {
        const spendRows = WITH_UPGRADES.flatMap((r) => r.log.events)
            .filter((event) => event.kind === 'SCRAP' && event.delta < 0);
        expect(spendRows.length).toBeGreaterThan(0);
        expect(WITH_UPGRADES.some((r) => r.upgraded.length > 0)).toBe(true);
    });

    it('names each spend by the reducer that took the scrap', () => {
        const reasons = new Set<string>();
        for (const result of [...WITH_UPGRADES, ...WITHOUT_UPGRADES]) {
            for (const event of result.log.events) {
                if (event.kind === 'SCRAP' && event.delta < 0) reasons.add(event.reason);
            }
        }
        expect(reasons.size).toBeGreaterThan(0);
        for (const reason of reasons) {
            expect(['buyMarketCard', 'upgradeDeckCard', 'recruitIntoParty', 'fitPatch', 'removeJunkCard', 'blueprint', 'event']).toContain(reason);
        }
    });
});

describe('174d — the walker at a two-slot bench', () => {
    it('never buys more than the venue allows, and the gate stays at one', () => {
        for (const result of WITH_UPGRADES) {
            for (const [kind, count] of upgradesPerVisit(result.log.events)) {
                const cap = kind === 'gym' ? 1 : UPGRADES_PER_VISIT;
                expect(count, `${result.seed} at ${kind}`).toBeLessThanOrEqual(cap);
            }
        }
    });

    it('uses both slots at a market or workshop when the purse and the deck allow it', () => {
        const full = WITH_UPGRADES.flatMap((result) => upgradesPerVisit(result.log.events))
            .filter(([kind, count]) => (kind === 'marketplace' || kind === 'workshop') && count === UPGRADES_PER_VISIT);
        expect(full.length).toBeGreaterThan(0);
    });
});
