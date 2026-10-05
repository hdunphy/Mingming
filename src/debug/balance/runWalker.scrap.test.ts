/**
 * TICKET 174d — the run walker's scrap books, and its upgrade policy at a two-slot bench.
 *
 * Two claims, both about what the walker's run log SAYS, because `scrapCurve` reads that log and
 * the before/after report in `docs/balance/scrap-curve-174.md` is built from it:
 *
 * - **The log balances.** The scrap a run opens with, plus every `SCRAP` row, is the scrap it ends
 *   with. Before 174d this failed on any walk that bought anything: the walker logged what it
 *   gained and left almost every purchase out, so a per-biome "spent" column was nearly empty.
 * - **A two-slot bench is used twice.** The market and the workshop allow `UPGRADES_PER_VISIT` (a town,
 *   since 176c, allows 2 / 3 / 4 by biome); the gate allows one. The walker takes up to the allowance, never more.
 *
 * The second claim is checked two ways. Over the pinned walks below it is only an upper bound (never more
 * than the allowance). That a visit really FILLS the bench is checked on the pieces the walker's bench
 * loop is made of (`chooseUpgrade` and the real `upgradeDeckCard` reducer) with a purse that cannot run
 * out, because no pinned walk can promise it: since 176 the purse is tight enough that none of the
 * walks tried (about fifteen, ghost walks included) bought a full bench, and the answer moves with
 * every rewards or economy change.
 */
import { describe, expect, it } from 'vitest';

import { chooseUpgrade, walkRun, type WalkResult } from './runWalker';
import { STARTING_SCRAP, createRun } from '../../engine/run/createRun';
import { offerGyms } from '../../engine/run/gyms';
import { hasUpgrade } from '../../engine/data/plusRegistry';
import runReducer, { startRun, upgradeDeckCard } from '../../ui/store/runSlice';
import type { IMingmingState } from '../../engine/types';
import { UPGRADES_PER_VISIT, upgradeAllowanceFor } from '../../engine/run/marketplace';
import type { IRunEvent } from '../../engine/run/runLog';

const netScrap = (result: WalkResult): number =>
    result.log.events.reduce((sum, event) => (event.kind === 'SCRAP' ? sum + event.delta : sum), 0);

/** Upgrades bought on each node visit: `[nodeKind, count, allowance]` per `NODE_ENTERED` segment. */
function upgradesPerVisit(events: ReadonlyArray<IRunEvent>): Array<[string, number, number]> {
    const visits: Array<[string, number, number]> = [];
    for (const event of events) {
        if (event.kind === 'NODE_ENTERED') {
            // The gate gives one free upgrade; a town's allowance is its biome's (176c: 2 / 3 / 4);
            // a plain market or workshop keeps UPGRADES_PER_VISIT.
            const allowance = event.nodeKind === 'gym' ? 1 : upgradeAllowanceFor({ kind: event.nodeKind, biomeIndex: event.biome });
            visits.push([event.nodeKind, 0, allowance]);
        } else if (event.kind === 'CARD_UPGRADED' && visits.length > 0) visits[visits.length - 1][1] += 1;
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
            for (const [kind, count, cap] of upgradesPerVisit(result.log.events)) {
                expect(count, `${result.seed} at ${kind}`).toBeLessThanOrEqual(cap);
            }
        }
    });

    it('uses every slot at a market, workshop or town when the purse and the deck allow it', () => {
        /*
         * The walker's bench loop is: pick with `chooseUpgrade`, buy through `upgradeDeckCard` with the
         * venue's allowance, and read the run again before the next slot. This is that loop on the real
         * pick and the real reducer, with scrap to spare, so the only thing that can stop a slot is the
         * allowance or the deck. A bought card becomes its `+` form, which has no `+` of its own, so the
         * next pick has to move on to another card.
         */
        const kraken: IMingmingState = {
            id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1',
            blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10,
        };
        const run = createRun({ seed: 't174d:bench', offer: offerGyms('offer-seed')[0], party: [kraken], startedAt: 1 });
        const available = run.deck.filter((card) => hasUpgrade(card.dataId)).length;
        expect(available).toBeGreaterThanOrEqual(UPGRADES_PER_VISIT);

        for (const allowance of [UPGRADES_PER_VISIT, 3, 4]) {
            let state = runReducer(undefined, startRun({ ...run, scrap: 9999 }));
            for (let slot = 0; slot < allowance; slot += 1) {
                const current = state.run!;
                const choice = chooseUpgrade(current.deck, current.scrap, false);
                if (!choice) break;
                state = runReducer(state, upgradeDeckCard({ instanceId: choice.instanceId, benchKey: 'town:1', free: false, allowance }));
            }
            const bought = state.run!.deck.filter((card) => card.upgraded === true).length;
            expect(bought, `allowance ${allowance}`).toBe(Math.min(allowance, available));
        }
    });
});
